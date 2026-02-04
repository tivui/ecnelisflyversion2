import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { StorageService } from '../../../../../../core/services/storage.service';
import { UploadProgressSnackbarComponent } from '../../../../../../shared/components/upload-progress-snackbar/upload-progress-snackbar.component';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-sound-upload-step',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    TranslateModule,
  ],
  templateUrl: './sound-upload-step.component.html',
  styleUrl: './sound-upload-step.component.scss',
})
export class SoundUploadStepComponent {
  private readonly storageService = inject(StorageService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  @Output() uploaded = new EventEmitter<string>();

  selectedFile?: File;
  progress = 0;
  uploading = false;
  isUploaded = false;
  uploadedFilename?: string;
  error?: string;
  isDragging = false;

  private snackbarRef?: MatSnackBarRef<UploadProgressSnackbarComponent>;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.processFile(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File) {
    if (!file.type.startsWith('audio/')) {
      this.error = this.translate.instant('sound.upload.error-type');
      return;
    }

    this.error = undefined;
    this.selectedFile = file;
  }

  upload() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.progress = 0;

    // upload SnackBar
    this.snackbarRef = this.snackBar.openFromComponent(
      UploadProgressSnackbarComponent,
      {
        data: { progress: 0 },
        verticalPosition: 'top',
        horizontalPosition: 'center',
        panelClass: ['upload-snackbar'],
      },
    );

    const { progress$, result } = this.storageService.uploadSound(
      this.selectedFile,
    );

    progress$.subscribe((value) => {
      this.progress = value;

      // widget dynamic update
      if (this.snackbarRef) {
        this.snackbarRef.instance.data.progress = value;
      }
    });

    result
      .then((res) => {
        this.isUploaded = true;
        this.uploadedFilename = res.filename;
        this.uploaded.emit(res.filename);
      })
      .catch(() => {
        this.error = this.translate.instant('sound.upload.error-upload');
      })
      .finally(() => {
        this.uploading = false;

        // close snackbar after a short delay
        setTimeout(() => this.snackbarRef?.dismiss(), 500);
      });
  }
}
