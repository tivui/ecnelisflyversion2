import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  Subject,
  takeUntil,
} from 'rxjs';
import * as L from 'leaflet';

import {
  Sound,
  SoundStatus,
  LicenseType,
} from '../../../../../../core/models/sound.model';
import { DashboardService } from '../../../../services/dashboard.service';
import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { LanguageDetectionService } from '../../../../../../core/services/language-detection.service';
import {
  CategoryKey,
  getSubCategoryKeys,
} from '../../../../../../../../amplify/data/categories';

interface DialogData {
  sound: Sound;
}

interface Option {
  key: string;
  label: string;
}

@Component({
  selector: 'app-sound-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    {
      provide: MAT_DATE_LOCALE,
      useFactory: (translate: TranslateService) => translate.currentLang,
      deps: [TranslateService],
    },
  ],
  templateUrl: './sound-edit-dialog.component.html',
  styleUrl: './sound-edit-dialog.component.scss',
})
export class SoundEditDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<SoundEditDialogComponent>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly dashboardService = inject(DashboardService);
  private readonly translate = inject(TranslateService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly languageDetectionService = inject(LanguageDetectionService);
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly destroy$ = new Subject<void>();

  sound: Sound;
  saving = signal(false);
  activeTab = signal(0);

  // Map
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  // Categories
  categories: Option[] = [];
  filteredCategories: Option[] = [];
  secondaryCategories: Option[] = [];
  filteredSecondaryCategories: Option[] = [];

  // Translation state
  translatingTitle = signal(false);
  translatingStory = signal(false);
  translatedTitle: Record<string, string> = { fr: '', en: '', es: '' };
  translatedStory: Record<string, string> = { fr: '', en: '', es: '' };

  // Form controls
  categoryControl = new FormControl<Option | null>(null);
  secondaryCategoryControl = new FormControl<Option | null>({
    value: null,
    disabled: true,
  });

  // Info form
  infoForm: FormGroup = this.fb.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    ],
    shortStory: ['', [Validators.maxLength(500)]],
    category: this.categoryControl,
    secondaryCategory: this.secondaryCategoryControl,
    recordDateTime: [null],
    equipment: ['', [Validators.maxLength(100)]],
  });

  // Location form
  locationForm: FormGroup = this.fb.group({
    latitude: [null],
    longitude: [null],
    city: ['', [Validators.maxLength(200)]],
  });

  // Meta form
  statusControl = new FormControl<SoundStatus>('public');
  licenseControl = new FormControl<LicenseType>('CC_BY');

  metaForm: FormGroup = this.fb.group({
    url: [''],
    urlTitle: ['', [Validators.maxLength(100)]],
    secondaryUrl: [''],
    secondaryUrlTitle: ['', [Validators.maxLength(100)]],
    status: this.statusControl,
    license: this.licenseControl,
    hashtags: ['', [Validators.maxLength(200)]],
  });

  // License options
  licenseOptions: { value: LicenseType; label: string }[] = [
    { value: 'READ_ONLY', label: 'sound.licenses.READ_ONLY' },
    { value: 'PUBLIC_DOMAIN', label: 'sound.licenses.PUBLIC_DOMAIN' },
    { value: 'CC_BY', label: 'sound.licenses.CC_BY' },
    { value: 'CC_BY_NC', label: 'sound.licenses.CC_BY_NC' },
  ];

  // Status options
  statusOptions: { value: SoundStatus; label: string }[] = [
    { value: 'private', label: 'dashboard.status.private' },
    {
      value: 'public_to_be_approved',
      label: 'dashboard.status.public_to_be_approved',
    },
    { value: 'public', label: 'dashboard.status.public' },
  ];

  constructor() {
    this.sound = this.data.sound;
  }

  ngOnInit() {
    this.initializeForms();
    this.buildCategories();
    this.setupCategoryListeners();
    this.setDateLocale(this.translate.currentLang);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeForms() {
    const sound = this.sound;

    // Info form
    this.infoForm.patchValue({
      title: sound.title_i18n?.[this.currentLang] || sound.title || '',
      shortStory:
        sound.shortStory_i18n?.[this.currentLang] || sound.shortStory || '',
      recordDateTime: sound.recordDateTime || null,
      equipment: sound.equipment || '',
    });

    // Initialize translations
    if (sound.title_i18n) {
      this.translatedTitle = { ...sound.title_i18n };
    }
    if (sound.shortStory_i18n) {
      this.translatedStory = { ...sound.shortStory_i18n };
    }

    // Location form
    this.locationForm.patchValue({
      latitude: sound.latitude || null,
      longitude: sound.longitude || null,
      city: sound.city || '',
    });

    // Meta form
    this.metaForm.patchValue({
      url: sound.url || '',
      urlTitle: sound.urlTitle || '',
      secondaryUrl: sound.secondaryUrl || '',
      secondaryUrlTitle: sound.secondaryUrlTitle || '',
      hashtags: sound.hashtags || '',
    });
    this.statusControl.setValue(sound.status || 'public');
    this.licenseControl.setValue(sound.license || 'CC_BY');
  }

  private buildCategories() {
    this.categories = Object.values(CategoryKey).map((cat) => ({
      key: cat,
      label: this.translate.instant(`categories.${cat}`),
    }));
    this.filteredCategories = this.categories;

    // Set current category if exists
    if (this.sound.category) {
      const currentCat = this.categories.find(
        (c) => c.key === this.sound.category,
      );
      if (currentCat) {
        this.categoryControl.setValue(currentCat);
        this.onCategorySelected(currentCat);

        // Set secondary category
        if (this.sound.secondaryCategory) {
          const currentSubCat = this.secondaryCategories.find(
            (c) => c.key === this.sound.secondaryCategory,
          );
          if (currentSubCat) {
            this.secondaryCategoryControl.setValue(currentSubCat);
          }
        }
      }
    }
  }

  private setupCategoryListeners() {
    // Category filter
    this.categoryControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.categories)),
      )
      .subscribe((r) => (this.filteredCategories = r));

    // Category selection
    this.categoryControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => this.onCategorySelected(v));

    // Secondary category filter
    this.secondaryCategoryControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.secondaryCategories)),
      )
      .subscribe((r) => (this.filteredSecondaryCategories = r));
  }

  get currentLang(): string {
    return this.translate.currentLang || 'fr';
  }

  displayFn(option: Option | null): string {
    return option ? option.label : '';
  }

  filterOptions(value: Option | string | null, list: Option[]): Option[] {
    const search =
      typeof value === 'string'
        ? value.toLowerCase()
        : (value?.label.toLowerCase() ?? '');
    return list.filter((opt) => opt.label.toLowerCase().includes(search));
  }

  onCategorySelected(option: Option | null) {
    this.secondaryCategoryControl.reset();
    this.secondaryCategoryControl.disable();

    if (!option) {
      this.secondaryCategories = [];
      this.filteredSecondaryCategories = [];
      return;
    }

    this.secondaryCategories = getSubCategoryKeys(
      option.key as CategoryKey,
    ).map((sub) => ({
      key: sub,
      label: this.translate.instant(`categories.${option.key}.${sub}`),
    }));
    this.filteredSecondaryCategories = this.secondaryCategories;
    this.secondaryCategoryControl.enable();
  }

  private setDateLocale(lang: string) {
    const localeMap: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-GB',
      es: 'es-ES',
    };
    this.dateAdapter.setLocale(localeMap[lang] ?? lang);
  }

  /**
   * Get marker icon based on sound's secondary category
   * Falls back to Leaflet default if no category marker available
   */
  private getMarkerIcon(): L.Icon | L.Icon.Default {
    const secondaryCategory = this.sound.secondaryCategory;

    if (secondaryCategory) {
      // Remove "fly" suffix to get marker filename (e.g., "accordionfly" -> "accordion")
      const baseKey = secondaryCategory.replace(/fly$/, '');
      return L.icon({
        iconUrl: `img/markers/marker_${baseKey}.png`,
        iconRetinaUrl: `img/markers/marker_${baseKey}.png`,
        shadowUrl: 'img/markers/markers-shadow.png',
        iconSize: [32, 43],
        iconAnchor: [15, 40],
        shadowAnchor: [8, 10],
        popupAnchor: [0, -35],
      });
    }

    // Fallback to Leaflet default marker
    return new L.Icon.Default();
  }

  // Translation
  async translateField(field: 'title' | 'shortStory') {
    const control = this.infoForm.get(field);
    if (!control) return;

    const text = control.value?.trim();
    if (!text) return;

    const sourceLanguage = this.languageDetectionService.detect(text);
    if (!sourceLanguage) return;

    const targets = ['fr', 'en', 'es'];
    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    if (field === 'title') {
      this.translatingTitle.set(true);
    } else {
      this.translatingStory.set(true);
    }

    try {
      for (const lang of targets) {
        const result = await this.amplifyService.client.queries.translate({
          sourceLanguage,
          targetLanguage: lang,
          text,
        });
        translated[lang] = result.data ?? '';
      }
    } finally {
      if (field === 'title') {
        this.translatingTitle.set(false);
      } else {
        this.translatingStory.set(false);
      }
    }
  }

  // Map initialization (called when tab 1 is selected)
  onTabChange(index: number) {
    this.activeTab.set(index);
    if (index === 1 && !this.map) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  private initMap() {
    const lat = this.locationForm.get('latitude')?.value || 48.8566;
    const lng = this.locationForm.get('longitude')?.value || 2.3522;

    this.map = L.map('edit-map', {
      center: [lat, lng],
      zoom: this.locationForm.get('latitude')?.value ? 14 : 4,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // Add marker with category-specific icon or Leaflet default
    const markerIcon = this.getMarkerIcon();

    this.marker = L.marker([lat, lng], {
      icon: markerIcon,
      draggable: true,
    }).addTo(this.map);

    this.marker.on('dragend', () => {
      const pos = this.marker?.getLatLng();
      if (pos) {
        this.locationForm.patchValue({
          latitude: pos.lat,
          longitude: pos.lng,
        });
      }
    });

    // Map click to move marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.marker?.setLatLng(e.latlng);
      this.locationForm.patchValue({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
    });
  }

  // Save
  async save() {
    if (this.saving()) return;

    // Validate title (the only required field)
    if (this.infoForm.get('title')?.invalid) {
      this.activeTab.set(0);
      return;
    }

    this.saving.set(true);

    try {
      // Merge all form data
      const updateData: Partial<Sound> = {};

      // Info
      const infoValues = this.infoForm.value;
      if (infoValues.title) {
        updateData.title = infoValues.title;
        // Ensure the title in current language is set
        this.translatedTitle[this.currentLang] = infoValues.title;
        updateData.title_i18n = this.translatedTitle;
      }
      if (infoValues.shortStory !== undefined) {
        updateData.shortStory = infoValues.shortStory || undefined;
        if (infoValues.shortStory) {
          this.translatedStory[this.currentLang] = infoValues.shortStory;
        }
        updateData.shortStory_i18n = this.translatedStory;
      }
      if (this.categoryControl.value) {
        updateData.category = this.categoryControl.value.key as CategoryKey;
      }
      if (this.secondaryCategoryControl.value) {
        updateData.secondaryCategory = this.secondaryCategoryControl.value.key;
      } else {
        updateData.secondaryCategory = undefined;
      }
      updateData.recordDateTime = infoValues.recordDateTime || undefined;
      updateData.equipment = infoValues.equipment || undefined;

      // Location
      const locationValues = this.locationForm.value;
      updateData.latitude = locationValues.latitude;
      updateData.longitude = locationValues.longitude;
      updateData.city = locationValues.city || undefined;

      // Meta
      const metaValues = this.metaForm.value;
      updateData.url = metaValues.url || undefined;
      updateData.urlTitle = metaValues.urlTitle || undefined;
      updateData.secondaryUrl = metaValues.secondaryUrl || undefined;
      updateData.secondaryUrlTitle = metaValues.secondaryUrlTitle || undefined;
      updateData.status = this.statusControl.value || undefined;
      updateData.license = this.licenseControl.value || undefined;
      updateData.hashtags = metaValues.hashtags || undefined;

      const updated = await this.dashboardService.updateSound(
        this.sound.id!,
        updateData,
      );

      if (updated) {
        this.dialogRef.close(updated);
      }
    } catch (err) {
      console.error('[SoundEditDialog] Failed to save:', err);
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}
