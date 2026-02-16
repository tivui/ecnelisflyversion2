import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { TranslateModule } from '@ngx-translate/core';

export interface CategoryToggle {
  key: string;
  labelKey: string;
  iconUrl: string;
  enabled: boolean;
}

export interface TimeFilterSheetData {
  current: 'all' | 'latest10' | 'week' | 'month';
  counts: { all: number; latest10: number; week: number; month: number };
  hasWeek: boolean;
  hasMonth: boolean;
  categories: CategoryToggle[];
  onTimeFilterChange: (filter: 'all' | 'latest10' | 'week' | 'month') => void;
  onCategoryToggle: (key: string, enabled: boolean) => void;
  onCategoryToggleAll: (enabled: boolean) => void;
}

interface FilterOption {
  key: 'all' | 'latest10' | 'week' | 'month';
  icon: string;
  labelKey: string;
  count?: number;
}

@Component({
  selector: 'app-time-filter-sheet',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    <div class="filter-sheet">
      <!-- Period section -->
      <div class="sheet-section-header">
        <mat-icon class="section-icon">schedule</mat-icon>
        <span>{{ 'mapfly.timeFilter.title' | translate }}</span>
      </div>
      <div class="sheet-options">
        @for (opt of options; track opt.key) {
          <button
            class="sheet-option"
            [class.active]="opt.key === selectedTime()"
            (click)="selectTime(opt.key)"
          >
            <mat-icon class="option-icon">{{ opt.icon }}</mat-icon>
            <span class="option-label">{{ opt.labelKey | translate }}</span>
            @if (opt.count !== undefined) {
              <span class="option-count">{{ opt.count }}</span>
            }
            @if (opt.key === selectedTime()) {
              <mat-icon class="option-check">check_circle</mat-icon>
            }
          </button>
        }
      </div>

      <!-- Categories section -->
      <div class="sheet-section-header section-categories">
        <mat-icon class="section-icon">layers</mat-icon>
        <span>{{ 'mapfly.filter.categories' | translate }}</span>
        <button class="toggle-all-btn" (click)="toggleAllCategories()">
          {{ allEnabled() ? ('mapfly.filter.hideAll' | translate) : ('mapfly.filter.showAll' | translate) }}
        </button>
      </div>
      <div class="sheet-categories">
        @for (cat of cats(); track cat.key) {
          <button
            class="category-row"
            [class.disabled]="!cat.enabled"
            (click)="toggleCategory(cat.key)"
          >
            <img [src]="cat.iconUrl" class="category-icon" width="28" height="28" />
            <span class="category-label">{{ cat.labelKey | translate }}</span>
            <div class="category-toggle" [class.on]="cat.enabled">
              <div class="toggle-knob"></div>
            </div>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .filter-sheet {
      padding: 4px 0 16px;
      max-height: 70vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .sheet-section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px 8px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #1976d2;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      .section-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .section-categories {
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      margin-top: 4px;
      padding-top: 14px;
    }

    :host-context(body.dark-theme) .sheet-section-header {
      color: #90caf9;
    }

    :host-context(body.dark-theme) .section-categories {
      border-top-color: rgba(255, 255, 255, 0.08);
    }

    .toggle-all-btn {
      margin-left: auto;
      background: none;
      border: 1px solid rgba(25, 118, 210, 0.20);
      border-radius: 8px;
      padding: 4px 12px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #1976d2;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;

      &:active { opacity: 0.7; }
    }

    :host-context(body.dark-theme) .toggle-all-btn {
      color: #90caf9;
      border-color: rgba(144, 202, 249, 0.20);
    }

    .sheet-options {
      display: flex;
      flex-direction: column;
      padding: 4px 12px;
      gap: 2px;
    }

    .sheet-option {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border: none;
      border-radius: 12px;
      background: transparent;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.92rem;
      font-weight: 500;
      color: #444;
      transition: background 0.15s ease;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      min-height: 44px;

      &:active { background: rgba(25, 118, 210, 0.06); }
      &.active {
        background: rgba(25, 118, 210, 0.08);
        color: #1976d2;
        font-weight: 600;
      }
    }

    :host-context(body.dark-theme) .sheet-option {
      color: #e8eaf6;
      &:active { background: rgba(92, 107, 192, 0.12); }
      &.active { background: rgba(25, 118, 210, 0.18); color: #90caf9; }
    }

    .option-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #888;
    }

    .sheet-option.active .option-icon { color: #1976d2; }
    :host-context(body.dark-theme) .option-icon { color: #cfd8dc; }
    :host-context(body.dark-theme) .sheet-option.active .option-icon { color: #90caf9; }

    .option-label { flex: 1; text-align: left; }

    .option-count {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.05);
      color: #888;
    }

    .sheet-option.active .option-count {
      background: rgba(25, 118, 210, 0.12);
      color: #1976d2;
    }

    :host-context(body.dark-theme) .option-count {
      background: rgba(255, 255, 255, 0.12);
      color: #e0e0e0;
    }

    :host-context(body.dark-theme) .sheet-option.active .option-count {
      background: rgba(25, 118, 210, 0.25);
      color: #90caf9;
    }

    .option-check {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #1976d2;
    }

    :host-context(body.dark-theme) .option-check { color: #90caf9; }

    /* ---- Categories ---- */
    .sheet-categories {
      display: flex;
      flex-direction: column;
      padding: 4px 12px 8px;
      gap: 2px;
    }

    .category-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border: none;
      border-radius: 12px;
      background: transparent;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      transition: background 0.15s ease, opacity 0.2s ease;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      min-height: 44px;

      &:active { background: rgba(0, 0, 0, 0.04); }
      &.disabled { opacity: 0.45; }
    }

    :host-context(body.dark-theme) .category-row {
      &:active { background: rgba(255, 255, 255, 0.06); }
    }

    .category-icon {
      border-radius: 6px;
      flex-shrink: 0;
    }

    .category-label {
      flex: 1;
      text-align: left;
      font-size: 0.88rem;
      font-weight: 500;
      color: #444;
    }

    :host-context(body.dark-theme) .category-label { color: #e8eaf6; }

    .category-toggle {
      width: 40px;
      height: 22px;
      border-radius: 11px;
      background: #ccc;
      position: relative;
      transition: background 0.2s ease;
      flex-shrink: 0;

      &.on { background: #1976d2; }
    }

    :host-context(body.dark-theme) .category-toggle {
      background: #555;
      &.on { background: #5c9bd6; }
    }

    .toggle-knob {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

      .on & { transform: translateX(18px); }
    }
  `],
})
export class TimeFilterSheetComponent {
  data = inject<TimeFilterSheetData>(MAT_BOTTOM_SHEET_DATA);
  private sheetRef = inject(MatBottomSheetRef);

  options: FilterOption[] = this.buildOptions();
  selectedTime = signal(this.data.current);
  cats = signal<CategoryToggle[]>(this.data.categories.map(c => ({ ...c })));

  allEnabled() {
    return this.cats().every(c => c.enabled);
  }

  private buildOptions(): FilterOption[] {
    const opts: FilterOption[] = [
      { key: 'all', icon: 'public', labelKey: 'mapfly.timeFilter.all', count: this.data.counts.all },
      { key: 'latest10', icon: 'new_releases', labelKey: 'mapfly.timeFilter.latest10' },
    ];
    if (this.data.hasWeek) {
      opts.push({ key: 'week', icon: 'date_range', labelKey: 'mapfly.timeFilter.week', count: this.data.counts.week });
    }
    if (this.data.hasMonth) {
      opts.push({ key: 'month', icon: 'calendar_month', labelKey: 'mapfly.timeFilter.month', count: this.data.counts.month });
    }
    return opts;
  }

  selectTime(key: 'all' | 'latest10' | 'week' | 'month') {
    this.selectedTime.set(key);
    this.data.onTimeFilterChange(key);
  }

  toggleCategory(key: string) {
    this.cats.update(list =>
      list.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c)
    );
    const cat = this.cats().find(c => c.key === key);
    if (cat) this.data.onCategoryToggle(key, cat.enabled);
  }

  toggleAllCategories() {
    const newState = !this.allEnabled();
    this.cats.update(list => list.map(c => ({ ...c, enabled: newState })));
    this.data.onCategoryToggleAll(newState);
  }
}
