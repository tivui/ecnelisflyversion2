import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { StorageService } from '../../../../../../core/services/storage.service';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Maximum file size in bytes (50 MB) */
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Browser-compatible audio MIME types and extensions */
const ALLOWED_AUDIO_TYPES: Record<string, string[]> = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/wave': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/flac': ['.flac'],
  'audio/aac': ['.aac'],
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/x-m4a': ['.m4a'],
  'audio/webm': ['.webm'],
  'audio/opus': ['.opus'],
};

const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.webm', '.opus'];

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
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './sound-upload-step.component.html',
  styleUrl: './sound-upload-step.component.scss',
})
export class SoundUploadStepComponent {
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);

  /** Expose constants to template */
  readonly maxSizeMB = MAX_FILE_SIZE_MB;
  readonly allowedExtensions = ALLOWED_EXTENSIONS.map((e) => e.toUpperCase().slice(1)).join(', ');

  @Output() uploaded = new EventEmitter<string>();

  selectedFile?: File;
  progress = 0;
  uploading = false;
  isUploaded = false;
  uploadedFilename?: string;
  error?: string;
  isDragging = false;

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
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.error = this.translate.instant('sound.upload.error-size', {
        max: MAX_FILE_SIZE_MB,
      });
      return;
    }

    // Validate MIME type
    if (!this.isValidAudioType(file)) {
      this.error = this.translate.instant('sound.upload.error-format');
      return;
    }

    this.error = undefined;
    this.selectedFile = file;
  }

  /**
   * Check if the file has a valid browser-compatible audio type
   */
  private isValidAudioType(file: File): boolean {
    // Check MIME type
    if (ALLOWED_AUDIO_TYPES[file.type]) {
      return true;
    }

    // Fallback: check extension (some browsers report incorrect MIME types)
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(extension);
  }

  upload() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.progress = 0;

    const { progress$, result } = this.storageService.uploadSound(
      this.selectedFile,
    );

    progress$.subscribe((value) => {
      this.progress = value;
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
      });
  }
}
