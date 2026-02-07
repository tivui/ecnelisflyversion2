import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { FeaturedSoundService } from '../../../../../core/services/featured-sound.service';
import { AmplifyService } from '../../../../../core/services/amplify.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { FeaturedSoundCandidate } from '../../../../../core/models/featured-sound.model';
import { Sound } from '../../../../../core/models/sound.model';

interface DialogData {
  candidate: FeaturedSoundCandidate | null;
}

@Component({
  selector: 'app-featured-sound-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatAutocompleteModule,
    MatSlideToggleModule,
    TranslateModule,
  ],
  templateUrl: './featured-sound-dialog.component.html',
  styleUrl: './featured-sound-dialog.component.scss',
})
export class FeaturedSoundDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(
    MatDialogRef<FeaturedSoundDialogComponent>,
  );
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly featuredSoundService = inject(FeaturedSoundService);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  allSounds = signal<Sound[]>([]);
  filteredSounds = signal<Sound[]>([]);
  selectedSound = signal<Sound | null>(null);
  loadingSounds = signal(true);

  searchControl = new FormControl('');

  ngOnInit() {
    this.isEditMode.set(!!this.data.candidate);

    this.form = this.fb.group({
      soundId: [this.data.candidate?.soundId ?? '', Validators.required],
      teasing: [this.data.candidate?.teasing ?? '', Validators.required],
      teasing_fr: [this.data.candidate?.teasing_i18n?.['fr'] ?? ''],
      teasing_en: [this.data.candidate?.teasing_i18n?.['en'] ?? ''],
      teasing_es: [this.data.candidate?.teasing_i18n?.['es'] ?? ''],
      isActive: [this.data.candidate?.isActive ?? true],
      sortOrder: [this.data.candidate?.sortOrder ?? 0],
    });

    this.loadSounds();
    this.setupSearch();
  }

  private async loadSounds() {
    this.loadingSounds.set(true);
    try {
      const result =
        await this.amplifyService.client.queries.listSoundsForMap({});
      const sounds = (result.data ?? []).map((s: any) =>
        this.soundsService.map(s),
      );
      this.allSounds.set(sounds);
      this.filteredSounds.set(sounds.slice(0, 50));

      // If editing, find and set the selected sound
      if (this.data.candidate?.soundId) {
        const found = sounds.find(
          (s: Sound) => s.id === this.data.candidate!.soundId,
        );
        if (found) {
          this.selectedSound.set(found);
          this.searchControl.setValue(found.title, { emitEvent: false });
        }
      }
    } catch (error) {
      console.error('Error loading sounds:', error);
    } finally {
      this.loadingSounds.set(false);
    }
  }

  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        const search = (value ?? '').toLowerCase();
        if (!search) {
          this.filteredSounds.set(this.allSounds().slice(0, 50));
          return;
        }
        const filtered = this.allSounds().filter(
          (s) =>
            s.title.toLowerCase().includes(search) ||
            s.city?.toLowerCase().includes(search),
        );
        this.filteredSounds.set(filtered.slice(0, 50));
      });
  }

  selectSound(sound: Sound) {
    this.selectedSound.set(sound);
    this.form.patchValue({ soundId: sound.id });
    this.searchControl.setValue(sound.title, { emitEvent: false });
  }

  clearSound() {
    this.selectedSound.set(null);
    this.form.patchValue({ soundId: '' });
    this.searchControl.setValue('', { emitEvent: false });
  }

  displayFn(sound: Sound): string {
    return sound ? sound.title : '';
  }

  getLocalizedTitle(sound: Sound): string {
    const lang = this.translate.currentLang;
    if (sound.title_i18n && sound.title_i18n[lang]) {
      return sound.title_i18n[lang];
    }
    return sound.title;
  }

  async save() {
    if (!this.form.valid) {
      return;
    }

    this.saving.set(true);

    try {
      const formValue = this.form.value;
      const teasing_i18n: Record<string, string> = {};
      if (formValue.teasing_fr) teasing_i18n['fr'] = formValue.teasing_fr;
      if (formValue.teasing_en) teasing_i18n['en'] = formValue.teasing_en;
      if (formValue.teasing_es) teasing_i18n['es'] = formValue.teasing_es;

      const candidateData: Partial<FeaturedSoundCandidate> = {
        soundId: formValue.soundId,
        teasing: formValue.teasing,
        teasing_i18n:
          Object.keys(teasing_i18n).length > 0 ? teasing_i18n : undefined,
        isActive: formValue.isActive,
        sortOrder: formValue.sortOrder,
      };

      if (this.isEditMode()) {
        await this.featuredSoundService.updateCandidate(
          this.data.candidate!.id!,
          candidateData,
        );
      } else {
        await this.featuredSoundService.createCandidate(candidateData);
      }

      this.snackBar.open(
        this.translate.instant('admin.featuredSound.saveSuccess'),
        '',
        { duration: 3000 },
      );
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving candidate:', error);
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
