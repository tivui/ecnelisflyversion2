import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly appUserService = inject(AppUserService);

  // Observable of the current AppUser
    public appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, { initialValue: null });

}
