import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import { DashboardService } from '../../services/dashboard.service';
import { Sound } from '../../../../core/models/sound.model';
import { SoundListComponent } from './widgets/sound-list/sound-list.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    TranslateModule,
    SoundListComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly appUserService = inject(AppUserService);
  private readonly dashboardService = inject(DashboardService);
  private readonly translate = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  // Signals
  currentUserId = signal<string | null>(null);
  isAdmin = signal(false);
  showAllSounds = signal(false);
  sounds = signal<Sound[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Computed
  displayedSounds = computed(() => {
    return this.sounds();
  });

  async ngOnInit() {
    // Check admin status
    this.isAdmin.set(this.authService.isInGroup('ADMIN'));

    // Get current user (try from cache first, then load if needed)
    let appUser = await firstValueFrom(this.appUserService.currentUser$);
    if (!appUser) {
      // User not in cache, try to load
      appUser = await this.appUserService.loadCurrentUser();
    }

    if (appUser?.id) {
      this.currentUserId.set(appUser.id);
      await this.loadSounds();
    } else {
      this.error.set(this.translate.instant('dashboard.userNotFound'));
      this.loading.set(false);
    }
  }

  async loadSounds() {
    this.loading.set(true);
    this.error.set(null);

    try {
      let sounds: Sound[];

      if (this.isAdmin() && this.showAllSounds()) {
        sounds = await this.dashboardService.loadAllSounds();
      } else {
        const userId = this.currentUserId();
        if (!userId) {
          throw new Error('User ID not available');
        }
        sounds = await this.dashboardService.loadUserSounds(userId);
      }

      this.sounds.set(sounds);
    } catch (err) {
      console.error('[Dashboard] Failed to load sounds:', err);
      this.error.set(this.translate.instant('dashboard.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  onToggleAllSounds() {
    this.loadSounds();
  }

  onSoundUpdated(updatedSound: Sound) {
    // Update the sound in the list
    const currentSounds = this.sounds();
    const index = currentSounds.findIndex((s) => s.id === updatedSound.id);
    if (index !== -1) {
      const newSounds = [...currentSounds];
      newSounds[index] = updatedSound;
      this.sounds.set(newSounds);
    }
  }

  onSoundDeleted(deletedSound: Sound) {
    // Remove the sound from the list
    const currentSounds = this.sounds();
    this.sounds.set(currentSounds.filter((s) => s.id !== deletedSound.id));
  }

  goToNewSound() {
    this.router.navigate(['/new-sound']);
  }
}
