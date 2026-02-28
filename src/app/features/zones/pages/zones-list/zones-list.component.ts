import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { ZoneCardComponent } from '../../../home/pages/home/widgets/zone-card/zone-card.component';

@Component({
    selector: 'app-zones-list',
    imports: [
        CommonModule,
        RouterLink,
        TranslateModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        ZoneCardComponent,
    ],
    templateUrl: './zones-list.component.html',
    styleUrl: './zones-list.component.scss'
})
export class ZonesListComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);
  private readonly translate = inject(TranslateService);

  zones = signal<Zone[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadZones();
  }

  async loadZones() {
    this.loading.set(true);
    try {
      const allZones = await this.zoneService.listZones();
      const publicZones = allZones
        .filter((z) => z.isPublic)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      this.zones.set(publicZones);
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
