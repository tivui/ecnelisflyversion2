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
      { path: '', pathMatch: 'full', redirectTo: 'import-sounds' },
    ],
  },
];
