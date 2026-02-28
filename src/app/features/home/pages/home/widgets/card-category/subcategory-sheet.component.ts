import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CategoryKey } from '../../../../../../../../amplify/data/categories';
import { Subscription, debounceTime, distinctUntilChanged, map } from 'rxjs';

export interface SubCategoryOption {
  key: string;
  label: string;
}

export interface SubcategorySheetData {
  category: CategoryKey;
  categoryTitle: string;
  accentColor: string;
  overlay: string;
  lists: SubCategoryOption[];
}

@Component({
    selector: 'app-subcategory-sheet',
    imports: [
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule,
        TranslatePipe,
    ],
    template: `
    <div class="sheet-container">
      <div class="sheet-handle"></div>

      <div class="sheet-header">
        <img [src]="data.overlay" [alt]="data.categoryTitle" class="sheet-overlay" />
        <span class="sheet-dot" [style.background]="data.accentColor"></span>
        <span class="sheet-title">{{ data.categoryTitle }}</span>
      </div>

      <button mat-button class="sheet-explore-all" (click)="goToCategory()">
        <mat-icon>explore</mat-icon>
        {{ 'categories.exploreAll' | translate }}
      </button>

      <mat-form-field class="sheet-search" appearance="outline">
        <mat-icon matPrefix>search</mat-icon>
        <input
          matInput
          [formControl]="searchControl"
          [placeholder]="'categories.searchPlaceholder' | translate"
        />
      </mat-form-field>

      <div class="sheet-list">
        @for (opt of filteredLists; track opt.key) {
          <button class="sheet-item" (click)="goToSubCategory(opt)">
            <span class="item-dot" [style.background]="data.accentColor"></span>
            <span class="item-label">{{ opt.label }}</span>
            <mat-icon class="item-arrow">chevron_right</mat-icon>
          </button>
        } @empty {
          <div class="sheet-empty">{{ 'categories.noResult' | translate }}</div>
        }
      </div>
    </div>
  `,
    styles: [`
    .sheet-container {
      padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
      max-height: 70vh;
      display: flex;
      flex-direction: column;
    }

    .sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.15);
      margin: 0 auto 12px;
      flex-shrink: 0;
    }

    :host-context(body.dark-theme) .sheet-handle {
      background: rgba(255, 255, 255, 0.15);
    }

    .sheet-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      margin-bottom: 4px;
      flex-shrink: 0;
    }

    :host-context(body.dark-theme) .sheet-header {
      border-color: rgba(255, 255, 255, 0.08);
    }

    .sheet-overlay {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      object-fit: cover;
    }

    .sheet-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .sheet-title {
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a2e;
      flex: 1;
    }

    :host-context(body.dark-theme) .sheet-title {
      color: #e8e8f0;
    }

    .sheet-explore-all {
      width: 100%;
      justify-content: flex-start;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #1976d2;
      border-radius: 8px;
      flex-shrink: 0;
    }

    :host-context(body.dark-theme) .sheet-explore-all {
      color: #64b5f6;
    }

    .sheet-search {
      width: 100%;
      flex-shrink: 0;
    }

    .sheet-list {
      overflow-y: auto;
      flex: 1;
      -webkit-overflow-scrolling: touch;
    }

    .sheet-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 8px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 8px;
      transition: background 0.15s;
      text-align: left;
    }

    .sheet-item:active {
      background: rgba(0, 0, 0, 0.04);
    }

    :host-context(body.dark-theme) .sheet-item:active {
      background: rgba(255, 255, 255, 0.06);
    }

    .item-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      opacity: 0.6;
    }

    .item-label {
      flex: 1;
      font-size: 0.88rem;
      color: #2c2c3a;
    }

    :host-context(body.dark-theme) .item-label {
      color: #e0e0ec;
    }

    .item-arrow {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #ccc;
      flex-shrink: 0;
    }

    :host-context(body.dark-theme) .item-arrow {
      color: #555;
    }

    .sheet-empty {
      padding: 24px;
      text-align: center;
      font-size: 0.85rem;
      color: #999;
    }
  `]
})
export class SubcategorySheetComponent implements OnInit, OnDestroy {
  data = inject<SubcategorySheetData>(MAT_BOTTOM_SHEET_DATA);
  private sheetRef = inject(MatBottomSheetRef);
  private router = inject(Router);

  searchControl = new FormControl<string>('');
  filteredLists: SubCategoryOption[] = [];
  private sub!: Subscription;

  ngOnInit() {
    this.filteredLists = this.data.lists;

    this.sub = this.searchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map(value => {
        const search = (value ?? '').toLowerCase();
        return this.data.lists.filter(opt =>
          opt.label.toLowerCase().includes(search)
        );
      })
    ).subscribe(result => {
      this.filteredLists = result;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  goToCategory() {
    this.sheetRef.dismiss();
    this.router.navigate(['/mapfly'], {
      queryParams: { category: this.data.category },
    });
  }

  goToSubCategory(opt: SubCategoryOption) {
    this.sheetRef.dismiss();
    this.router.navigate(['/mapfly'], {
      queryParams: {
        category: this.data.category,
        secondaryCategory: opt.key,
      },
    });
  }
}
