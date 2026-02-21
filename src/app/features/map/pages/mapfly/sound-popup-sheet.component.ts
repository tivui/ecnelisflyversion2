import { Component, HostListener, inject, signal, computed, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LikeService } from '../../../../core/services/like.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';

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
  standalone: true,
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

        <!-- Audio -->
        <audio controls controlsList="nodownload noplaybackrate" preload="metadata"
               (play)="onAudioPlay()" (pause)="onAudioPause()" (ended)="onAudioPause()">
          <source [src]="data.audioUrl" [type]="data.mimeType">
        </audio>

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
            <button class="sheet-action-btn" (click)="data.onZoomOut()">
              <span class="material-icons">remove</span>
            </button>
            <button class="sheet-action-btn" (click)="download()">
              <span class="material-icons">download</span>
            </button>
            <button class="sheet-action-btn" (click)="data.onZoomIn()">
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
        }
      </div>

      <!-- Scrollable details -->
      <div class="sheet-content">
        <!-- Story / Teasing -->
        @if (displayStory()) {
          <p class="sheet-story">{{ displayStory() }}</p>
        }

        <!-- Journey theme text -->
        @if (data.themeText) {
          <p class="sheet-theme-text">{{ data.themeText }}</p>
        }

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
      </div>
    </div>
  `,
  styleUrl: './sound-popup-sheet.component.scss',
})
export class SoundPopupSheetComponent {
  data = inject<SoundPopupSheetData>(MAT_BOTTOM_SHEET_DATA);
  private sheetRef = inject(MatBottomSheetRef);
  private translateService = inject(TranslateService);
  private likeService = inject(LikeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private el = inject(ElementRef);

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
    : (this.data.sound.shortStory || ''));
  isTranslated = signal(false);
  likesCount = signal(this.data.sound.likesCount ?? 0);
  isLiked = signal(this.data.sound.id ? this.likeService.isLiked(this.data.sound.id) : false);

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

  close() {
    this.sheetRef.dismiss();
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

  download() {
    const a = document.createElement('a');
    a.href = this.data.audioUrl;
    a.download = this.data.sound.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  navigateToUser() {
    if (!this.data.sound.userId) return;
    const tree = this.router.createUrlTree(['/mapfly'], {
      queryParams: { userId: this.data.sound.userId },
    });
    window.location.href = window.location.origin + this.router.serializeUrl(tree);
  }

  onAudioPlay() {
    this.data.onAudioPlay?.();
  }

  onAudioPause() {
    this.data.onAudioPause?.();
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
