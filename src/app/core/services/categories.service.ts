import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CategoryKey, categories, SubCategory } from '../../../../amplify/data/categories';
import { map } from 'rxjs';

export interface CategorySlide {
  key: CategoryKey;
  title: string;
  icon: string;
  background: string; // peut être un dégradé
  color: string;      // texte
}

@Injectable({
  providedIn: 'root',
})
export class CategoriesService {
  private readonly translate = inject(TranslateService);

private readonly categorySlideTitlesColors: Record<CategoryKey, { background: string; color: string }> = {
  musicfly: { background: 'linear-gradient(135deg, #D60101, #d601015e)', color: '#FFCD1D' },
  ambiancefly: { background: 'linear-gradient(135deg, #3AE27A, #3ae27a69)', color: '#000000' },
  itemfly: { background: 'linear-gradient(135deg, #000000, #00000054)', color: '#FEFF9F' },
  sportfly: { background: 'linear-gradient(135deg, #A24C06, #a24c066e)', color: '#00FDFF' },
  animalfly: { background: 'linear-gradient(135deg, #FF54F9, #ff54f975)', color: '#460143' },
  humanfly: { background: 'linear-gradient(135deg, #FFC1F7, #ffc1f769)', color: '#C00B0B' },
  naturalfly: { background: 'linear-gradient(135deg, #39AFF7, #39aef769)', color: '#000080' },
  foodfly: { background: 'linear-gradient(135deg, #FFFFC3, #ffffc3d0)', color: '#A0784B' },
  transportfly: { background: 'linear-gradient(135deg, #FFFC00, #fffb008e)', color: '#000000' },
};

  getLabel(key: CategoryKey): string {
    return this.translate.instant(`categories.${key}`);
  }

  getSlides() {
    const keys = Object.values(CategoryKey);
    return this.translate.get(keys.map(k => `categories.${k}`)).pipe(
      map(translations =>
        keys.map(key => ({
          key,
          title: translations[`categories.${key}`],
          icon: 'home',
          ...this.categorySlideTitlesColors[key],
        }))
      )
    );
  }

  /**
   * Get all main categories
   */
  getAllCategories(): { key: CategoryKey; label: string }[] {
    return Object.values(CategoryKey).map(key => ({
      key,
      label: key,
    }));
  }

  /**
   * Get subcategories for a given main category
   */
  getSubCategories(categoryKey: CategoryKey): SubCategory[] {
    return categories[categoryKey]?.subcategories ?? [];
  }
}
