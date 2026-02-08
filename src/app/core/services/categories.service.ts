import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CategoryKey, categories, SubCategory } from '../../../../amplify/data/categories';
import { map } from 'rxjs';

export interface CategorySlide {
  key: CategoryKey;
  title: string;
  icon: string;
  background: string;
  color: string;
  accentColor: string;
  overlay: string;
}

@Injectable({
  providedIn: 'root',
})
export class CategoriesService {
  private readonly translate = inject(TranslateService);

private readonly categoryMeta: Record<CategoryKey, { background: string; color: string; accentColor: string }> = {
  ambiancefly:  { background: 'linear-gradient(135deg, #3AE27A, #3ae27a69)', color: '#000000', accentColor: '#3AE27A' },
  animalfly:    { background: 'linear-gradient(135deg, #FF54F9, #ff54f975)', color: '#460143', accentColor: '#FF54F9' },
  foodfly:      { background: 'linear-gradient(135deg, #FFFFC3, #ffffc3d0)', color: '#A0784B', accentColor: '#E8A849' },
  humanfly:     { background: 'linear-gradient(135deg, #FFC1F7, #ffc1f769)', color: '#C00B0B', accentColor: '#FFC1F7' },
  itemfly:      { background: 'linear-gradient(135deg, #000000, #00000054)', color: '#FEFF9F', accentColor: '#888888' },
  musicfly:     { background: 'linear-gradient(135deg, #D60101, #d601015e)', color: '#FFCD1D', accentColor: '#D60101' },
  naturalfly:   { background: 'linear-gradient(135deg, #39AFF7, #39aef769)', color: '#000080', accentColor: '#39AFF7' },
  sportfly:     { background: 'linear-gradient(135deg, #A24C06, #a24c066e)', color: '#00FDFF', accentColor: '#A24C06' },
  transportfly: { background: 'linear-gradient(135deg, #FFFC00, #fffb008e)', color: '#000000', accentColor: '#E8D000' },
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
          overlay: `/img/logos/overlays/layer_control_${key}.png`,
          ...this.categoryMeta[key],
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
