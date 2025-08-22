import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth-guard.service';
import { HomeComponent } from './features/home/pages/home/home.component';

export const routes: Routes = [
  {
    path: '', component: HomeComponent, canActivate: [authGuard]
  }
];
