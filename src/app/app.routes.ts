// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth-guard.service';
import { HomeComponent } from './features/home/pages/home/home.component';
import { LoginComponent } from './core/pages/auth/login/login.component';
import { AccountComponent } from './features/users/pages/account/account/account.component';
import { MapflyComponent } from './features/map/pages/mapfly/mapfly.component';
import { NewSoundComponent } from './features/new-sound/pages/new-sound/new-sound.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent },
  { path: 'account', component: AccountComponent, canActivate: [authGuard] },
  { path: 'new-sound', component: NewSoundComponent, canActivate: [authGuard] },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin/database',
    loadChildren: () =>
      import('./features/admin/database/database.routes').then(
        (m) => m.DATABASE_ROUTES,
      ),
    canActivate: [authGuard],
    data: { requiredGroup: 'ADMIN' },
  },

  { path: 'login', component: LoginComponent },
  { path: 'mapfly', component: MapflyComponent },
  { path: '**', redirectTo: 'home' },
];
