import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ZoneService } from '../../../../../core/services/zone.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { Zone } from '../../../../../core/models/zone.model';
import { Sound } from '../../../../../core/models/sound.model';

interface DialogData {
  zone: Zone;
}

@Component({
  selector: 'app-zone-sounds-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './zone-sounds-dialog.component.html',
  styleUrl: './zone-sounds-dialog.component.scss',
})
export class ZoneSoundsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ZoneSoundsDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly zoneService = inject(ZoneService);
  private readonly soundsService = inject(SoundsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  zone = this.data.zone;
  zoneSounds = signal<Sound[]>([]);
  allSounds = signal<Sound[]>([]);
  filteredSounds = signal<Sound[]>([]);
  loading = signal(true);
  adding = signal(false);

  searchControl = new FormControl('');

  ngOnInit() {
    this.loadData();
    this.setupSearch();
  }

  private async loadData() {
    this.loading.set(true);
    try {
      // Load sounds in this zone
      const sounds = await this.zoneService.getSoundsForZone(this.zone.id!);
      this.zoneSounds.set(sounds);

      // Load all public sounds for selection (paginated, no Lambda)
      const allSounds = await this.soundsService.fetchAllPublicSounds();
      this.allSounds.set(allSounds);
      this.updateFilteredSounds();
    } catch (error) {
      console.error('Error loading sounds:', error);
      this.snackBar.open(
        this.translate.instant('admin.zones.sounds.loadError'),
        '',
        { duration: 3000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.updateFilteredSounds();
      });
  }

  private updateFilteredSounds() {
    const search = (this.searchControl.value ?? '').toLowerCase();
    const existingIds = new Set(this.zoneSounds().map((s) => s.id));

    let filtered = this.allSounds().filter((s) => !existingIds.has(s.id));

    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(search) ||
          s.city?.toLowerCase().includes(search)
      );
    }

    this.filteredSounds.set(filtered.slice(0, 50)); // Limit for performance
  }

  async addSound(sound: Sound) {
    this.adding.set(true);
    try {
      await this.zoneService.addSoundToZone(this.zone.id!, sound.id!);
      this.zoneSounds.update((sounds) => [...sounds, sound]);
      this.updateFilteredSounds();
      this.searchControl.setValue('');
      this.snackBar.open(
        this.translate.instant('admin.zones.sounds.addSuccess'),
        '',
        { duration: 2000 }
      );
    } catch (error) {
      console.error('Error adding sound:', error);
      this.snackBar.open(
        this.translate.instant('admin.zones.sounds.addError'),
        '',
        { duration: 3000 }
      );
    } finally {
      this.adding.set(false);
    }
  }

  async removeSound(sound: Sound) {
    try {
      await this.zoneService.removeSoundFromZone(this.zone.id!, sound.id!);
      this.zoneSounds.update((sounds) => sounds.filter((s) => s.id !== sound.id));
      this.updateFilteredSounds();
      this.snackBar.open(
        this.translate.instant('admin.zones.sounds.removeSuccess'),
        '',
        { duration: 2000 }
      );
    } catch (error) {
      console.error('Error removing sound:', error);
      this.snackBar.open(
        this.translate.instant('admin.zones.sounds.removeError'),
        '',
        { duration: 3000 }
      );
    }
  }

  close() {
    this.dialogRef.close();
  }

  getLocalizedTitle(sound: Sound): string {
    const lang = this.translate.currentLang;
    if (sound.title_i18n && sound.title_i18n[lang]) {
      return sound.title_i18n[lang];
    }
    return sound.title;
  }
}
