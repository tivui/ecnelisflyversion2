import { Component, EventEmitter, Input, Output, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { AppUserService } from '../../../../../../core/services/app-user.service';
import { CancelConfirmDialogComponent } from './cancel-confirm-dialog/cancel-confirm-dialog.component';
import { CategoryKey } from '../../../../../../../../amplify/data/categories';
import { MAP_QUERY_KEYS } from '../../../../../../core/models/map.model';

export interface SoundData {
  soundPath: string | null;
  place: {
    lat: number;
    lng: number;
    name: string;
  } | null;
  title_i18n?: Record<string, string>;
  shortStory_i18n?: Record<string, string>;
  category?: string;
  secondaryCategory?: string;
  recordDateTime?: Date;
  equipment?: string;
  url?: string;
  urlTitle?: string;
  secondaryUrl?: string;
  secondaryUrlTitle?: string;
  license?: string;
  status?: string;
  hashtags?: string;
  linkedUserId?: string;
}

@Component({
  selector: 'app-confirmation-step',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatChipsModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './confirmation-step.component.html',
  styleUrl: './confirmation-step.component.scss',
})
export class ConfirmationStepComponent implements OnChanges {
  private amplifyService = inject(AmplifyService);
  private authService = inject(AuthService);
  private appUserService = inject(AppUserService);
  private translate = inject(TranslateService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  @Input() soundData!: SoundData;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() highlightSteps = new EventEmitter<number[]>();

  loading = signal(false);
  success = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['soundData']) {
      console.log('🔍 SoundData received in confirmation-step:', this.soundData);
      console.log('  - status:', this.soundData?.status);
      console.log('  - license:', this.soundData?.license);
      console.log('  - url:', this.soundData?.url);
      console.log('  - secondaryUrl:', this.soundData?.secondaryUrl);
      console.log('  - hashtags:', this.soundData?.hashtags);
      console.log('  - hashtagsArray:', this.hashtagsArray);
    }
  }

  // Getters for reactive data (computed signals don't work with @Input)
  get currentLang(): string {
    return this.translate.currentLang || 'fr';
  }

  get displayTitle(): string {
    return this.soundData?.title_i18n?.[this.currentLang] || '';
  }

  get displayShortStory(): string {
    return this.soundData?.shortStory_i18n?.[this.currentLang] || '';
  }

  get displayCategory(): string {
    if (!this.soundData?.category) return '';
    return this.translate.instant(`categories.${this.soundData.category}`);
  }

  get displaySecondaryCategory(): string {
    if (!this.soundData?.secondaryCategory) return '';
    return this.translate.instant(
      `categories.${this.soundData.category}.${this.soundData.secondaryCategory}`,
    );
  }

  get displayLicense(): string {
    if (!this.soundData?.license) return '';
    return this.translate.instant(`sound.licenses.${this.soundData.license}`);
  }

  get displayStatus(): string {
    if (!this.soundData?.status) return '';
    if (this.soundData.status === 'public_to_be_approved') {
      return this.translate.instant('sound.statusPublic');
    }
    return this.translate.instant(`sound.status${this.capitalizeFirst(this.soundData.status)}`);
  }

  get hashtagsArray(): string[] {
    if (!this.soundData?.hashtags) return [];
    return this.soundData.hashtags.split(' ').filter((tag) => tag.trim() !== '');
  }

  // Validation getters
  get isDataValid(): boolean {
    return this.missingRequiredFields.length === 0;
  }

  get missingRequiredFields(): string[] {
    const missing: string[] = [];

    // Check required fields
    if (!this.soundData?.soundPath) {
      missing.push(this.translate.instant('sound.validation.sound-file'));
    }
    if (!this.soundData?.place || !this.soundData.place.lat || !this.soundData.place.lng || !this.soundData.place.name) {
      missing.push(this.translate.instant('sound.validation.location'));
    }
    if (!this.soundData?.title_i18n || !this.soundData.title_i18n[this.currentLang]) {
      missing.push(this.translate.instant('sound.validation.title'));
    }
    if (!this.soundData?.category) {
      missing.push(this.translate.instant('sound.validation.category'));
    }

    return missing;
  }

  get validationTooltip(): string {
    if (this.isDataValid) return '';
    const header = this.translate.instant('sound.confirmation-validation-error');
    const fieldsList = this.missingRequiredFields.map(field => `• ${field}`).join('\n');
    return `${header}\n\n${fieldsList}`;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async onConfirm() {
    if (!this.soundData || this.loading() || !this.isDataValid) return;

    this.loading.set(true);

    try {
      // Récupérer l'utilisateur courant de la table User (pas le cognitoSub)
      const appUser = await firstValueFrom(this.appUserService.currentUser$);
      if (!appUser?.id) {
        throw new Error('User not authenticated or not found in database');
      }

      // Préparer les données pour DynamoDB
      // Si un admin a sélectionné un autre utilisateur, utiliser son ID
      const soundToCreate = {
        userId: this.soundData.linkedUserId || appUser.id,
        title: this.soundData.title_i18n?.[this.currentLang] || '',
        title_i18n: this.soundData.title_i18n
          ? JSON.stringify(this.soundData.title_i18n)
          : undefined,
        shortStory: this.soundData.shortStory_i18n?.[this.currentLang] || undefined,
        shortStory_i18n: this.soundData.shortStory_i18n
          ? JSON.stringify(this.soundData.shortStory_i18n)
          : undefined,
        filename: this.soundData.soundPath || '',
        status: (this.soundData.status || 'public_to_be_approved') as 'public_to_be_approved' | 'public' | 'private',
        latitude: this.soundData.place?.lat,
        longitude: this.soundData.place?.lng,
        city: this.soundData.place?.name,
        category: this.soundData.category as CategoryKey | undefined,
        secondaryCategory: this.soundData.secondaryCategory,
        recordDateTime: this.soundData.recordDateTime
          ? this.soundData.recordDateTime.toISOString().split('T')[0]
          : undefined,
        equipment: this.soundData.equipment,
        license: (this.soundData.license || 'CC_BY') as 'READ_ONLY' | 'PUBLIC_DOMAIN' | 'CC_BY' | 'CC_BY_NC',
        url: this.soundData.url,
        urlTitle: this.soundData.urlTitle,
        secondaryUrl: this.soundData.secondaryUrl,
        secondaryUrlTitle: this.soundData.secondaryUrlTitle,
        hashtags: this.soundData.hashtags,
      };

      // Créer le son dans DynamoDB
      await this.amplifyService.client.models.Sound.create(soundToCreate);

      // Afficher l'overlay de succès
      this.loading.set(false);
      this.success.set(true);

      // Émettre l'événement de confirmation
      this.confirmed.emit();

      // Rediriger vers mapfly centrée sur le son après l'animation
      setTimeout(() => {
        this.router.navigate(['/mapfly'], {
          queryParams: {
            [MAP_QUERY_KEYS.lat]: this.soundData.place?.lat?.toFixed(4),
            [MAP_QUERY_KEYS.lng]: this.soundData.place?.lng?.toFixed(4),
            [MAP_QUERY_KEYS.zoom]: 16,
            [MAP_QUERY_KEYS.basemap]: 'mapbox',
          },
        });
        this.snackBar.open(
          this.translate.instant('sound.confirmation-success'),
          'OK',
          { duration: 4000 },
        );
      }, 2500);
    } catch (error) {
      console.error('Error creating sound:', error);
      this.snackBar.open(
        this.translate.instant('sound.confirmation-error'),
        'OK',
        { duration: 5000 },
      );
      this.loading.set(false);
    }
  }

  onCancel() {
    const dialogRef = this.dialog.open(CancelConfirmDialogComponent, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.cancelled.emit();
        this.router.navigate(['/']);
      }
    });
  }

  // Méthode pour obtenir les indices des steps incomplets
  get incompleteStepIndices(): number[] {
    const indices: number[] = [];

    // Step 0: Son (soundPath)
    if (!this.soundData?.soundPath) {
      indices.push(0);
    }

    // Step 1: Lieu (place) - lat, lng et name sont obligatoires
    if (!this.soundData?.place || !this.soundData.place.lat || !this.soundData.place.lng || !this.soundData.place.name) {
      indices.push(1);
    }

    // Step 2: Infos son (title, category)
    if (!this.soundData?.title_i18n || !this.soundData.title_i18n[this.currentLang] || !this.soundData?.category) {
      indices.push(2);
    }

    return indices;
  }

  onConfirmButtonMouseEnter() {
    if (!this.isDataValid) {
      this.highlightSteps.emit(this.incompleteStepIndices);
    }
  }

  onConfirmButtonMouseLeave() {
    this.highlightSteps.emit([]);
  }
}
