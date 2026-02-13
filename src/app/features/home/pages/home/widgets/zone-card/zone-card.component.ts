import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Zone } from '../../../../../../core/models/zone.model';
import { ZoneService } from '../../../../../../core/services/zone.service';

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './zone-card.component.html',
  styleUrl: './zone-card.component.scss',
})
export class ZoneCardComponent {
  private readonly translate = inject(TranslateService);
  private readonly zoneService = inject(ZoneService);

  zone = input.required<Zone>();

  localizedName = computed(() => {
    const z = this.zone();
    const lang = this.translate.currentLang;
    return z.name_i18n?.[lang] ?? z.name;
  });

  localizedDescription = computed(() => {
    const z = this.zone();
    const lang = this.translate.currentLang;
    return z.description_i18n?.[lang] ?? z.description ?? '';
  });

  zoneColor = computed(() => this.zone().color ?? '#1976d2');
  coverPosition = computed(() => this.zone().coverImagePosition ?? 'center');
  coverZoom = computed(() => {
    const z = this.zone().coverImageZoom ?? 100;
    return z / 100;
  });

  zoneUrl = computed(() => `/mapfly?zoneId=${this.zone().id}`);

  coverImageUrl = signal<string | null>(null);

  constructor() {
    // Resolve cover image S3 key to presigned URL
    effect(() => {
      const z = this.zone();
      if (z.coverImage) {
        this.zoneService
          .getZoneFileUrl(z.coverImage)
          .then((url) => this.coverImageUrl.set(url))
          .catch(() => this.coverImageUrl.set(null));
      } else {
        this.coverImageUrl.set(null);
      }
    });
  }
}
