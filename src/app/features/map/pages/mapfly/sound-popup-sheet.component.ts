import { Component, HostListener, inject, signal, computed, ElementRef, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LikeService } from '../../../../core/services/like.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { createWaveSurferPlayer, WaveSurferPlayerInstance } from '../../../../core/services/wavesurfer-player.service';
import { HeadphoneReminderService } from '../../../../core/services/headphone-reminder.service';
import L from 'leaflet';

export interface SoundPopupSheetData {
  type: 'normal' | 'featured' | 'journey';

  sound: {
    id?: string;
    filename: string;
    title: string;
    title_i18n?: string | Record<string, string>;
    shortStory?: string;
    shortStory_i18n?: string | Record<string, string>;
    city?: string;
    url?: string;
    urlTitle?: string;
    secondaryUrl?: string;
    secondaryUrlTitle?: string;
    likesCount?: number;
    userId?: string;
    user?: { username?: string; country?: string };
    latitude?: number;
    longitude?: number;
    license?: string;
  };
  audioUrl: string;
  mimeType: string;

  // Featured
  featuredLabel?: string;
  displayTeasing?: string;
  soundTeasingI18n?: Record<string, string>;

  // Journey
  stepIndex?: number;
  totalSteps?: number;
  journeyColor?: string;
  themeText?: string;

  // Marker color (for selection circle)
  markerColor?: string;

  // Current map zoom level (for radar visibility)
  mapZoom?: number;

  // Callbacks to mapfly (map actions)
  onZoomIn: () => void;
  onZoomOut: () => void;
  onJourneyPrev?: () => void;
  onJourneyNext?: () => void;
  onJourneyFinish?: () => void;
  onAudioPlay?: () => void;
  onAudioPause?: () => void;
}

