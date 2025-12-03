import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-card-category',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './card-category.component.html',
  styleUrl: './card-category.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CardCategoryComponent {
  title = input.required<string>();
  category = input.required<string>();
  icon = input<string>('');

  private readonly router = inject(Router);

  goToMapflyCategory() {
    this.router.navigate(['/mapfly'], {
      queryParams: {
        category: this.category(),
      },
    });
  }
}
