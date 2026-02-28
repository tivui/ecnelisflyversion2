import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { firstValueFrom } from 'rxjs';
import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { AppUserService } from '../../../../../../core/services/app-user.service';

import {
  LicenseType,
  SoundStatus,
} from '../../../../../../core/models/sound.model';

interface UserOption {
  id: string;
  username: string;
  email?: string;
}

/**
 * Common TLDs that are widely used on the web.
 * This list covers 99%+ of legitimate URLs users would enter.
 */
const COMMON_TLDS = new Set([
  // Generic TLDs
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int',
  // Popular new gTLDs
  'io', 'co', 'app', 'dev', 'ai', 'me', 'tv', 'info', 'biz', 'name', 'pro',
  'online', 'site', 'website', 'tech', 'store', 'shop', 'blog', 'cloud',
  // European country codes
  'fr', 'de', 'uk', 'es', 'it', 'nl', 'be', 'ch', 'at', 'pt', 'pl', 'se',
  'no', 'dk', 'fi', 'ie', 'cz', 'gr', 'hu', 'ro', 'bg', 'hr', 'sk', 'si',
  'lt', 'lv', 'ee', 'lu', 'mt', 'cy', 'is',
  // Americas
  'us', 'ca', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 've',
  // Asia-Pacific
  'cn', 'jp', 'kr', 'in', 'au', 'nz', 'sg', 'hk', 'tw', 'th', 'my', 'id',
  'ph', 'vn', 'pk', 'bd',
  // Middle East & Africa
  'ae', 'sa', 'il', 'za', 'eg', 'ma', 'ng', 'ke',
  // Russia & CIS
  'ru', 'ua', 'by', 'kz',
  // Others commonly seen
  'eu', 'asia', 'mobi', 'travel', 'museum', 'coop', 'aero', 'jobs', 'cat',
]);
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-sound-data-meta-step',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatAutocompleteModule,
        TranslateModule,
        MatSelectModule,
        MatTooltipModule,
    ],
    templateUrl: './sound-data-meta-step.component.html',
    styleUrl: './sound-data-meta-step.component.scss'
})
export class SoundDataMetaStepComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private amplifyService = inject(AmplifyService);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private appUserService = inject(AppUserService);

  /* ================= OUTPUT ================= */

  @Output() completed = new EventEmitter<{
    url?: string;
    urlTitle?: string;
    secondaryUrl?: string;
    secondaryUrlTitle?: string;
    license: LicenseType;
    status: SoundStatus;
    hashtags?: string;
    linkedUserId?: string;
  }>();

  /* ================= ADMIN USER SELECTION ================= */

  isAdmin = false;
  allUsers: UserOption[] = [];
  filteredUsers: UserOption[] = [];
  userControl = new FormControl<UserOption | null>(null);
  currentUser: UserOption | null = null;

  /* ================= FORM ================= */

  statusControl = new FormControl<SoundStatus>('public', Validators.required);
  licenseControl = new FormControl<LicenseType | null>(
    'CC_BY',
    Validators.required,
  );

  form: FormGroup = this.fb.group({
    url: ['', [this.urlValidator.bind(this)]],
    urlTitle: ['', [Validators.maxLength(100)]],
    secondaryUrl: ['', [this.urlValidator.bind(this)]],
    secondaryUrlTitle: ['', [Validators.maxLength(100)]],
    status: this.statusControl,
    license: this.licenseControl,
    hashtags: ['', [Validators.maxLength(200)]],
  }, {
    validators: [this.titleRequiresUrlValidator.bind(this)]
  });

  /**
   * Cross-field validator: title requires a valid URL
   */
  private titleRequiresUrlValidator(group: FormGroup): Record<string, boolean> | null {
    const url1 = group.get('url')?.value?.trim();
    const title1 = group.get('urlTitle')?.value?.trim();
    const url2 = group.get('secondaryUrl')?.value?.trim();
    const title2 = group.get('secondaryUrlTitle')?.value?.trim();

    let hasError = false;

    // Clear previous errors
    group.get('urlTitle')?.setErrors(null);
    group.get('secondaryUrlTitle')?.setErrors(null);

    // Title 1 without valid URL 1
    if (title1 && !this.isValidUrl(url1) && !this.hasUncommonTld(url1)) {
      group.get('urlTitle')?.setErrors({ titleRequiresUrl: true });
      hasError = true;
    }

    // Title 2 without valid URL 2
    if (title2 && !this.isValidUrl(url2) && !this.hasUncommonTld(url2)) {
      group.get('secondaryUrlTitle')?.setErrors({ titleRequiresUrl: true });
      hasError = true;
    }

    return hasError ? { titleRequiresUrl: true } : null;
  }

  /** Track if URL fields have valid URLs for preview */
  url1Valid = false;
  url2Valid = false;

  /** Track if URL has uncommon TLD (warning, not error) */
  url1UncommonTld = false;
  url2UncommonTld = false;

  /**
   * Custom URL validator that accepts URLs with or without protocol
   * (we auto-format them, so we just need to validate the domain part)
   */
  private urlValidator(control: FormControl): Record<string, boolean> | null {
    const value = control.value?.trim();
    if (!value) return null; // Empty is valid (optional field)

    // After formatting, check if it's a valid URL
    const formatted = this.formatUrl(value);
    try {
      new URL(formatted);
      return null;
    } catch {
      return { invalidUrl: true };
    }
  }

  /**
   * Format URL with https:// prefix if missing
   * Handles various input formats:
   * - www.example.com -> https://www.example.com
   * - example.com -> https://example.com
   * - http://example.com -> http://example.com (preserved)
   * - https://example.com -> https://example.com (preserved)
   */
  formatUrl(value: string): string {
    if (!value) return value;

    let url = value.trim();

    // Remove leading/trailing whitespace and common typos
    url = url.replace(/^[/\\]+/, ''); // Remove leading slashes
    url = url.replace(/\s+/g, ''); // Remove all whitespace

    // Already has a valid protocol
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    // Has incomplete protocol (e.g., "http:/example.com" or "https:/example.com")
    if (/^https?:\/[^/]/i.test(url)) {
      return url.replace(/^(https?:\/)([^/])/i, '$1/$2');
    }

    // Starts with "://" (user typed just the protocol separator)
    if (url.startsWith('://')) {
      return 'https' + url;
    }

    // Starts with "//" (protocol-relative URL)
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    // No protocol - add https://
    return 'https://' + url;
  }

  /**
   * Check if a URL is complete and valid for preview
   */
  isValidUrl(value: string): boolean {
    if (!value?.trim()) return false;
    const formatted = this.formatUrl(value);
    try {
      const url = new URL(formatted);
      // Must have a valid TLD (at least 2 chars after last dot)
      const hostname = url.hostname;
      const parts = hostname.split('.');
      if (parts.length < 2 || parts[parts.length - 1].length < 2) {
        return false;
      }
      // Check if TLD is a common one
      const tld = parts[parts.length - 1].toLowerCase();
      return COMMON_TLDS.has(tld);
    } catch {
      return false;
    }
  }

  /**
   * Check if URL has an uncommon TLD (valid format but rare TLD)
   */
  hasUncommonTld(value: string): boolean {
    if (!value?.trim()) return false;
    const formatted = this.formatUrl(value);
    try {
      const url = new URL(formatted);
      const hostname = url.hostname;
      const parts = hostname.split('.');
      if (parts.length < 2) return false;
      const tld = parts[parts.length - 1].toLowerCase();
      // Valid TLD length but not in common list
      return tld.length >= 2 && !COMMON_TLDS.has(tld);
    } catch {
      return false;
    }
  }

  /**
   * Extract domain from URL for display
   */
  extractDomain(value: string): string {
    if (!value) return '';
    try {
      const formatted = this.formatUrl(value);
      const url = new URL(formatted);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /* ================= INIT ================= */

  ngOnInit() {
    // Subscribe to form value changes to emit completed data
    this.form.valueChanges.subscribe(() => {
      this.emitCompleted();
    });

    // Subscribe to license control changes
    this.licenseControl.valueChanges.subscribe(() => {
      this.emitCompleted();
    });

    // Subscribe to user control changes
    this.userControl.valueChanges.subscribe(() => {
      this.emitCompleted();
    });

    // Check if user is admin and load users
    this.initAdminSection();

    // Emit initial values
    this.emitCompleted();
  }

  /**
   * Initialize admin section: check admin status, load users
   */
  private async initAdminSection() {
    this.isAdmin = this.authService.isInGroup('ADMIN');

    if (this.isAdmin) {
      // Get current user
      const appUser = await firstValueFrom(this.appUserService.currentUser$);
      if (appUser) {
        this.currentUser = {
          id: appUser.id,
          username: appUser.username,
          email: appUser.email,
        };
        // Set current user as default
        this.userControl.setValue(this.currentUser);
      }

      // Load all users
      await this.loadAllUsers();

      // Setup autocomplete filtering
      this.userControl.valueChanges.subscribe((value) => {
        this.filteredUsers = this.filterUsers(value);
      });
    }
  }

  /**
   * Load all users from the database (admin only)
   */
  private async loadAllUsers() {
    try {
      const result = await this.amplifyService.client.models.User.list();
      if (result.data) {
        this.allUsers = result.data.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email ?? undefined,
        }));
        this.filteredUsers = [...this.allUsers];
      }
    } catch (error) {
      console.error('[SoundDataMetaStep] Failed to load users:', error);
    }
  }

  /**
   * Filter users for autocomplete
   */
  private filterUsers(value: string | UserOption | null): UserOption[] {
    if (!value) return [...this.allUsers];
    if (typeof value !== 'string') return [...this.allUsers];

    const filterValue = value.toLowerCase();
    return this.allUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(filterValue) ||
        (user.email?.toLowerCase().includes(filterValue) ?? false)
    );
  }

  /**
   * Display function for user autocomplete
   */
  displayUserFn(user: UserOption | null): string {
    return user ? user.username : '';
  }

  /* ================= EMIT ================= */

  private emitCompleted() {
    const selectedUser = this.userControl.value;
    this.completed.emit({
      url: this.form.value.url?.trim() || undefined,
      urlTitle: this.form.value.urlTitle?.trim() || undefined,
      secondaryUrl: this.form.value.secondaryUrl?.trim() || undefined,
      secondaryUrlTitle: this.form.value.secondaryUrlTitle?.trim() || undefined,
      license: this.licenseControl.value || 'CC_BY',
      status: this.statusControl.value || 'public',
      hashtags: this.form.value.hashtags?.trim() || undefined,
      linkedUserId: selectedUser?.id,
    });
  }

  onStatusChange() {
    const value = this.statusControl.value;
    // If user selects "public", change to "public_to_be_approved" and show a snackbar
    if (value === 'public') {
      this.statusControl.setValue('public_to_be_approved', {
        emitEvent: false,
      });
      this.snackBar.open(
        this.translate.instant('categories.statusPending'),
        'OK',
        { duration: 3000 },
      );
    }
    this.emitCompleted();
  }

  licenseOptions = [
    {
      value: 'READ_ONLY' as LicenseType,
      label: 'sound.licenses.READ_ONLY',
      tooltip: 'sound.licenses.READ_ONLY_tooltip',
    },
    {
      value: 'PUBLIC_DOMAIN' as LicenseType,
      label: 'sound.licenses.PUBLIC_DOMAIN',
      tooltip: 'sound.licenses.PUBLIC_DOMAIN_tooltip',
    },
    {
      value: 'CC_BY' as LicenseType,
      label: 'sound.licenses.CC_BY',
      tooltip: 'sound.licenses.CC_BY_tooltip',
    },
    {
      value: 'CC_BY_NC' as LicenseType,
      label: 'sound.licenses.CC_BY_NC',
      tooltip: 'sound.licenses.CC_BY_NC_tooltip',
    },
  ];

  /**
   * Handle URL input blur - auto-format the URL
   */
  onUrlBlur(controlName: 'url' | 'secondaryUrl') {
    const control = this.form.get(controlName);
    const value = control?.value?.trim();

    if (value && !control?.hasError('invalidUrl')) {
      const formatted = this.formatUrl(value);
      control?.setValue(formatted, { emitEvent: true });
    }

    // Update validity flags
    this.updateUrlValidity();
  }

  /**
   * Handle URL input - live validation feedback
   */
  onUrlInput() {
    this.updateUrlValidity();
  }

  /**
   * Update URL validity flags for UI feedback
   */
  private updateUrlValidity() {
    const url1 = this.form.get('url')?.value;
    const url2 = this.form.get('secondaryUrl')?.value;

    this.url1Valid = this.isValidUrl(url1);
    this.url2Valid = this.isValidUrl(url2);

    // Check for uncommon TLDs (warning state)
    this.url1UncommonTld = this.hasUncommonTld(url1);
    this.url2UncommonTld = this.hasUncommonTld(url2);
  }

  /**
   * Open URL in new tab (for preview)
   */
  openUrl(controlName: 'url' | 'secondaryUrl') {
    const value = this.form.get(controlName)?.value;
    if (value && this.isValidUrl(value)) {
      const formatted = this.formatUrl(value);
      window.open(formatted, '_blank', 'noopener,noreferrer');
    }
  }

  onHashtagInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // If user has typed a space, add # at the beginning of each word except the last one
    const words = value.split(' ');

    for (let i = 0; i < words.length - 1; i++) {
      if (!words[i].startsWith('#') && words[i].trim() !== '') {
        words[i] = `#${words[i]}`;
      }
    }

    // Reconstruct the value with the last word intact (in progress of typing)
    value = words.join(' ');

    this.form.get('hashtags')?.setValue(value, { emitEvent: false });
  }
}
