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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { LanguageDetectionService } from '../../../../../../core/services/language-detection.service';
import { SoundDataStepDialogComponent } from '../sound-data-step-dialog/sound-data-step-dialog.component';

import {
  CategoryKey,
  getSubCategoryKeys,
} from '../../../../../../../../amplify/data/categories';

import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Option {
  key: string;
  label: string;
}


@Component({
    selector: 'app-sound-data-info-step',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDialogModule,
        MatAutocompleteModule,
        TranslateModule,
        MatSelectModule,
        MatTooltipModule,
    ],
    templateUrl: './sound-data-info-step.component.html',
    styleUrl: './sound-data-info-step.component.scss'
})
export class SoundDataInfoStepComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private languageDetectionService = inject(LanguageDetectionService);
  private dialog = inject(MatDialog);
  private amplifyService = inject(AmplifyService);
  private translate = inject(TranslateService);

  /* ================= OUTPUT ================= */

  @Output() completed = new EventEmitter<{
    title: string;
    title_i18n: Record<string, string>;
    shortStory: string;
    shortStory_i18n: Record<string, string>;
    sourceLang?: string;
    category?: CategoryKey;
    secondaryCategory?: string;
    recordDateTime?: string;
    equipment?: string;
  }>();

  /* ================= FORM ================= */

  categoryControl = new FormControl<Option | null>(null, Validators.required);
  secondaryCategoryControl = new FormControl<Option | null>(
    { value: null, disabled: true },
    Validators.required,
  );


  form: FormGroup = this.fb.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
    ],
    shortStory: ['', [Validators.minLength(10), Validators.maxLength(500)]],
    category: this.categoryControl,
    secondaryCategory: this.secondaryCategoryControl,
    recordDateTime: [null],
    equipment: ['', [Validators.maxLength(100)]]
  });

  /* ================= AUTOCOMPLETE DATA ================= */

  categories: Option[] = [];
  filteredCategories: Option[] = [];

  secondaryCategories: Option[] = [];
  filteredSecondaryCategories: Option[] = [];

  /** Path to the marker image for the selected subcategory */
  markerImagePath: string | null = null;

  /* ================= TRANSLATION ================= */

  translatingTitle = false;
  translatingStory = false;

  translatedTitle: Record<string, string> = { fr: '', en: '', es: '' };
  translatedStory: Record<string, string> = { fr: '', en: '', es: '' };

  /** Detected source language for title/story (set by translateField or language detection) */
  detectedTitleLang: string | null = null;
  detectedStoryLang: string | null = null;

  private lastTranslatedSource: {
    title?: string;
    shortStory?: string;
  } = {};

  /** In-flight translation promises for deduplication (blur + click race condition) */
  private pendingTranslation: Partial<Record<'title' | 'shortStory', Promise<void>>> = {};

  /* ================= INIT ================= */

  ngOnInit() {
    // Initial build
    this.buildCategories();

    // 🔁 Rebuild on language change
    this.translate.onLangChange.subscribe((event) => {
      this.buildCategories();
      // Si une catégorie est déjà sélectionnée → reconstruire les sous-catégories
      const selected = this.categoryControl.value;
      if (selected) {
        this.onCategorySelected(selected);
      }
    });

    // Category filter
    this.categoryControl.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.categories)),
      )
      .subscribe((r) => (this.filteredCategories = r));

    // Category selection
    this.categoryControl.valueChanges.subscribe((v) => {
      this.onCategorySelected(v);
      this.emitCompleted();
    });

    // SecondaryCategory filter
    this.secondaryCategoryControl.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.secondaryCategories)),
      )
      .subscribe((r) => (this.filteredSecondaryCategories = r));

    this.secondaryCategoryControl.valueChanges.subscribe((option) => {
      this.updateMarkerImage(option);
      this.emitCompleted();
    });

    // Émettre aussi quand le titre ou l'histoire changent (debounced)
    // pour que le parent ait toujours les données à jour
    this.form.get('title')!.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.emitCompleted());

    this.form.get('shortStory')!.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.emitCompleted());
  }

  /* ================= AUTOCOMPLETE HELPERS ================= */

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

    this.reselectCategory(
      this.secondaryCategoryControl,
      this.secondaryCategories,
    );

    this.filteredSecondaryCategories = this.secondaryCategories;
    this.secondaryCategoryControl.enable();
  }

  /* ================= TRANSLATION ================= */

  async onFieldBlur(field: 'title' | 'shortStory') {
    await this.translateField(field);
  }

  async translateField(field: 'title' | 'shortStory') {
    // Deduplication: if a translation is already in progress for this field,
    // return the existing promise (avoids blur + click race condition)
    if (this.pendingTranslation[field]) {
      return this.pendingTranslation[field];
    }

    const control = this.form.get(field);
    if (!control || control.invalid) return;

    const text = control.value?.trim();
    if (!text) return;

    if (this.lastTranslatedSource[field] === text) return;

    const sourceLanguage = this.languageDetectionService.detect(text);
    if (!sourceLanguage) {
      this.snackBar.open('Langue non supportée', 'Fermer', { duration: 3000 });
      return;
    }

    // Track detected source language
    if (field === 'title') {
      this.detectedTitleLang = sourceLanguage;
    } else {
      this.detectedStoryLang = sourceLanguage;
    }

    // Only translate to OTHER languages (skip source→source to preserve original text)
    const targets = ['fr', 'en', 'es'].filter(lang => lang !== sourceLanguage);
    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    // Set source language slot directly from the original text (no API call needed)
    translated[sourceLanguage] = text;

    if (field === 'title') {
      this.translatingTitle = true;
    } else {
      this.translatingStory = true;
    }

    const promise = (async () => {
      try {
        for (const lang of targets) {
          const result = await this.amplifyService.client.queries.translate({
            sourceLanguage,
            targetLanguage: lang,
            text,
          });
          translated[lang] = result.data ?? '';
        }

        this.lastTranslatedSource[field] = text;
        this.emitCompleted();
      } finally {
        if (field === 'title') {
          this.translatingTitle = false;
        } else {
          this.translatingStory = false;
        }
      }
    })();

    this.pendingTranslation[field] = promise;
    try {
      await promise;
    } finally {
      delete this.pendingTranslation[field];
    }
  }

  async openTranslationDialog(field: 'title' | 'shortStory') {
    await this.translateField(field);

    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    const dialogRef = this.dialog.open(SoundDataStepDialogComponent, {
      width: '400px',
      data: { translations: { ...translated }, fieldName: field },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      // Merge dialog result with existing translations to preserve
      // non-fr/en/es source language keys (e.g., 'pt', 'de', 'it')
      // that franc-min may have detected but the dialog doesn't show
      if (field === 'title') {
        this.translatedTitle = { ...this.translatedTitle, ...result };
      } else {
        this.translatedStory = { ...this.translatedStory, ...result };
      }

      this.emitCompleted();
    });
  }

  /* ================= EMIT ================= */

  private emitCompleted() {
    // Detect source language from raw text if not yet detected
    const rawTitle = this.form.get('title')?.value?.trim() || '';
    const rawStory = this.form.get('shortStory')?.value?.trim() || '';

    // Auto-detect language from raw text (for the fallback slot)
    if (rawTitle && !this.detectedTitleLang) {
      this.detectedTitleLang = this.languageDetectionService.detect(rawTitle) || null;
    }
    if (rawStory && !this.detectedStoryLang) {
      this.detectedStoryLang = this.languageDetectionService.detect(rawStory) || null;
    }

    // Use detected source language to sync raw text to the correct slot
    // Falls back to UI language if detection failed
    const titleLang = this.detectedTitleLang || this.translate.currentLang || 'fr';
    if (rawTitle && !this.translatedTitle[titleLang]) {
      this.translatedTitle[titleLang] = rawTitle;
    }

    const storyLang = this.detectedStoryLang || this.translate.currentLang || 'fr';
    if (rawStory && !this.translatedStory[storyLang]) {
      this.translatedStory[storyLang] = rawStory;
    }

    this.completed.emit({
      title: rawTitle,
      title_i18n: this.translatedTitle,
      shortStory: rawStory,
      shortStory_i18n: this.translatedStory,
      sourceLang: this.detectedTitleLang || undefined,
      category: this.categoryControl.value?.key as CategoryKey | undefined,
      secondaryCategory: this.secondaryCategoryControl.value?.key,
      recordDateTime: this.form.value.recordDateTime ?? undefined,
      equipment: this.form.value.equipment?.trim() || undefined
    });
  }

  private buildCategories() {
    this.categories = Object.values(CategoryKey).map((cat) => ({
      key: cat,
      label: this.translate.instant(`categories.${cat}`),
    }));

    this.filteredCategories = this.categories;

    // 🔁 Update selected label if needed
    this.reselectCategory(this.categoryControl, this.categories);
  }

  private reselectCategory(
    control: FormControl,
    options: { key: string; label: string }[],
  ) {
    const current = control.value;
    if (!current) return;

    const updated = options.find((o) => o.key === current.key);
    if (updated) {
      control.setValue(updated, { emitEvent: false });
    }
  }

  /**
   * Update marker image path based on selected subcategory
   * Subcategory keys end with "fly" (e.g., accordionfly)
   * Marker files are named marker_{base}.png (e.g., marker_accordion.png)
   */
  private updateMarkerImage(option: Option | null) {
    if (!option?.key) {
      this.markerImagePath = null;
      return;
    }

    // Remove "fly" suffix from subcategory key
    const baseKey = option.key.replace(/fly$/, '');
    this.markerImagePath = `img/markers/marker_${baseKey}.png`;
  }

}
