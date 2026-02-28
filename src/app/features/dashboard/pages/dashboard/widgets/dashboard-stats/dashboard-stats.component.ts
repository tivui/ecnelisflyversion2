import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgxChartsModule, Color, ScaleType } from '@swimlane/ngx-charts';

import { Sound } from '../../../../../../core/models/sound.model';
import { QuotaService } from '../../../../../../core/services/quota.service';
import { QuotaInfo } from '../../../../../../core/models/quota.model';

@Component({
    selector: 'app-dashboard-stats',
    imports: [
        CommonModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        TranslateModule,
        NgxChartsModule,
    ],
    templateUrl: './dashboard-stats.component.html',
    styleUrl: './dashboard-stats.component.scss'
})
export class DashboardStatsComponent implements OnInit {
  private readonly quotaService = inject(QuotaService);
  private readonly translate = inject(TranslateService);

  sounds = input.required<Sound[]>();
  userId = input.required<string>();
  isAdmin = input<boolean>(false);

  quotaInfo = signal<QuotaInfo | null>(null);
  readonly Infinity = Infinity;

  // KPI computed
  totalSounds = computed(() => this.sounds().length);
  publicSounds = computed(() => this.sounds().filter(s => s.status === 'public').length);
  totalLikes = computed(() => this.sounds().reduce((sum, s) => sum + (s.likesCount || 0), 0));

  // Quota percentages
  weekPercent = computed(() => {
    const qi = this.quotaInfo();
    if (!qi || qi.weekLimit === Infinity) return 0;
    return Math.min(100, (qi.weekCount / qi.weekLimit) * 100);
  });

  monthPercent = computed(() => {
    const qi = this.quotaInfo();
    if (!qi || qi.monthLimit === Infinity) return 0;
    return Math.min(100, (qi.monthCount / qi.monthLimit) * 100);
  });

  // Category colors (muted variants for charts)
  private readonly categoryAccentColors: Record<string, string> = {
    ambiancefly: '#5BBF8A',
    animalfly: '#D97BD5',
    foodfly: '#D4A05C',
    humanfly: '#D4A3CC',
    itemfly: '#8C8C8C',
    musicfly: '#C04040',
    naturalfly: '#5A9FD4',
    sportfly: '#B06B35',
    transportfly: '#C8B840',
  };

  // Chart: category distribution
  categoryData = computed(() => {
    const sounds = this.sounds();
    const grouped: Record<string, number> = {};
    for (const s of sounds) {
      const cat = s.category || 'unknown';
      grouped[cat] = (grouped[cat] || 0) + 1;
    }
    return Object.entries(grouped)
      .map(([key, value]) => ({
        name: this.translate.instant(`categories.${key}`) || key,
        value,
        key,
      }))
      .sort((a, b) => b.value - a.value);
  });

  // Chart: status breakdown
  statusData = computed(() => {
    const sounds = this.sounds();
    const grouped: Record<string, number> = {};
    for (const s of sounds) {
      const status = s.status || 'private';
      grouped[status] = (grouped[status] || 0) + 1;
    }
    return Object.entries(grouped).map(([name, value]) => ({
      name: this.translate.instant(`dashboard.status.${name}`) || name,
      value,
    }));
  });

  // Chart: monthly activity (6 last months)
  monthlyData = computed(() => {
    const sounds = this.sounds();
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString(this.translate.currentLang || 'fr', {
        month: 'short',
        year: '2-digit',
      });
      months.push({ label, start: d, end });
    }

    return months.map(m => ({
      name: m.label,
      value: sounds.filter(s => {
        const created = s.createdAt ? new Date(s.createdAt) : null;
        return created && created >= m.start && created <= m.end;
      }).length,
    }));
  });

  // Chart color schemes
  categoryColorScheme = computed<Color>(() => ({
    name: 'category',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: this.categoryData().map(d => this.categoryAccentColors[d.key] || '#3f51b5'),
  }));

  statusColorScheme: Color = {
    name: 'status',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#4caf50', '#ff9800', '#9e9e9e'],
  };

  monthlyColorScheme: Color = {
    name: 'monthly',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#3f51b5'],
  };

  async ngOnInit() {
    try {
      const quota = await this.quotaService.getUserQuota(this.userId());
      this.quotaInfo.set(quota);
    } catch {
      // Quota loading failed, non-blocking
    }
  }

  getQuotaBarColor(percent: number): string {
    if (percent >= 90) return 'warn';
    if (percent >= 60) return 'accent';
    return 'primary';
  }
}
