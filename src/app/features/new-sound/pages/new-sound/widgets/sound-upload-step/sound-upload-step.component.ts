import { ChangeDetectorRef, Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { StorageService } from '../../../../../../core/services/storage.service';
import { extractPeaksFromFile } from '../../../../../../core/services/peak-extraction.service';
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
    styleUrl: './sound-upload-step.component.scss'
})
export class SoundUploadStepComponent {
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Expose constants to template */
  readonly maxSizeMB = MAX_FILE_SIZE_MB;
  readonly allowedExtensions = ALLOWED_EXTENSIONS.map((e) => e.toUpperCase().slice(1)).join(', ');

  @Output() uploaded = new EventEmitter<string>();
  @Output() peaksExtracted = new EventEmitter<{ peaks: number[][]; duration: number }>();

  selectedFile?: File;
  progress = 0;
  uploading = false;
  isUploaded = false;
  uploadedFilename?: string;
  error?: string;
  isDragging = false;
  private simulatedTimer: ReturnType<typeof setInterval> | null = null;

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

    // Extract waveform peaks in background (non-blocking for the upload flow)
    extractPeaksFromFile(file)
      .then((data) => this.peaksExtracted.emit(data))
      .catch((err) => console.warn('[SoundUpload] Peak extraction failed:', err));
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

  async upload() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.progress = 0;
    let useRealProgress = false;
    this.startSimulatedProgress(this.selectedFile.size);

    try {
      const res = await this.storageService.uploadSound(
        this.selectedFile,
        (percent) => {
          // Real onProgress from Amplify — switch from simulation to real
          if (!useRealProgress && percent > 0 && percent < 100) {
            useRealProgress = true;
            this.stopSimulatedProgress();
          }
          if (useRealProgress) {
            this.progress = percent;
            this.cdr.markForCheck();
          }
        },
      );
      this.stopSimulatedProgress();
      this.progress = 100;
      this.isUploaded = true;
      this.uploadedFilename = res.filename;
      this.uploaded.emit(res.filename);
    } catch {
      this.stopSimulatedProgress();
      this.error = this.translate.instant('sound.upload.error-upload');
    } finally {
      this.uploading = false;
    }
  }

  /**
   * Simulate smooth progress based on file size.
   * Fallback when Amplify onProgress doesn't fire granularly.
   * Curve: fast start, slows down approaching 90%, waits for real completion.
   */
  private startSimulatedProgress(fileSize: number) {
    this.stopSimulatedProgress();
    // Estimate total time: ~1 MB/s upload speed (conservative)
    const estimatedSeconds = Math.max(fileSize / (1024 * 1024), 2);
    const maxSimulated = 90;
    const intervalMs = 200;
    const totalTicks = (estimatedSeconds * 1000) / intervalMs;
    let tick = 0;

    this.simulatedTimer = setInterval(() => {
      tick++;
      const t = Math.min(tick / totalTicks, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      this.progress = Math.min(Math.round(eased * maxSimulated), maxSimulated);
      this.cdr.markForCheck();

      if (this.progress >= maxSimulated) {
        this.stopSimulatedProgress();
      }
    }, intervalMs);
  }

  private stopSimulatedProgress() {
    if (this.simulatedTimer) {
      clearInterval(this.simulatedTimer);
      this.simulatedTimer = null;
    }
  }
}
