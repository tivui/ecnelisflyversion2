import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StorageService } from '../../../../../../core/services/storage.service';

@Component({
  selector: 'app-sound-upload-step',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressBarModule],
  templateUrl: './sound-upload-step.component.html',
})
export class SoundUploadStepComponent {
  private storageService = inject(StorageService);

  @Output() uploaded = new EventEmitter<string>();

  selectedFile?: File;
  progress = 0;
  uploading = false;
  error?: string;

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

    const { progress$, result } =
      this.storageService.uploadSound(this.selectedFile);

    progress$.subscribe((value) => {
      this.progress = value;
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
      });
  }
}
