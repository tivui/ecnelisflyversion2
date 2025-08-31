import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth-guard.service';
import { HomeComponent } from './features/home/pages/home/home.component';
import { LoginComponent } from './core/pages/auth/login/login.component';
import { AccountComponent } from './features/users/pages/account/account/account.component';
import { ImportSoundsComponent } from './features/admin/database/import-sounds/import-sounds.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent },
  { path: 'account', component: AccountComponent, canActivate: [authGuard] },
  { path: 'admin/database/import-sounds', component: ImportSoundsComponent, canActivate: [authGuard], data: { requiredGroup: 'ADMIN' } },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: 'home' }
];
