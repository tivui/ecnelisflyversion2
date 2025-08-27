import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await auth.loadCurrentUser();
  if (!user) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  return true;
};
