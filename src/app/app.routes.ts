import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth-guard.service';
import { HomeComponent } from './features/home/pages/home/home.component';
import { LoginComponent } from './core/pages/auth/login/login.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: '**', redirectTo: 'home' }
];
