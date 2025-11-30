import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-card-category',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './card-category.component.html',
  styleUrl: './card-category.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CardCategoryComponent {
  title = input<string>('');
  icon = input<string>('');
}
