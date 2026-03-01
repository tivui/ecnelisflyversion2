import { Component, DestroyRef, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  CategoriesService,
  CategorySlide,
} from '../../../../core/services/categories.service';
import { CardCategoryComponent } from '../../../home/pages/home/widgets/card-category/card-category.component';

@Component({
    selector: 'app-categories-list',
    imports: [
        TranslateModule,
        MatIconModule,
        CardCategoryComponent,
    ],
    templateUrl: './categories-list.component.html',
    styleUrl: './categories-list.component.scss'
})
export class CategoriesListComponent {
  private readonly categoriesService = inject(CategoriesService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  categories = signal<CategorySlide[]>([]);

  constructor() {
    this.loadCategories();

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCategories());
  }

  private loadCategories() {
    this.categoriesService
      .getSlides()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((slides) => this.categories.set(slides));
  }
}
