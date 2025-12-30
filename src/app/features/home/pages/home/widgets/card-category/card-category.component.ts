import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  input,
  OnInit,
  OnDestroy
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { CategoryKey, getSubCategoryKeys } from '../../../../../../../../amplify/data/categories';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, debounceTime, distinctUntilChanged, map } from 'rxjs';

interface SubCategoryOption {
  key: string;
  label: string;
}

@Component({
  selector: 'app-card-category',
  standalone: true,
  imports: [
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
  ],
  templateUrl: './card-category.component.html',
  styleUrl: './card-category.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CardCategoryComponent implements OnInit, OnDestroy {

  title = input.required<string>();
  category = input.required<CategoryKey>();
  icon = input<string>('');
  background = input.required<string>();
  color = input.required<string>();

  private router = inject(Router);
  private translate = inject(TranslateService);

  subCategoryControl = new FormControl<string>('');
  lists: SubCategoryOption[] = [];
  filteredLists: SubCategoryOption[] = [];
  private sub!: Subscription;

  ngOnInit() {
    // Crée la liste complète avec labels traduits
    this.lists = getSubCategoryKeys(this.category()).map(sub => ({
      key: sub,
      label: this.translate.instant(`categories.${this.category()}.${sub}`)
    }));

    // Initialisation du filtrage
    this.filteredLists = this.lists;

    // Ecoute des changements pour filtrage dynamique
    this.sub = this.subCategoryControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map(value => {
        const search = (value as string)?.toLowerCase() ?? '';
        return this.lists.filter(opt =>
          opt.label.toLowerCase().includes(search)
        );
      })
    ).subscribe(result => {
      this.filteredLists = result;
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  displayFn(value: SubCategoryOption | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.label;
  }

  onSelectSubCategory(option: SubCategoryOption) {
    this.router.navigate(['/mapfly'], {
      queryParams: {
        category: this.category(),
        secondaryCategory: option.key,
      },
    });
  }

  goToMapflyCategory() {
    this.router.navigate(['/mapfly'], {
      queryParams: { category: this.category() },
    });
  }
}
