import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GraphQLResult } from 'aws-amplify/api';

import { AmplifyService } from '../../../../../core/services/amplify.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { CategoriesService } from '../../../../../core/services/categories.service';
import { EphemeralJourneyService } from '../../../../../core/services/ephemeral-journey.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ListSoundsForMapWithAppUser } from '../../../../../core/models/amplify-queries.model';
import { Sound } from '../../../../../core/models/sound.model';
import { CategoryKey } from '../../../../../../../amplify/data/categories';

interface CategoryChip {
  key: string;
  label: string;
  accentColor: string;
}

@Component({
  selector: 'app-random-journey-sheet',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    <div class="sheet-container">
      <div class="sheet-handle"></div>

      <div class="sheet-header">
        <div class="sheet-header-icon">
          <mat-icon>shuffle</mat-icon>
        </div>
        <div class="sheet-header-text">
          <span class="sheet-title">{{ 'journeys.random.title' | translate }}</span>
          <span class="sheet-subtitle">{{ 'journeys.random.description' | translate }}</span>
        </div>
      </div>

      <!-- Sound count slider -->
      <div class="slider-section">
        <label class="slider-label">{{ 'journeys.random.soundCount' | translate }}</label>
        <div class="slider-row">
          <span class="slider-min">1</span>
          <input
            type="range"
            class="count-slider"
            min="1"
            max="10"
            [value]="soundCount()"
            (input)="onCountChange($event)"
          />
          <span class="slider-max">10</span>
          <span class="slider-value">{{ soundCount() }}</span>
        </div>
      </div>

      <!-- Category chips -->
      <div class="category-section">
        <label class="category-label">{{ 'journeys.random.category' | translate }}</label>
        <div class="category-chips">
          <button
            class="cat-chip"
            [class.active]="selectedCategory() === null"
            (click)="selectCategory(null)"
          >
            <span class="cat-chip-dot" style="background: #5c6a8a"></span>
            <span class="cat-chip-label">{{ 'journeys.random.allCategories' | translate }}</span>
          </button>
          @for (cat of categoryChips; track cat.key) {
            <button
              class="cat-chip"
              [class.active]="selectedCategory() === cat.key"
              (click)="selectCategory(cat.key)"
              [style.--cat-accent]="cat.accentColor"
            >
              <span class="cat-chip-dot" [style.background]="cat.accentColor"></span>
              <span class="cat-chip-label">{{ cat.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Error message -->
      @if (errorMessage()) {
        <div class="sheet-error">
          <mat-icon>warning</mat-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Launch button -->
      <button class="launch-btn" (click)="launch()" [disabled]="loading()">
        @if (loading()) {
          <div class="launch-spinner"></div>
          <span>{{ 'journeys.random.loading' | translate }}</span>
        } @else {
          <mat-icon>rocket_launch</mat-icon>
          <span>{{ 'journeys.random.launch' | translate }}</span>
        }
      </button>
    </div>
  `,
  styles: [`
    .sheet-container {
      padding: 8px 20px calc(20px + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.15);
      margin: 0 auto 4px;
      flex-shrink: 0;
    }

    :host-context(body.dark-theme) .sheet-handle {
      background: rgba(255, 255, 255, 0.15);
    }

    .sheet-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .sheet-header-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: linear-gradient(135deg, #2e3548, #5c6a8a);
      flex-shrink: 0;
    }

    .sheet-header-icon mat-icon {
      color: #fff;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .sheet-header-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sheet-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #1a1a2e;
    }

    :host-context(body.dark-theme) .sheet-title {
      color: #f0f0f5;
    }

    .sheet-subtitle {
      font-size: 0.8rem;
      color: #888;
    }

    :host-context(body.dark-theme) .sheet-subtitle {
      color: #999;
    }

    /* Slider section */
    .slider-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .slider-label, .category-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    :host-context(body.dark-theme) .slider-label,
    :host-context(body.dark-theme) .category-label {
      color: #aaa;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .slider-min, .slider-max {
      font-size: 0.75rem;
      color: #999;
      min-width: 14px;
      text-align: center;
    }

    .count-slider {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 4px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.1);
      outline: none;
    }

    :host-context(body.dark-theme) .count-slider {
      background: rgba(255, 255, 255, 0.12);
    }

    .count-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2e3548, #5c6a8a);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    :host-context(body.dark-theme) .count-slider::-webkit-slider-thumb {
      border-color: #2a2a3a;
    }

    .count-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2e3548, #5c6a8a);
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    .slider-value {
      font-size: 1.1rem;
      font-weight: 700;
      color: #5c6a8a;
      min-width: 24px;
      text-align: center;
    }

    :host-context(body.dark-theme) .slider-value {
      color: #a0b0cc;
    }

    /* Category chips */
    .category-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .category-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cat-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      background: rgba(0, 0, 0, 0.02);
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 500;
      color: #555;
    }

    :host-context(body.dark-theme) .cat-chip {
      border-color: rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: #ccc;
    }

    .cat-chip:active {
      transform: scale(0.95);
    }

    .cat-chip.active {
      border-color: var(--cat-accent, #5c6a8a);
      background: color-mix(in srgb, var(--cat-accent, #5c6a8a) 12%, transparent);
      color: #333;
      font-weight: 600;
    }

    :host-context(body.dark-theme) .cat-chip.active {
      background: color-mix(in srgb, var(--cat-accent, #5c6a8a) 18%, transparent);
      color: #f0f0f5;
    }

    .cat-chip-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .cat-chip-label {
      white-space: nowrap;
    }

    /* Error */
    .sheet-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(211, 47, 47, 0.08);
      color: #c62828;
      font-size: 0.82rem;
    }

    :host-context(body.dark-theme) .sheet-error {
      background: rgba(211, 47, 47, 0.15);
      color: #ef9a9a;
    }

    .sheet-error mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    /* Launch button */
    .launch-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, #4a5a78, #7088a8);
      color: #fff;
      font-size: 0.95rem;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      box-shadow: 0 4px 16px rgba(92, 106, 138, 0.3);
    }

    .launch-btn:active {
      transform: scale(0.97);
    }

    .launch-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .launch-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .launch-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class RandomJourneySheetComponent {
  private readonly sheetRef = inject(MatBottomSheetRef);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly ephemeralService = inject(EphemeralJourneyService);
  private readonly auth = inject(AuthService);

  soundCount = signal(5);
  selectedCategory = signal<string | null>(null);
  loading = signal(false);
  errorMessage = signal('');

  categoryChips: CategoryChip[] = Object.values(CategoryKey).map(key => ({
    key,
    label: this.categoriesService.getLabel(key),
    accentColor: this.getCategoryColor(key),
  }));

  private getCategoryColor(key: CategoryKey): string {
    const meta: Record<string, string> = {
      ambiancefly: '#3AE27A',
      animalfly: '#FF54F9',
      foodfly: '#E8A849',
      humanfly: '#FFC1F7',
      itemfly: '#888888',
      musicfly: '#D60101',
      naturalfly: '#39AFF7',
      sportfly: '#A24C06',
      transportfly: '#E8D000',
    };
    return meta[key] ?? '#888';
  }

  private softenColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.round(r * 0.55 + 30 * 0.45);
    const dg = Math.round(g * 0.55 + 30 * 0.45);
    const db = Math.round(b * 0.55 + 46 * 0.45);
    return '#' + [dr, dg, db].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  onCountChange(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.soundCount.set(val);
  }

  selectCategory(key: string | null) {
    this.selectedCategory.set(key);
    this.errorMessage.set('');
  }

  async launch() {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const cat = this.selectedCategory();
      const result = (await this.amplifyService.client.graphql({
        query: ListSoundsForMapWithAppUser,
        variables: {
          ...(cat ? { category: cat } : {}),
        },
        authMode: 'apiKey',
      })) as GraphQLResult<{ listSoundsForMap: any[] }>;

      const rawSounds = result?.data?.listSoundsForMap ?? [];

      // Filter for valid geo-located sounds
      const validSounds = rawSounds
        .filter((s: any) => s.latitude && s.longitude)
        .map((raw: any) => this.soundsService.map(raw));

      if (validSounds.length === 0) {
        this.errorMessage.set(this.translate.instant('journeys.random.notEnough'));
        this.loading.set(false);
        return;
      }

      // Fisher-Yates shuffle
      const shuffled = [...validSounds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const count = Math.min(this.soundCount(), shuffled.length);
      const picked = shuffled.slice(0, count);

      // Determine color (softened for map use)
      const color = cat ? this.softenColor(this.getCategoryColor(cat as CategoryKey)) : '#5c6a8a';
      const name = cat
        ? this.categoriesService.getLabel(cat as CategoryKey)
        : this.translate.instant('journeys.random.journeyName');

      // Store in ephemeral service
      this.ephemeralService.set(picked, name, color);

      // Close sheet and navigate
      this.sheetRef.dismiss();
      this.router.navigate(['/mapfly'], {
        queryParams: { ephemeralJourney: 'true' },
      });
    } catch (error) {
      console.error('Error launching random journey:', error);
      this.errorMessage.set(this.translate.instant('journeys.random.notEnough'));
    } finally {
      this.loading.set(false);
    }
  }
}
