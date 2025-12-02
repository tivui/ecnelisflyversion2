import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CategoryKey } from '../../../../amplify/data/categories';
import { map } from 'rxjs';

export interface CategorySlide {
  key: string;
  title: string;
  icon: string;
}

@Injectable({
  providedIn: 'root',
})
export class CategoriesService {
  private readonly translate = inject(TranslateService);

  /**
   * Get translated name of a category
   * @param key
   * @returns
   */
  getLabel(key: CategoryKey): string {
    return this.translate.instant(`categories.${key}`);
  }

  getSlides() {
  const keys = Object.values(CategoryKey);

  return this.translate.get(
    keys.map(k => `categories.${k}`)
  ).pipe(
    map(translations =>
      keys.map(key => ({
        key,
        title: translations[`categories.${key}`],
        icon: 'home'
      }))
    )
  );
}
}
