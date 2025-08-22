import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly appUserService = inject(AppUserService);

  // Observable of the current AppUser
    public appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, { initialValue: null });

}
