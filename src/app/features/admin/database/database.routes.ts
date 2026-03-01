import { Routes } from '@angular/router';
import { DatabaseComponent } from '../pages/database.component';

export const DATABASE_ROUTES: Routes = [
  {
    path: '',
    component: DatabaseComponent,
    children: [
      {
        path: 'import-sounds',
        loadComponent: () =>
          import('../pages/import-sounds/import-sounds.component').then(
            (m) => m.ImportSoundsComponent,
          ),
      },
      {
        path: 'zones',
        loadComponent: () =>
          import('../pages/zones/zones.component').then(
            (m) => m.ZonesComponent,
          ),
      },
      {
        path: 'featured-sound',
        loadComponent: () =>
          import('../pages/featured-sound/featured-sound.component').then(
            (m) => m.FeaturedSoundComponent,
          ),
      },
      {
        path: 'journeys',
        loadComponent: () =>
          import('../pages/journeys/journeys.component').then(
            (m) => m.JourneysComponent,
          ),
      },
      {
        path: 'quizzes',
        loadComponent: () =>
          import('../pages/quizzes/quiz-admin-list/quiz-admin-list.component').then(
            (m) => m.QuizAdminListComponent,
          ),
      },
      {
        path: 'quizzes/:id/questions',
        loadComponent: () =>
          import('../pages/quizzes/quiz-questions-editor/quiz-questions-editor.component').then(
            (m) => m.QuizQuestionsEditorComponent,
          ),
      },
      {
        path: 'articles',
        loadComponent: () =>
          import('../pages/articles/article-admin-list/article-admin-list.component').then(
            (m) => m.ArticleAdminListComponent,
          ),
      },
      {
        path: 'articles/:id/edit',
        loadComponent: () =>
          import('../pages/articles/article-editor/article-editor.component').then(
            (m) => m.ArticleEditorComponent,
          ),
      },
      {
        path: 'sound-attribution',
        loadComponent: () =>
          import('../pages/sound-attribution/sound-attribution.component').then(
            (m) => m.SoundAttributionComponent,
          ),
      },
      {
        path: 'email-templates',
        loadComponent: () =>
          import('../pages/email-templates/email-templates.component').then(
            (m) => m.EmailTemplatesComponent,
          ),
      },
      {
        path: 'storage',
        loadComponent: () =>
          import('../pages/storage-management/storage-management.component').then(
            (m) => m.StorageManagementComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'featured-sound' },
    ],
  },
];
