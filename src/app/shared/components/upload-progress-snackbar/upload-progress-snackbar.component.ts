import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upload-progress-snackbar',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule],
  templateUrl: './upload-progress-snackbar.component.html',
  styleUrl: './upload-progress-snackbar.component.scss'
})

export class UploadProgressSnackbarComponent {
  readonly data = inject<{ progress: number }>(MAT_SNACK_BAR_DATA);
}
