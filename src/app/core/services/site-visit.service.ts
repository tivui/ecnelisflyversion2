import { inject, Injectable } from '@angular/core';
import { AmplifyService } from './amplify.service';

export interface VisitStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  timeSeries: { name: string; value: number }[];
}

@Injectable({ providedIn: 'root' })
export class SiteVisitService {
  private readonly amplifyService = inject(AmplifyService);

  /** Record one visit per browser session (fire-and-forget) */
  async recordVisit(): Promise<void> {
    if (sessionStorage.getItem('ecnelis_visit_recorded')) return;
    try {
      const result: any = await (this.amplifyService.client as any).mutations.recordSiteVisitMutation({
        authMode: 'apiKey',
      });

      if (result?.errors?.length) {
        console.error('[SiteVisit] recordVisit mutation errors:', result.errors);
        return; // Don't set sessionStorage — retry on next load
      }

      sessionStorage.setItem('ecnelis_visit_recorded', '1');
    } catch (e) {
      console.warn('[SiteVisit] recordVisit failed:', e);
    }
  }

  /** Load all daily visit records and compute stats (admin) */
  async getVisitStats(): Promise<VisitStats> {
    const allVisits: { id: string; count: number }[] = [];
    let nextToken: string | undefined;

    do {
      const result: any = await (this.amplifyService.client as any).models.SiteVisit.list({
        limit: 500,
        nextToken,
        selectionSet: ['id', 'count'],
        authMode: 'apiKey',
      });

      if (result?.errors?.length) {
        console.error('[SiteVisit] getVisitStats errors:', result.errors);
        break;
      }

      for (const item of result.data ?? []) {
        if (!item) continue;
        allVisits.push({ id: item.id, count: item.count ?? 0 });
      }
      nextToken = result.nextToken;
    } while (nextToken);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let total = 0;
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    for (const v of allVisits) {
      total += v.count;
      if (v.id === todayStr) today = v.count;
      if (v.id >= weekStart) thisWeek += v.count;
      if (v.id >= monthStart) thisMonth += v.count;
    }

    // Build 30-day time series
    const timeSeries: { name: string; value: number }[] = [];
    const visitMap = new Map(allVisits.map((v) => [v.id, v.count]));
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      timeSeries.push({ name: label, value: visitMap.get(dateStr) ?? 0 });
    }

    return { total, today, thisWeek, thisMonth, timeSeries };
  }
}
