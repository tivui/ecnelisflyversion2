import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService, CognitoGroup } from './auth.service';

export const authGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // 1. Check if user is authenticated
  const user = await auth.loadCurrentUser();
  if (!user) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  // 2. Check if the route requires a specific group
  const requiredGroup = route.data['requiredGroup'] as string | undefined;
  if (requiredGroup && !auth.isInGroup(requiredGroup as CognitoGroup)) {
    // Redirect to home if user is not in required group
    router.navigate(['/home'], { replaceUrl: true });
    return false;
  }

  return true;
};
