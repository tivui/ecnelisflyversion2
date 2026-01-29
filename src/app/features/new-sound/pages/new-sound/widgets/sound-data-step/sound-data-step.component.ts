import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
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

interface Option {
  key: string;
  label: string;
}

@Component({
  selector: 'app-sound-data-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatAutocompleteModule,
    AsyncPipe,
    TranslateModule,
  ],
  templateUrl: './sound-data-step.component.html',
  styleUrls: ['./sound-data-step.component.scss'],
})
export class SoundDataStepComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private languageDetectionService = inject(LanguageDetectionService);
  private dialog = inject(MatDialog);
  private amplifyService = inject(AmplifyService);
  private translate = inject(TranslateService);

  /* ================= OUTPUT ================= */

  @Output() completed = new EventEmitter<{
    title_i18n: Record<string, string>;
    shortStory_i18n: Record<string, string>;
    category?: CategoryKey;
    secondaryCategory?: string;
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
  });

  /* ================= AUTOCOMPLETE DATA ================= */

  categories: Option[] = [];
  filteredCategories: Option[] = [];

  secondaryCategories: Option[] = [];
  filteredSecondaryCategories: Option[] = [];

  /* ================= TRANSLATION ================= */

  translatingTitle = false;
  translatingStory = false;

  translatedTitle: Record<string, string> = { fr: '', en: '', es: '' };
  translatedStory: Record<string, string> = { fr: '', en: '', es: '' };

  private lastTranslatedSource: {
    title?: string;
    shortStory?: string;
  } = {};

  /* ================= INIT ================= */

  ngOnInit() {
    // Initial build
    this.buildCategories();

    // 🔁 Rebuild on language change
    this.translate.onLangChange.subscribe(() => {
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

    this.secondaryCategoryControl.valueChanges.subscribe(() => {
      this.emitCompleted();
    });
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

    this.filteredSecondaryCategories = this.secondaryCategories;
    this.secondaryCategoryControl.enable();
  }

  /* ================= TRANSLATION ================= */

  async onFieldBlur(field: 'title' | 'shortStory') {
    await this.translateField(field);
  }

  async translateField(field: 'title' | 'shortStory') {
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

    const targets = ['fr', 'en', 'es'];
    const translated =
      field === 'title' ? this.translatedTitle : this.translatedStory;

    if (field === 'title') {
      this.translatingTitle = true;
    } else {
      this.translatingStory = true;
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

      this.lastTranslatedSource[field] = text;
      this.emitCompleted();
    } finally {
      if (field === 'title') {
        this.translatingTitle = false;
      } else {
        this.translatingStory = false;
      }
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

      if (field === 'title') {
        this.translatedTitle = result;
      } else {
        this.translatedStory = result;
      }

      this.emitCompleted();
    });
  }

  /* ================= EMIT ================= */

  private emitCompleted() {
    this.completed.emit({
      title_i18n: this.translatedTitle,
      shortStory_i18n: this.translatedStory,
      category: this.categoryControl.value?.key as CategoryKey | undefined,
      secondaryCategory: this.secondaryCategoryControl.value?.key,
    });
  }

  private buildCategories() {
    this.categories = Object.values(CategoryKey).map((cat) => ({
      key: cat,
      label: this.translate.instant(`categories.${cat}`),
    }));

    this.filteredCategories = this.categories;
  }
}
