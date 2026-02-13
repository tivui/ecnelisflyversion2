import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { LangChangeEvent, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppUserService } from '../../../../../core/services/app-user.service';
import { AppUser, Theme } from '../../../../../core/models/app-user.model';
import { Language } from '../../../../../core/models/i18n.model';
import { Router } from '@angular/router';
import { AvatarService, AvatarStyleOption } from '../../../../../core/services/avatar.service';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';

import * as countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import frLocale from 'i18n-iso-countries/langs/fr.json';
import esLocale from 'i18n-iso-countries/langs/es.json';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDividerModule,
    MatAutocompleteModule,
    TranslatePipe,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatTabsModule,
    MatIconModule,
    UserAvatarComponent,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  readonly avatarService = inject(AvatarService);

  public appUser = signal<AppUser | null>(null);
  public saving = signal(false);

  // Tabs
  activeTab = signal(0);

  // Avatar
  selectedAvatarStyle = signal<string>('initials');
  selectedAvatarSeed = signal<string>('');
  selectedAvatarBgColor = signal<string>('1976d2');
  selectedAvatarOptions = signal<Record<string, string>>({});
  avatarDirty = signal(false);

  currentStyleDimensions = computed(() =>
    this.avatarService.getStyleDimensions(this.selectedAvatarStyle()),
  );

  hasCustomOptions = computed(() =>
    this.currentStyleDimensions().length > 0,
  );

  public languages: Language[] = ['fr', 'en', 'es'];
  public themes: Theme[] = ['light', 'dark'];

  // Main form definition
  public accountForm = this.fb.group({
    username: ['', Validators.required],
    firstName: [''],
    lastName: [''],
    country: ['', Validators.required],
    language: ['', Validators.required],
    theme: ['', Validators.required],
  });

  // Country options and filtered results for autocomplete
  public countryOptions: { code: string; name: string }[] = [];
  public filteredCountriesSignal = signal<{ code: string; name: string }[]>([]);
  public countryCodeControl = this.fb.control<string | null>(null, [
    Validators.required,
  ]);

  ngOnInit() {
    // Register available locales
    countries.registerLocale(enLocale);
    countries.registerLocale(frLocale);
    countries.registerLocale(esLocale);

    // Load default country list in English
    this.updateCountryList('en');

    // Load current user and patch form values
    this.appUserService.loadCurrentUser().then((user) => {
      this.appUser.set(user);
      if (user) {
        this.accountForm.patchValue({
          username: user.username ?? '',
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          country: user.country ?? '',
          language: user.language,
          theme: user.theme,
        });
        this.selectedAvatarStyle.set(user.avatarStyle ?? 'initials');
        this.selectedAvatarSeed.set(user.avatarSeed ?? user.username ?? '');
        this.selectedAvatarBgColor.set(user.avatarBgColor ?? '1976d2');
        this.selectedAvatarOptions.set(user.avatarOptions ?? {});
      }
    });

    // Listen to country input changes for filtering
    this.accountForm
      .get('country')!
      .valueChanges.subscribe((val: string | null) => {
        const filter = (val ?? '').toLowerCase();
        this.filteredCountriesSignal.set(
          this.countryOptions.filter((c) =>
            c.name.toLowerCase().includes(filter),
          ),
        );
      });

    // Add validator to only allow existing country codes
    this.accountForm
      .get('country')
      ?.setValidators([
        Validators.required,
        this.countryValidator(() => this.countryOptions),
      ]);
    this.accountForm.get('country')?.updateValueAndValidity();

    // Update country names when language changes
    this.accountForm.get('language')?.valueChanges.subscribe((lang) => {
      this.updateCountryList(lang as Language);
    });

    // Subscribe Language change from toolbar
    this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
      const newLang = event.lang as Language;
      this.updateCountryList(newLang);
    });
  }

  // Build the list of countries for the given language
  private updateCountryList(lang: Language) {
    let locale = 'en';
    if (lang === 'fr') locale = 'fr';
    if (lang === 'es') locale = 'es';

    this.countryOptions = Object.entries(countries.getNames(locale)).map(
      ([code, name]) => ({ code, name }),
    );

    // Apply filtering based on current country field value
    const val = this.accountForm.get('country')?.value || '';
    this.filteredCountriesSignal.set(
      this.countryOptions.filter((c) =>
        c.name.toLowerCase().includes(val.toLowerCase()),
      ),
    );
  }

  /** Seeds shown in the variation gallery for the selected style */
  variationSeeds = signal<string[]>([]);

  selectAvatarStyle(style: string) {
    this.selectedAvatarStyle.set(style);
    this.selectedAvatarOptions.set({});
    this.avatarDirty.set(true);
    // Show variation gallery for this style
    this.variationSeeds.set(this.avatarService.getVariationSeeds());
  }

  selectVariation(seed: string) {
    this.selectedAvatarSeed.set(seed);
    this.avatarDirty.set(true);
  }

  onAvatarSeedChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.selectedAvatarSeed.set(value);
    this.avatarDirty.set(true);
  }

  selectAvatarBgColor(hex: string) {
    this.selectedAvatarBgColor.set(hex);
    this.avatarDirty.set(true);
  }

  onTabChange(index: number) {
    this.activeTab.set(index);
  }

  regenerateSeeds() {
    const seeds: string[] = [];
    for (let i = 0; i < 16; i++) {
      seeds.push(this.generateRandomSeed());
    }
    this.variationSeeds.set(seeds);
  }

  private generateRandomSeed(): string {
    return 'xxxxxxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16),
    );
  }

  selectOption(key: string, value: string) {
    const current = this.selectedAvatarOptions();
    if (current[key] === value) {
      const { [key]: _, ...rest } = current;
      this.selectedAvatarOptions.set(rest);
    } else {
      this.selectedAvatarOptions.set({ ...current, [key]: value });
    }
    this.avatarDirty.set(true);
  }

  get canSave(): boolean {
    return (
      (this.accountForm.dirty || this.avatarDirty()) &&
      this.accountForm.valid &&
      !!this.appUser() &&
      !this.saving()
    );
  }

  // Save the form and update user profile
  async save() {
    this.countryCodeControl.updateValueAndValidity();

    if (this.accountForm.invalid || !this.appUser()) {
      this.countryCodeControl.markAsTouched();
      return;
    }

    if (!this.accountForm.valid || (!this.accountForm.dirty && !this.avatarDirty()) || !this.appUser())
      return;

    this.saving.set(true);
    const values = this.accountForm.value;

    try {
      await this.appUserService.updateLanguage(values.language as Language);
      await this.appUserService.updateTheme(values.theme as Theme);

      const updatedUser = await this.appUserService.updateProfile({
        username: values.username ?? '',
        country: values.country ?? null,
        firstName: values.firstName ?? '',
        lastName: values.lastName ?? '',
        avatarStyle: this.selectedAvatarStyle(),
        avatarSeed: this.selectedAvatarSeed(),
        avatarBgColor: this.selectedAvatarBgColor(),
        avatarOptions: Object.keys(this.selectedAvatarOptions()).length > 0
          ? this.selectedAvatarOptions()
          : null,
      });

      if (updatedUser) {
        this.translate.use(values.language as Language);
      }

      this.router.navigate(['/home']);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      this.saving.set(false);
    }
  }

  // Get country name by its code
  countryName(code?: string | null): string {
    return this.countryOptions.find((c) => c.code === code)?.name || '';
  }

  // Called when a country is selected from the dropdown
  onCountrySelected(code: string) {
    // Set the exact code when user selects an option
    this.accountForm.get('country')?.setValue(code);
  }

  private countryValidator(
    getOptions: () => { code: string; name: string }[],
  ): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value;
      if (!val) return { required: true };

      // val must be a code in the options
      const existsByCode = getOptions().some((c) => c.code === val);
      return existsByCode ? null : { invalidCountry: true };
    };
  }
}
