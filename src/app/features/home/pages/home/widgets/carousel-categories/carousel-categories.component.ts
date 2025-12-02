import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  inject,
} from '@angular/core';
import { CardCategoryComponent } from '../card-category/card-category.component';
import {
  CategoriesService,
  CategorySlide,
} from '../../../../../../core/services/categories.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-carousel-categories',
  standalone: true,
  imports: [CardCategoryComponent],
  templateUrl: './carousel-categories.component.html',
  styleUrl: './carousel-categories.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CarouselCategoriesComponent {
  private readonly categoriesService = inject(CategoriesService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  public slides: CategorySlide[] = [];

  constructor() {
    // Load initial slides
    this.loadSlides();

    // Listen to language changes
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadSlides();
      });
  }

  private loadSlides() {
    this.categoriesService
      .getSlides()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((slides) => {
        this.slides = slides;
      });
  }
}
