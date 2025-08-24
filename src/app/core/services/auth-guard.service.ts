import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AppUserService } from './app-user.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const appUserService = inject(AppUserService);

  const user = await auth.loadCurrentUser();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // ⚡ Charger le profil complet en arrière-plan
  appUserService.loadCurrentUser().catch((err) => {
    console.error('Failed to load full AppUser', err);
  });

  return true;
};
