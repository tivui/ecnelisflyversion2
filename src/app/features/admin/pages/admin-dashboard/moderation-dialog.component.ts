import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, map, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Sound } from '../../../../core/models/sound.model';
import { CategoryKey, getSubCategoryKeys } from '../../../../../../amplify/data/categories';

interface Option {
  key: string;
  label: string;
}

export interface ModerationDialogData {
  sound: Sound;
}

export interface ModerationDialogResult {
  action: 'approved' | 'rejected';
  category?: CategoryKey;
  secondaryCategory?: string;
  moderationNote?: string;
  categoryChanged: boolean;
}

@Component({
  selector: 'app-moderation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>rate_review</mat-icon>
      {{ 'admin.moderation.dialog.title' | translate }}
    </h2>

    <mat-dialog-content>
      <!-- Sound summary -->
      <div class="sound-summary">
        <div class="summary-row">
          <mat-icon>music_note</mat-icon>
          <span class="summary-title">{{ data.sound.title }}</span>
        </div>
        <div class="summary-row secondary">
          <mat-icon>person</mat-icon>
          <span>{{ 'admin.moderation.dialog.soundBy' | translate:{ username: data.sound.user?.username || data.sound.userId } }}</span>
        </div>
        @if (data.sound.city) {
          <div class="summary-row secondary">
            <mat-icon>place</mat-icon>
            <span>{{ data.sound.city }}</span>
          </div>
        }
      </div>

      <!-- Decision -->
      <div class="decision-section">
        <mat-radio-group [formControl]="decisionControl">
          <mat-radio-button value="approved" color="primary">
            <mat-icon class="radio-icon approve-icon">check_circle</mat-icon>
            {{ 'admin.moderation.dialog.approve' | translate }}
          </mat-radio-button>
          <mat-radio-button value="rejected" color="warn">
            <mat-icon class="radio-icon reject-icon">cancel</mat-icon>
            {{ 'admin.moderation.dialog.reject' | translate }}
          </mat-radio-button>
        </mat-radio-group>
      </div>

      <!-- Category editing (visible when approving) -->
      @if (decisionControl.value === 'approved') {
        <div class="category-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'categories.category' | translate }}</mat-label>
            <input matInput
              [formControl]="categoryControl"
              [matAutocomplete]="categoryAuto" />
            <mat-autocomplete #categoryAuto="matAutocomplete" [displayWith]="displayFn">
              @for (option of filteredCategories(); track option.key) {
                <mat-option [value]="option">{{ option.label }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'categories.secondaryCategory' | translate }}</mat-label>
            <input matInput
              [formControl]="secondaryCategoryControl"
              [matAutocomplete]="subcategoryAuto" />
            <mat-autocomplete #subcategoryAuto="matAutocomplete" [displayWith]="displayFn">
              @for (option of filteredSecondaryCategories(); track option.key) {
                <mat-option [value]="option">{{ option.label }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        </div>
      }

      <!-- Note (optional for approve, required for reject) -->
      <mat-form-field appearance="outline" class="full-width note-field">
        <mat-label>
          {{ (decisionControl.value === 'rejected'
            ? 'admin.moderation.dialog.reason'
            : 'admin.moderation.dialog.note') | translate }}
        </mat-label>
        <textarea matInput
          [formControl]="noteControl"
          rows="3"
          maxlength="500"></textarea>
        @if (decisionControl.value === 'rejected' && noteControl.hasError('required') && noteControl.touched) {
          <mat-error>{{ 'admin.moderation.dialog.reasonRequired' | translate }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        {{ 'admin.moderation.dialog.cancel' | translate }}
      </button>
      <button mat-flat-button
        [color]="decisionControl.value === 'rejected' ? 'warn' : 'primary'"
        [disabled]="!canConfirm()"
        (click)="onConfirm()">
        @if (decisionControl.value === 'rejected') {
          <mat-icon>block</mat-icon>
        } @else {
          <mat-icon>check</mat-icon>
        }
        {{ (decisionControl.value === 'rejected'
          ? 'admin.moderation.dialog.reject'
          : 'admin.moderation.dialog.approve') | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 8px;
      mat-icon { color: #1976d2; }
    }
    .sound-summary {
      background: rgba(25, 118, 210, 0.06);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      align-items: center;
      gap: 8px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #666; }
    }
    .summary-title { font-weight: 600; font-size: 1.05rem; }
    .summary-row.secondary {
      margin-top: 6px;
      font-size: 0.9rem;
      color: #666;
    }
    .decision-section {
      margin-bottom: 20px;
      mat-radio-group {
        display: flex;
        gap: 24px;
      }
      mat-radio-button {
        display: flex;
        align-items: center;
      }
    }
    .radio-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
      vertical-align: middle;
    }
    .approve-icon { color: #2e7d32; }
    .reject-icon { color: #c62828; }
    .category-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 8px;
    }
    .full-width { width: 100%; }
    .note-field { margin-top: 4px; }

    :host-context(body.dark-theme) {
      .sound-summary {
        background: rgba(144, 202, 249, 0.08);
      }
      .summary-row.secondary { color: #aaa; }
      .summary-row mat-icon { color: #aaa; }
    }
  `],
})
export class ModerationDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private translate: TranslateService;

  decisionControl = new FormControl<'approved' | 'rejected'>('approved', { nonNullable: true });
  noteControl = new FormControl<string>('');

  categoryControl = new FormControl<Option | null>(null);
  secondaryCategoryControl = new FormControl<Option | null>({ value: null, disabled: true });

  private categories: Option[] = [];
  private secondaryCategories: Option[] = [];
  filteredCategories = signal<Option[]>([]);
  filteredSecondaryCategories = signal<Option[]>([]);

  private originalCategory: string | undefined;
  private originalSecondaryCategory: string | undefined;

  constructor(
    private dialogRef: MatDialogRef<ModerationDialogComponent, ModerationDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ModerationDialogData,
    translate: TranslateService,
  ) {
    this.translate = translate;
  }

  ngOnInit() {
    this.originalCategory = this.data.sound.category;
    this.originalSecondaryCategory = this.data.sound.secondaryCategory;

    this.buildCategories();
    this.setupListeners();

    // Toggle required on note when decision changes
    this.decisionControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      if (v === 'rejected') {
        this.noteControl.setValidators([Validators.required]);
      } else {
        this.noteControl.clearValidators();
      }
      this.noteControl.updateValueAndValidity();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayFn = (option: Option | string | null): string => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    return option.label || '';
  };

  canConfirm(): boolean {
    if (!this.decisionControl.value) return false;
    if (this.decisionControl.value === 'rejected') {
      return !!this.noteControl.value?.trim();
    }
    return true;
  }

  onConfirm() {
    if (!this.canConfirm()) return;

    const decision = this.decisionControl.value;
    const catValue = this.categoryControl.value;
    const subCatValue = this.secondaryCategoryControl.value;
    const catKey = typeof catValue === 'object' && catValue?.key ? catValue.key : this.originalCategory;
    const subCatKey = typeof subCatValue === 'object' && subCatValue?.key ? subCatValue.key : undefined;

    const categoryChanged = decision === 'approved' && (
      catKey !== this.originalCategory || subCatKey !== this.originalSecondaryCategory
    );

    const result: ModerationDialogResult = {
      action: decision!,
      moderationNote: this.noteControl.value?.trim() || undefined,
      categoryChanged,
    };

    if (decision === 'approved') {
      result.category = catKey as CategoryKey;
      result.secondaryCategory = subCatKey;
    }

    this.dialogRef.close(result);
  }

  private buildCategories() {
    this.categories = Object.values(CategoryKey).map((cat) => ({
      key: cat,
      label: this.translate.instant(`categories.${cat}`),
    }));
    this.filteredCategories.set(this.categories);

    // Pre-select current category
    if (this.data.sound.category) {
      const current = this.categories.find((c) => c.key === this.data.sound.category);
      if (current) {
        this.categoryControl.setValue(current);
        this.onCategorySelected(current);

        if (this.data.sound.secondaryCategory) {
          const currentSub = this.secondaryCategories.find(
            (c) => c.key === this.data.sound.secondaryCategory,
          );
          if (currentSub) {
            this.secondaryCategoryControl.setValue(currentSub);
          }
        }
      }
    }
  }

  private onCategorySelected(option: Option | string | null) {
    this.secondaryCategoryControl.reset();
    this.secondaryCategoryControl.disable();

    if (!option || typeof option === 'string') {
      this.secondaryCategories = [];
      this.filteredSecondaryCategories.set([]);
      return;
    }

    this.secondaryCategories = getSubCategoryKeys(option.key as CategoryKey).map((sub) => ({
      key: sub,
      label: this.translate.instant(`categories.${option.key}.${sub}`),
    }));
    this.filteredSecondaryCategories.set(this.secondaryCategories);
    this.secondaryCategoryControl.enable();
  }

  private setupListeners() {
    // Category filter
    this.categoryControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.categories)),
      )
      .subscribe((r) => this.filteredCategories.set(r));

    // Category selection → load subcategories
    this.categoryControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => this.onCategorySelected(v));

    // Subcategory filter
    this.secondaryCategoryControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200),
        distinctUntilChanged(),
        map((v) => this.filterOptions(v, this.secondaryCategories)),
      )
      .subscribe((r) => this.filteredSecondaryCategories.set(r));
  }

  private filterOptions(value: Option | string | null, list: Option[]): Option[] {
    const search =
      typeof value === 'string'
        ? value.toLowerCase()
        : (value?.label?.toLowerCase() ?? '');
    return list.filter((opt) => opt.label.toLowerCase().includes(search));
  }
}
