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
      { path: '', pathMatch: 'full', redirectTo: 'import-sounds' },
    ],
  },
];
