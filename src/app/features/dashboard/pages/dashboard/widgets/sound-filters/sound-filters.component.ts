import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { CategoriesService } from '../../../../../../core/services/categories.service';
import { CategoryKey } from '../../../../../../../../amplify/data/categories';
import { SoundStatus } from '../../../../../../core/models/sound.model';
import {
  DEFAULT_FILTERS,
  SoundFilters,
} from '../../../../models/sound-filters.model';
import { countActiveFilters } from '../../../../utils/sound-filter.utils';

interface CategoryOption {
  key: string;
  label: string;
}

@Component({
    selector: 'app-sound-filters',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatAutocompleteModule,
        MatDatepickerModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatBadgeModule,
        MatTooltipModule,
        TranslateModule,
    ],
    templateUrl: './sound-filters.component.html',
    styleUrl: './sound-filters.component.scss',
    providers: [provideNativeDateAdapter()],
    animations: [
        trigger('slideDown', [
            transition(':enter', [
                style({ height: 0, opacity: 0, overflow: 'hidden' }),
                animate('200ms ease-out', style({ height: '*', opacity: 1 })),
            ]),
            transition(':leave', [
                style({ height: '*', opacity: 1, overflow: 'hidden' }),
                animate('150ms ease-in', style({ height: 0, opacity: 0 })),
            ]),
        ]),
    ]
})
export class SoundFiltersComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly categoriesService = inject(CategoriesService);

  @Input() showStatusFilter = true;
  @Output() filtersChanged = new EventEmitter<SoundFilters>();

  // Signals
  expanded = signal(false);
  activeFilterCount = signal(0);
  favoritesOnly = signal(false);

  // Form
  filterForm = new FormGroup({
    searchQuery: new FormControl(''),
    category: new FormControl<CategoryOption | null>(null),
    secondaryCategory: new FormControl<CategoryOption | null>(null),
    status: new FormControl<SoundStatus | null>(null),
    dateStart: new FormControl<Date | null>(null),
    dateEnd: new FormControl<Date | null>(null),
  });

  // Category options
  categoryOptions: CategoryOption[] = [];
  filteredCategories: CategoryOption[] = [];
  secondaryCategoryOptions: CategoryOption[] = [];
  filteredSecondaryCategories: CategoryOption[] = [];

  // Status options
  statusOptions: { value: SoundStatus; label: string }[] = [
    { value: 'private', label: 'dashboard.status.private' },
    { value: 'public_to_be_approved', label: 'dashboard.status.public_to_be_approved' },
    { value: 'public', label: 'dashboard.status.public' },
  ];

  ngOnInit() {
    this.loadCategories();
    this.setupFormSubscriptions();
    // Start with secondary category disabled (no primary category selected)
    this.filterForm.controls.secondaryCategory.disable();
  }

  private loadCategories() {
    const categories = this.categoriesService.getAllCategories();
    this.categoryOptions = categories.map((cat) => ({
      key: cat.key,
      label: this.translate.instant(`categories.${cat.key}`),
    }));
    this.filteredCategories = [...this.categoryOptions];
  }

  private setupFormSubscriptions() {
    // Search with debounce
    this.filterForm.controls.searchQuery.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.emitFilters());

    // Category change - load secondary categories
    this.filterForm.controls.category.valueChanges.subscribe((category) => {
      // category can be a CategoryOption (from autocomplete selection) or a string (from typing)
      const categoryKey = typeof category === 'object' && category?.key
        ? category.key as CategoryKey
        : undefined;
      this.updateSecondaryCategories(categoryKey);
      this.filterForm.controls.secondaryCategory.setValue(null);
      // Programmatically enable/disable secondary category (avoid [disabled] on reactive form inputs)
      if (categoryKey) {
        this.filterForm.controls.secondaryCategory.enable();
      } else {
        this.filterForm.controls.secondaryCategory.disable();
      }
      this.emitFilters();
    });

    // Other filters - immediate emit
    this.filterForm.controls.secondaryCategory.valueChanges.subscribe(() =>
      this.emitFilters()
    );
    this.filterForm.controls.status.valueChanges.subscribe(() =>
      this.emitFilters()
    );
    this.filterForm.controls.dateStart.valueChanges.subscribe(() =>
      this.emitFilters()
    );
    this.filterForm.controls.dateEnd.valueChanges.subscribe(() =>
      this.emitFilters()
    );
  }

  private updateSecondaryCategories(categoryKey?: CategoryKey) {
    if (!categoryKey) {
      this.secondaryCategoryOptions = [];
      this.filteredSecondaryCategories = [];
      return;
    }

    const subCategories = this.categoriesService.getSubCategories(categoryKey);
    this.secondaryCategoryOptions = subCategories.map((sub) => ({
      key: sub.key,
      label: this.translate.instant(`categories.${categoryKey}.${sub.key}`),
    }));
    this.filteredSecondaryCategories = [...this.secondaryCategoryOptions];
  }

  private emitFilters() {
    // Read control values directly (formGroup.value excludes disabled controls)
    const controls = this.filterForm.controls;
    const filters: SoundFilters = {
      searchQuery: controls.searchQuery.value || '',
      category: this.extractCategoryKey(controls.category.value),
      secondaryCategory: this.extractSecondaryKey(controls.secondaryCategory.value),
      status: controls.status.value || null,
      dateRange: {
        start: controls.dateStart.value || null,
        end: controls.dateEnd.value || null,
      },
      favoritesOnly: this.favoritesOnly(),
    };

    this.activeFilterCount.set(countActiveFilters(filters));
    this.filtersChanged.emit(filters);
  }

  // Autocomplete filter functions
  filterCategories(value: string) {
    const filterValue = value.toLowerCase();
    this.filteredCategories = this.categoryOptions.filter((opt) =>
      opt.label.toLowerCase().includes(filterValue)
    );
  }

  filterSecondaryCategories(value: string) {
    const filterValue = value.toLowerCase();
    this.filteredSecondaryCategories = this.secondaryCategoryOptions.filter(
      (opt) => opt.label.toLowerCase().includes(filterValue)
    );
  }

  // Extract category key from value (handles both CategoryOption object and raw string from autocomplete)
  private extractCategoryKey(value: CategoryOption | string | null): CategoryKey | null {
    if (!value) return null;
    if (typeof value === 'object' && value.key) return value.key as CategoryKey;
    if (typeof value === 'string') {
      const match = this.categoryOptions.find(o => o.label === value);
      return (match?.key as CategoryKey) || null;
    }
    return null;
  }

  private extractSecondaryKey(value: CategoryOption | string | null): string | null {
    if (!value) return null;
    if (typeof value === 'object' && value.key) return value.key;
    if (typeof value === 'string') {
      const match = this.secondaryCategoryOptions.find(o => o.label === value);
      return match?.key || null;
    }
    return null;
  }

  displayFn = (option: CategoryOption | string | null): string => {
    if (!option) return '';
    // mat-autocomplete can overwrite the CategoryOption with a raw string on blur
    if (typeof option === 'string') return option;
    return option.label || '';
  };

  toggleExpanded() {
    this.expanded.update((v) => !v);
  }

  toggleFavorites() {
    this.favoritesOnly.update((v) => !v);
    this.emitFilters();
  }

  resetFilters() {
    this.filterForm.reset();
    this.filterForm.controls.secondaryCategory.disable();
    this.favoritesOnly.set(false);
    this.emitFilters();
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount() > 0;
  }

  // Remove individual filter
  removeSearchFilter() {
    this.filterForm.controls.searchQuery.setValue('');
  }

  removeCategoryFilter() {
    this.filterForm.controls.category.setValue(null);
  }

  removeSecondaryFilter() {
    this.filterForm.controls.secondaryCategory.setValue(null);
  }

  removeStatusFilter() {
    this.filterForm.controls.status.setValue(null);
  }

  removeDateFilter() {
    this.filterForm.controls.dateStart.setValue(null);
    this.filterForm.controls.dateEnd.setValue(null);
  }
}
