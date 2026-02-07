import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Zone } from '../../../../../../core/models/zone.model';

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './zone-card.component.html',
  styleUrl: './zone-card.component.scss',
})
export class ZoneCardComponent {
  private readonly translate = inject(TranslateService);

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

  zoneUrl = computed(() => `/mapfly?zoneId=${this.zone().id}`);
}
