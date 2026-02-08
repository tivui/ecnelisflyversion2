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
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { SubcategorySheetComponent, SubcategorySheetData } from '../card-category/subcategory-sheet.component';
import { CategoryKey, getSubCategoryKeys } from '../../../../../../../../amplify/data/categories';

@Component({
  selector: 'app-carousel-categories',
  standalone: true,
  imports: [CardCategoryComponent, MatBottomSheetModule],
  templateUrl: './carousel-categories.component.html',
  styleUrl: './carousel-categories.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CarouselCategoriesComponent {
  private readonly categoriesService = inject(CategoriesService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bottomSheet = inject(MatBottomSheet);

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

  onPastilleTap(slide: CategorySlide) {
    const lists = getSubCategoryKeys(slide.key as CategoryKey).map(sub => ({
      key: sub,
      label: this.translate.instant(`categories.${slide.key}.${sub}`),
    }));

    this.bottomSheet.open(SubcategorySheetComponent, {
      data: {
        category: slide.key as CategoryKey,
        categoryTitle: slide.title,
        accentColor: slide.accentColor,
        overlay: slide.overlay,
        lists,
      } as SubcategorySheetData,
      panelClass: 'subcategory-sheet-panel',
    });
  }
}
