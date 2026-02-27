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
    path: 'admin/dashboard',
    loadComponent: () =>
      import('./features/admin/pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
    canActivate: [authGuard],
    data: { requiredGroup: 'ADMIN' },
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
  {
    path: 'zones',
    loadComponent: () =>
      import('./features/zones/pages/zones-list/zones-list.component').then(
        (m) => m.ZonesListComponent,
      ),
  },
  {
    path: 'journeys',
    loadComponent: () =>
      import('./features/journeys/pages/journeys-list/journeys-list.component').then(
        (m) => m.JourneysListComponent,
      ),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./features/categories/pages/categories-list/categories-list.component').then(
        (m) => m.CategoriesListComponent,
      ),
  },

  // Article routes (public)
  {
    path: 'articles',
    loadComponent: () =>
      import('./features/articles/pages/article-list/article-list.component').then(
        (m) => m.ArticleListComponent,
      ),
  },
  {
    path: 'articles/:slug',
    loadComponent: () =>
      import('./features/articles/pages/article-detail/article-detail.component').then(
        (m) => m.ArticleDetailComponent,
      ),
  },

  // Quiz routes (public - no authGuard, guest mode supported)
  {
    path: 'quiz',
    loadComponent: () =>
      import('./features/quiz/pages/quiz-list/quiz-list.component').then(
        (m) => m.QuizListComponent,
      ),
  },
  {
    path: 'quiz/my-scores',
    loadComponent: () =>
      import('./features/quiz/pages/my-scores/my-scores.component').then(
        (m) => m.MyScoresComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'quiz/:id',
    loadComponent: () =>
      import('./features/quiz/pages/quiz-lobby/quiz-lobby.component').then(
        (m) => m.QuizLobbyComponent,
      ),
  },
  {
    path: 'quiz/:id/play',
    loadComponent: () =>
      import('./features/quiz/pages/quiz-play/quiz-play.component').then(
        (m) => m.QuizPlayComponent,
      ),
  },
  {
    path: 'quiz/:id/results/:attemptId',
    loadComponent: () =>
      import('./features/quiz/pages/quiz-results/quiz-results.component').then(
        (m) => m.QuizResultsComponent,
      ),
  },
  {
    path: 'quiz/:id/review/:attemptId',
    loadComponent: () =>
      import('./features/quiz/pages/quiz-review/quiz-review.component').then(
        (m) => m.QuizReviewComponent,
      ),
  },

  {
    path: 'support',
    loadComponent: () =>
      import('./features/support/support.component').then(
        (m) => m.SupportComponent,
      ),
  },
  {
    path: 'guide',
    loadComponent: () =>
      import('./features/guide/guide.component').then(
        (m) => m.GuideComponent,
      ),
  },
  {
    path: 'legal',
    loadComponent: () =>
      import('./features/legal/legal.component').then(
        (m) => m.LegalComponent,
      ),
  },
  {
    path: 'admin/guide',
    loadComponent: () =>
      import('./features/admin/pages/admin-guide/admin-guide.component').then(
        (m) => m.AdminGuideComponent,
      ),
    canActivate: [authGuard],
    data: { requiredGroup: 'ADMIN' },
  },

  {
    path: '**',
    loadComponent: () =>
      import('./core/pages/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
