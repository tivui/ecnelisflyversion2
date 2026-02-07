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
      { path: '', pathMatch: 'full', redirectTo: 'import-sounds' },
    ],
  },
];
