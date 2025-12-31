import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  MatSnackBar,
  MatSnackBarRef,
} from '@angular/material/snack-bar';

import { StorageService } from '../../../../../../core/services/storage.service';
import { UploadProgressSnackbarComponent } from '../../../../../../shared/components/upload-progress-snackbar/upload-progress-snackbar.component';

@Component({
  selector: 'app-sound-upload-step',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './sound-upload-step.component.html',
})
export class SoundUploadStepComponent {
  private readonly storageService = inject(StorageService);
  private readonly snackBar = inject(MatSnackBar);

  @Output() uploaded = new EventEmitter<string>();

  selectedFile?: File;
  progress = 0;
  uploading = false;
  error?: string;

  private snackbarRef?: MatSnackBarRef<UploadProgressSnackbarComponent>;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (!file.type.startsWith('audio/')) {
      this.error = 'Fichier audio requis';
      return;
    }

    this.error = undefined;
    this.selectedFile = file;
  }

  upload() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.progress = 0;

    // 🔔 SnackBar d’upload
    this.snackbarRef = this.snackBar.openFromComponent(
      UploadProgressSnackbarComponent,
      {
        data: { progress: 0 },
        verticalPosition: 'top',
        horizontalPosition: 'center',
        panelClass: ['upload-snackbar'],
      }
    );

    const { progress$, result } =
      this.storageService.uploadSound(this.selectedFile);

    progress$.subscribe((value) => {
      this.progress = value;

      // 🔄 update dynamique du widget
      if (this.snackbarRef) {
        this.snackbarRef.instance.data.progress = value;
      }
    });

    result
      .then((res) => {
        this.uploaded.emit(res.path);
      })
      .catch(() => {
        this.error = "Erreur lors de l'upload";
      })
      .finally(() => {
        this.uploading = false;

        // ✅ fermeture élégante
        setTimeout(() => this.snackbarRef?.dismiss(), 500);
      });
  }
}
