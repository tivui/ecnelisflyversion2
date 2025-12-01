import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CardCategoryComponent } from "../card-category/card-category.component";

@Component({
  selector: 'app-carousel-categories',
  standalone: true,
  imports: [CardCategoryComponent],
  templateUrl: './carousel-categories.component.html',
  styleUrl: './carousel-categories.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CarouselCategoriesComponent {
  slides = Array.from({ length: 9 }).map((_, i) => ({
    title: `Catégorie ${i + 1}`,
    icon: 'home',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSwiperInit(swiper: any) {
  // Force Swiper à relire la largeur du parent et recalculer les breakpoints
  setTimeout(() => {
    swiper.update();
  }, 50);
}
}