@Component({
    selector: 'app-sound-popup-sheet',
    imports: [CommonModule, TranslateModule],
    template: `
    <div class="sound-sheet">
      <!-- Handle bar -->
      <div class="sheet-handle-bar">
        <div class="sheet-handle"></div>
      </div>

      <!-- Featured header -->
      @if (data.type === 'featured') {
        <div class="sheet-header featured-header">
          <span class="material-icons featured-icon">headphones</span>
          <span class="featured-badge">{{ data.featuredLabel | translate }}</span>
        </div>
      }

      <!-- Journey header -->
      @if (data.type === 'journey') {
        <div class="sheet-header journey-header" [style.background]="journeyGradient">
          <span class="journey-badge">{{ journeyStepLabel }}</span>
          <span class="journey-title">{{ displayTitle() }}</span>
        </div>
      }

      <!-- Close button (after headers so sibling selector works for contrast) -->
      <button class="sheet-close-btn" (click)="close()">
        <span class="material-icons">close</span>
      </button>

      <!-- Fixed top content (always visible) -->
      <div class="sheet-top">
        <!-- Title + like on same row (non-journey) -->
        @if (data.type !== 'journey') {
          <div class="sheet-title-row">
            <h3 class="sheet-title">{{ displayTitle() }}</h3>
            <div class="sheet-like-row" (click)="toggleLike()">
              <img [src]="likeIcon()" class="like-icon" alt="like" />
              <span class="like-count">{{ likesCount() }}</span>
            </div>
          </div>
        }

        <!-- WaveSurfer Audio Player -->
        <div #waveformContainer class="ws-sheet-player"></div>

        <!-- Like row (journey only — title is in header) -->
        @if (data.type === 'journey') {
          <div class="sheet-like-row" (click)="toggleLike()">
            <img [src]="likeIcon()" class="like-icon" alt="like" />
            <span class="like-count">{{ likesCount() }}</span>
          </div>
        }

        <!-- Action buttons centered (non-journey) -->
        @if (data.type !== 'journey') {
          <div class="sheet-actions-bar">
            <button class="sheet-action-btn" (click)="zoomOut()">
              <span class="material-icons">remove</span>
            </button>
            <span class="btn-divider"></span>
            <div class="btn-scope">
              @if (data.sound.license !== 'READ_ONLY') {
                <button class="sheet-action-btn" (click)="download()">
                  <span class="material-icons">download</span>
                </button>
              }
              <button class="sheet-action-btn" (click)="share()">
                <span class="material-icons">share</span>
              </button>
              @if (showRadar()) {
                <button class="radar-toggle-btn" [class.active]="radarActive()" (click)="toggleRadar()">
                  <span class="material-icons">radar</span>
                </button>
              }
            </div>
            <span class="btn-divider"></span>
            <button class="sheet-action-btn" (click)="zoomIn()">
              <span class="material-icons">add</span>
            </button>
          </div>
        }

        <!-- Navigation: journey -->
        @if (data.type === 'journey') {
          <div class="sheet-journey-nav" [style.--journey-color]="data.journeyColor">
            @if (data.stepIndex! > 0) {
              <button class="journey-nav-btn prev" (click)="data.onJourneyPrev!()">
                <span class="material-icons">arrow_back</span>
                <span>{{ 'mapfly.journey.previous' | translate }}</span>
              </button>
            } @else {
              <div></div>
            }
            @if (data.stepIndex! < data.totalSteps! - 1) {
              <button class="journey-nav-btn next" (click)="data.onJourneyNext!()">
                <span>{{ 'mapfly.journey.next' | translate }}</span>
                <span class="material-icons">arrow_forward</span>
              </button>
            } @else {
              <button class="journey-nav-btn finish" (click)="data.onJourneyFinish!()">
                <span>{{ 'mapfly.journey.finish' | translate }}</span>
                <span class="material-icons">check</span>
              </button>
            }
          </div>
          @if (showRadar()) {
            <div class="sheet-radar-row">
              <button class="radar-toggle-btn" [class.active]="radarActive()" (click)="toggleRadar()">
                <span class="material-icons">radar</span>
              </button>
            </div>
          }
        }

        <!-- Embedded radar mini-map (all modes) -->
        @if (radarActive()) {
          <div class="sheet-radar-map"></div>
        }
      </div>

      <!-- Scrollable details -->
      <div class="sheet-content">
        <!-- Story / Teasing -->
        @if (displayStory()) {
          <p class="sheet-story">{{ displayStory() }}</p>
        }

        <!-- Journey theme text (fusionné dans displayStory, themeText prioritaire sur shortStory) -->

        <!-- Translate -->
        @if (canTranslate() && !isTranslated()) {
          <button class="sheet-translate-btn" (click)="doTranslate()">
            <span class="material-icons">translate</span>
            <span>{{ 'common.action.translate' | translate }}</span>
          </button>
        }

        <!-- Links -->
        @if (data.sound.url || data.sound.secondaryUrl) {
          <div class="sheet-links">
            @if (data.sound.url) {
              <a [href]="data.sound.url" target="_blank" rel="noopener noreferrer">
                {{ data.sound.urlTitle || data.sound.url }}
              </a>
            }
            @if (data.sound.url && data.sound.secondaryUrl) {
              <span class="link-separator"> | </span>
            }
            @if (data.sound.secondaryUrl) {
              <a [href]="data.sound.secondaryUrl" target="_blank" rel="noopener noreferrer">
                {{ data.sound.secondaryUrlTitle || data.sound.secondaryUrl }}
              </a>
            }
          </div>
        }

        <!-- Record info -->
        @if (data.sound.user?.username) {
          <p class="sheet-record-info" [innerHTML]="recordInfoHtml()"></p>
        }

        <!-- License badge -->
        @if (data.sound.license) {
          <span class="sheet-license-badge" (click)="toggleLicenseTooltip()">
            <span class="material-icons license-icon">copyright</span>
            {{ licenseLabel(data.sound.license!) }}
            @if (showLicenseTooltip() && licenseTooltip(data.sound.license!)) {
              <span class="license-tooltip">
                {{ licenseTooltip(data.sound.license!) }}
              </span>
            }
          </span>
        }
      </div>
    </div>
  `,
    styleUrl: './sound-popup-sheet.component.scss'
})
export class SoundPopupSheetComponent implements AfterViewInit, OnDestroy {
  data = inject<SoundPopupSheetData>(MAT_BOTTOM_SHEET_DATA);
  private sheetRef = inject(MatBottomSheetRef);
  private translateService = inject(TranslateService);
  private likeService = inject(LikeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private el = inject(ElementRef);
  private storageService = inject(StorageService);
  private headphoneReminder = inject(HeadphoneReminderService);

  @ViewChild('waveformContainer', { static: false }) waveformContainer!: ElementRef<HTMLElement>;
  private playerInstance: WaveSurferPlayerInstance | null = null;

  // Delegate click on username link inside [innerHTML]
  @HostListener('click', ['$event'])
  onHostClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('sheet-username-link')) {
      event.preventDefault();
      this.navigateToUser();
    }
  }

  // State
  displayTitle = signal(this.data.sound.title);
  displayStory = signal(this.data.type === 'featured'
    ? (this.data.displayTeasing || this.data.sound.shortStory || '')
    : this.data.type === 'journey'
      ? (this.data.themeText || this.data.sound.shortStory || '')
      : (this.data.sound.shortStory || ''));
  isTranslated = signal(false);
  likesCount = signal(this.data.sound.likesCount ?? 0);
  isLiked = signal(this.data.sound.id ? this.likeService.isLiked(this.data.sound.id) : false);
  showLicenseTooltip = signal(false);
  radarActive = signal(false);
  private radarMap: L.Map | null = null;
  currentZoom = signal(this.data.mapZoom ?? 17);
  showRadar = computed(() => this.currentZoom() >= 5);

  likeIcon = computed(() =>
    this.isLiked()
      ? 'img/icon/clapping_hands_like_2.png'
      : 'img/icon/clapping_hands_no_like.png'
  );

  // Journey helpers
  journeyGradient = this.data.journeyColor
    ? `linear-gradient(180deg, ${this.data.journeyColor} 0%, ${this.data.journeyColor}cc 100%)`
    : '';
  journeyStepLabel = this.data.stepIndex != null && this.data.totalSteps
    ? `${this.data.stepIndex + 1}/${this.data.totalSteps}`
    : '';

  // i18n parsing
  private titleI18n = this.parseI18n(this.data.sound.title_i18n);
  private storyI18n = this.data.type === 'featured'
    ? this.data.soundTeasingI18n
    : this.parseI18n(this.data.sound.shortStory_i18n);

  canTranslate = computed(() => {
    const lang = this.translateService.currentLang?.toLowerCase().trim() || 'fr';
    const translatedTitle = this.titleI18n?.[lang];
    const translatedStory = this.storyI18n?.[lang];
    return !!(
      (translatedTitle && translatedTitle !== this.data.sound.title) ||
      (translatedStory && translatedStory !== (this.data.type === 'featured' ? this.data.displayTeasing : this.data.sound.shortStory))
    );
  });

  recordInfoHtml = computed(() => {
    if (!this.data.sound.user?.username) return '';
    const flagImg = this.data.sound.user.country
      ? `<img src="/img/flags/${this.data.sound.user.country}.png" alt="${this.data.sound.user.country}" style="width:16px; height:12px; margin-left:4px; vertical-align:middle;" />`
      : '';
    const userLink = this.data.type !== 'journey'
      ? `<span class="sheet-username-link">${this.data.sound.user.username}${flagImg}</span>`
      : `${this.data.sound.user.username}${flagImg}`;
    return this.translateService.instant('mapfly.record-info', {
      city: this.data.sound.city ?? '',
      username: userLink,
    });
  });

  ngAfterViewInit() {
    const isDark = document.body.classList.contains('dark-theme');
    this.playerInstance = createWaveSurferPlayer({
      container: this.waveformContainer.nativeElement,
      audioUrl: this.data.audioUrl,
      isDarkTheme: isDark,
      mediaMetadata: {
        title: this.data.sound.title ?? 'Ecnelis FLY',
        artist: this.data.sound.city ?? undefined,
      },
      onPlay: () => this.onAudioPlay(),
      onPause: () => this.onAudioPause(),
      getRefreshUrl: async () => {
        const freshUrl = await this.storageService.getSoundUrl(this.data.sound.filename);
        this.data.audioUrl = freshUrl;
        return freshUrl;
      },
    });
  }

  ngOnDestroy() {
    this.destroyRadarMap();
    this.playerInstance?.destroy();
    this.playerInstance = null;
  }

  close() {
    this.sheetRef.dismiss();
  }

  toggleLicenseTooltip() {
    this.showLicenseTooltip.update(v => !v);
  }

  /** Traduit un code de licence — fallback vers le code brut si la clé est manquante */
  licenseLabel(license: string): string {
    const key = `sound.licenses.${license}`;
    const t = this.translateService.instant(key);
    return t === key ? license : t;
  }

  /** Traduit le tooltip d'une licence — chaîne vide si clé manquante */
  licenseTooltip(license: string): string {
    const key = `sound.licenses.${license}_tooltip`;
    const t = this.translateService.instant(key);
    return t === key ? '' : t;
  }

  async toggleLike() {
    if (!this.auth.user() || !this.data.sound.id) return;
    const currentCount = this.likesCount();
    const result = await this.likeService.toggleLike(this.data.sound.id, currentCount);
    if (result) {
      this.likesCount.set(result.newCount);
    }
    this.isLiked.set(this.likeService.isLiked(this.data.sound.id));
  }

  doTranslate() {
    const lang = this.translateService.currentLang?.toLowerCase().trim() || 'fr';
    if (this.titleI18n?.[lang]) {
      this.displayTitle.set(this.titleI18n[lang]);
    }
    if (this.storyI18n?.[lang]) {
      this.displayStory.set(this.storyI18n[lang]);
    }
    this.isTranslated.set(true);
  }

  async download() {
    const freshUrl = await this.storageService.getSoundUrl(this.data.sound.filename);
    const a = document.createElement('a');
    a.href = freshUrl;
    a.download = this.data.sound.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async share() {
    const s = this.data.sound;
    const url = `${window.location.origin}/mapfly?lat=${s.latitude}&lng=${s.longitude}&zoom=17&soundFilename=${encodeURIComponent(s.filename)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: s.title, url });
        return;
      } catch {
        // User cancelled or not supported — fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      this.snackBar.open(
        this.translateService.instant('mapfly.share.copied'),
        undefined,
        { duration: 2500 },
      );
    } catch {
      // Clipboard not available
    }
  }

  navigateToUser() {
    if (!this.data.sound.userId) return;
    const tree = this.router.createUrlTree(['/mapfly'], {
      queryParams: { userId: this.data.sound.userId },
    });
    window.location.href = window.location.origin + this.router.serializeUrl(tree);
  }

  onAudioPlay() {
    this.headphoneReminder.showIfNeeded();
    this.data.onAudioPlay?.();
  }

  onAudioPause() {
    this.data.onAudioPause?.();
  }

  zoomIn() {
    this.data.onZoomIn();
    this.currentZoom.set(17);
  }

  zoomOut() {
    this.data.onZoomOut();
    this.currentZoom.set(2);
    // Auto-close radar at world view (same rule as desktop)
    if (this.radarActive()) {
      this.radarActive.set(false);
      this.destroyRadarMap();
    }
  }

  toggleRadar() {
    const willShow = !this.radarActive();
    this.radarActive.set(willShow);

    if (willShow) {
      // Wait for Angular to render the container, then init the map
      setTimeout(() => this.initRadarMap(), 50);
    } else {
      this.destroyRadarMap();
    }
  }

  private initRadarMap(): void {
    if (this.radarMap) return;
    const container = this.el.nativeElement.querySelector('.sheet-radar-map');
    if (!container) return;

    const lat = this.data.sound.latitude ?? 0;
    const lng = this.data.sound.longitude ?? 0;

    this.radarMap = L.map(container, {
      center: [lat, lng],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
    }).addTo(this.radarMap);

    // Red dot at the sound's location
    const marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.9,
      weight: 2,
      interactive: false,
    }).addTo(this.radarMap);

    // Country label from city field ("City, Country" format)
    const country = this.extractCountry();
    if (country) {
      const isDark = document.body.classList.contains('dark-theme');
      marker.bindTooltip(country, {
        permanent: true,
        direction: 'right',
        offset: [8, 0],
        className: isDark ? 'radar-country-label dark' : 'radar-country-label',
      });
    }

    // Ensure tiles render correctly after DOM insertion
    setTimeout(() => this.radarMap?.invalidateSize(), 100);
  }

  private destroyRadarMap(): void {
    if (this.radarMap) {
      this.radarMap.remove();
      this.radarMap = null;
    }
  }

  private extractCountry(): string {
    const city = this.data.sound.city;
    if (!city) return '';
    const parts = city.split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : city.trim();
  }

  private parseI18n(field?: string | Record<string, string>): Record<string, string> | undefined {
    if (!field) return undefined;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return undefined;
      }
    }
    return field;
  }
}
