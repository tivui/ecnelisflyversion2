import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgxChartsModule, Color, ScaleType } from '@swimlane/ngx-charts';

import { DashboardService } from '../../../dashboard/services/dashboard.service';
import { StorageService } from '../../../../core/services/storage.service';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { Sound } from '../../../../core/models/sound.model';
import { SiteVisitService, VisitStats } from '../../../../core/services/site-visit.service';

interface CognitoStatsResult {
  totalUsers: number;
  newThisWeek: number;
  newThisMonth: number;
  emailCount: number;
  oauthCount: number;
  timeSeriesJson: string;
}

@Component({
    selector: 'app-admin-dashboard',
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatTabsModule,
        MatChipsModule,
        TranslateModule,
        NgxChartsModule,
    ],
    templateUrl: './admin-dashboard.component.html',
    styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly translate = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly storageService = inject(StorageService);
  private readonly siteVisitService = inject(SiteVisitService);

  sounds = signal<Sound[]>([]);
  users = signal<{ id: string; username: string; createdAt?: string }[]>([]);
  loading = signal(true);
  expandedSoundId = signal<string | null>(null);
  soundUrls = signal<Record<string, string>>({});

  // Cognito stats
  cognitoStats = signal<CognitoStatsResult | null>(null);
  cognitoLoading = signal(false);
  cognitoError = signal(false);

  cognitoTimeSeries = computed(() => {
    const raw = this.cognitoStats()?.timeSeriesJson;
    if (!raw) return [];
    try {
      const months: { label: string; count: number }[] = JSON.parse(raw);
      return months.map((m) => ({ name: m.label, value: m.count }));
    } catch {
      return [];
    }
  });

  cognitoProviderData = computed(() => {
    const stats = this.cognitoStats();
    if (!stats) return [];
    return [
      { name: this.translate.instant('admin.dashboard.cognito.emailUsers'), value: stats.emailCount },
      { name: this.translate.instant('admin.dashboard.cognito.oauthUsers'), value: stats.oauthCount },
    ];
  });

  cognitoColorScheme: Color = {
    name: 'cognito',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#3f51b5'],
  };

  cognitoProviderScheme: Color = {
    name: 'cognitoProvider',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#1976d2', '#ea4335'],
  };

  // Site visits
  visitStats = signal<VisitStats | null>(null);

  visitsColorScheme: Color = {
    name: 'visits',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#1976d2'],
  };

  // KPIs
  totalSounds = computed(() => this.sounds().length);
  totalUsers = computed(() => this.users().length);
  publicSounds = computed(() => this.sounds().filter(s => s.status === 'public').length);
  pendingSounds = computed(() => this.sounds().filter(s => s.status === 'public_to_be_approved').length);
  newUsersThisMonth = computed(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.users().filter(u => u.createdAt && new Date(u.createdAt) >= monthStart).length;
  });

  // Pending sounds list (for moderation)
  pendingSoundsList = computed(() =>
    this.sounds()
      .filter(s => s.status === 'public_to_be_approved')
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      })
  );

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

  // Chart: sounds by category (top 9)
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
      .sort((a, b) => b.value - a.value)
      .slice(0, 9);
  });

  // Chart: uploads over time (12 months)
  uploadsOverTime = computed(() => {
    const sounds = this.sounds();
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString(this.translate.currentLang || 'fr', {
        month: 'short',
        year: '2-digit',
      });
      months.push({ label, start: d, end });
    }

    return [{
      name: this.translate.instant('admin.dashboard.uploadsOverTime'),
      series: months.map(m => ({
        name: m.label,
        value: sounds.filter(s => {
          const created = s.createdAt ? new Date(s.createdAt) : null;
          return created && created >= m.start && created <= m.end;
        }).length,
      })),
    }];
  });

  // Chart: status distribution
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

  // Chart: top contributors
  topContributors = computed(() => {
    const sounds = this.sounds();
    const grouped: Record<string, { count: number; username: string }> = {};
    for (const s of sounds) {
      const key = s.userId;
      if (!grouped[key]) {
        grouped[key] = { count: 0, username: s.user?.username || s.userId };
      }
      grouped[key].count++;
    }
    return Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(c => ({ name: c.username, value: c.count }));
  });

  // Chart: top cities
  topCities = computed(() => {
    const sounds = this.sounds();
    const grouped: Record<string, number> = {};
    for (const s of sounds) {
      if (s.city) {
        grouped[s.city] = (grouped[s.city] || 0) + 1;
      }
    }
    return Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  });

  // Color schemes
  categoryColorScheme = computed<Color>(() => ({
    name: 'category',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: this.categoryData().map(d => this.categoryAccentColors[d.key] || '#3f51b5'),
  }));

  lineColorScheme: Color = {
    name: 'line',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#3f51b5'],
  };

  statusColorScheme: Color = {
    name: 'status',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#4caf50', '#ff9800', '#9e9e9e'],
  };

  contributorsColorScheme: Color = {
    name: 'contributors',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#7e57c2'],
  };

  citiesColorScheme: Color = {
    name: 'cities',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#1976d2'],
  };

  async ngOnInit() {
    try {
      const [sounds, users] = await Promise.all([
        this.dashboardService.loadAllSounds(),
        this.dashboardService.loadAllUsers(),
      ]);
      this.sounds.set(sounds);
      this.users.set(users);
    } catch (error) {
      console.error('[AdminDashboard] Failed to load data:', error);
    } finally {
      this.loading.set(false);
    }
    // Load visit stats in parallel (non-blocking for main KPIs)
    this.siteVisitService.getVisitStats()
      .then((stats) => this.visitStats.set(stats))
      .catch((e) => console.warn('[AdminDashboard] Failed to load visit stats:', e));
  }

  onTabChange(index: number) {
    if (index === 2 && !this.cognitoStats() && !this.cognitoLoading()) {
      this.loadCognitoStats();
    }
  }

  retryCognitoStats() {
    this.cognitoStats.set(null);
    this.cognitoError.set(false);
    this.loadCognitoStats();
  }

  async loadCognitoStats() {
    if (this.cognitoLoading()) return;
    this.cognitoLoading.set(true);
    this.cognitoError.set(false);
    try {
      const result = await (this.amplifyService.client as any).queries.getCognitoStats();
      if (result?.errors?.length) {
        console.error('[AdminDashboard] getCognitoStats errors:', result.errors);
        this.cognitoError.set(true);
        return;
      }
      if (result?.data) {
        this.cognitoStats.set(result.data as CognitoStatsResult);
      } else {
        console.warn('[AdminDashboard] getCognitoStats returned no data');
        this.cognitoError.set(true);
      }
    } catch (e) {
      console.error('[AdminDashboard] getCognitoStats failed:', e);
      this.cognitoError.set(true);
    } finally {
      this.cognitoLoading.set(false);
    }
  }

  async approveSound(sound: Sound) {
    try {
      const updated = await this.dashboardService.updateSound(sound.id!, { status: 'public' });
      if (updated) {
        this.sounds.update(list => list.map(s => s.id === sound.id ? { ...s, status: 'public' as const } : s));
        this.snackBar.open(
          this.translate.instant('admin.dashboard.approved'),
          undefined,
          { duration: 3000 }
        );
      }
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.dashboard.approveError'),
        undefined,
        { duration: 3000 }
      );
    }
  }

  async rejectSound(sound: Sound) {
    try {
      const updated = await this.dashboardService.updateSound(sound.id!, { status: 'private' });
      if (updated) {
        this.sounds.update(list => list.map(s => s.id === sound.id ? { ...s, status: 'private' as const } : s));
        this.snackBar.open(
          this.translate.instant('admin.dashboard.rejected'),
          undefined,
          { duration: 3000 }
        );
      }
    } catch {
      this.snackBar.open(
        this.translate.instant('admin.dashboard.rejectError'),
        undefined,
        { duration: 3000 }
      );
    }
  }

  async approveAll() {
    const pending = this.pendingSoundsList();
    for (const sound of pending) {
      await this.approveSound(sound);
    }
  }

  async toggleExpand(sound: Sound) {
    if (this.expandedSoundId() === sound.id) {
      this.expandedSoundId.set(null);
      return;
    }
    this.expandedSoundId.set(sound.id!);
    // Load audio URL if not cached
    if (sound.filename && !this.soundUrls()[sound.id!]) {
      try {
        const url = await this.storageService.getSoundUrl(sound.filename);
        this.soundUrls.update(urls => ({ ...urls, [sound.id!]: url }));
      } catch {
        // Non-blocking
      }
    }
  }
}
