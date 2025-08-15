import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TodosComponent } from './todos/todos.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [RouterOutlet, TodosComponent, CommonModule, MatToolbarModule, MatSlideToggleModule, MatIconModule],
})
export class AppComponent {
  title = 'ecnelisflyv2';

  // Déclaration d’un signal
  isDark = signal(false);

  toggleDarkMode() {
    const dark = !this.isDark();
    this.isDark.set(dark);

    const body = document.body;
    body.classList.toggle('dark-theme', dark);
    body.classList.toggle('light-theme', !dark);
  }
}
