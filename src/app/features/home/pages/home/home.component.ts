import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

// Amplify Storage test
import { RouterLink } from '@angular/router';
import { CarouselCategoriesComponent } from "./widgets/carousel-categories/carousel-categories.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TranslatePipe, RouterLink, CarouselCategoriesComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomeComponent {
  private readonly appUserService = inject(AppUserService);

  public appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

}
