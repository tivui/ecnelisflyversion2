import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { CarouselCategoriesComponent } from './widgets/carousel-categories/carousel-categories.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    MatIconModule,
    CarouselCategoriesComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomeComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly zoneService = inject(ZoneService);

  appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

  zones = signal<Zone[]>([]);

  ngOnInit() {
    this.loadPublicZones();
  }

  async loadPublicZones() {
    try {
      const allZones = await this.zoneService.listZones();
      const publicZones = allZones
        .filter((z) => z.isPublic)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      this.zones.set(publicZones);
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  }
}
