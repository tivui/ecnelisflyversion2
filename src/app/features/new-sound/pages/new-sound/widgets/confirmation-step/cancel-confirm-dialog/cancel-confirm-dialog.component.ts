import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-cancel-confirm-dialog',
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        TranslateModule,
    ],
    templateUrl: './cancel-confirm-dialog.component.html',
    styleUrl: './cancel-confirm-dialog.component.scss'
})
export class CancelConfirmDialogComponent {
  constructor(public dialogRef: MatDialogRef<CancelConfirmDialogComponent>) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
