import { Component, inject, signal, OnDestroy } from '@angular/core';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { uploadData } from 'aws-amplify/storage';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
    selector: 'app-import-sounds',
    imports: [
        MatFormFieldModule,
        MatInputModule,
        MatIcon,
        MatButtonModule,
        MatProgressBarModule,
    ],
    templateUrl: './import-sounds.component.html',
    styleUrl: './import-sounds.component.scss'
})
export class ImportSoundsComponent implements OnDestroy {
  private readonly amplify = inject(AmplifyService);

  fileName = '';
  isUploading = signal(false);
  isProcessing = signal(false);
  totalSounds = signal(0);
  processedCount = signal(0);
  importedCount = signal(0);
  skippedCount = signal(0);
  progressPercent = signal(0);
  jobStatus = signal('');
  message = signal('');
  errorMessage = signal('');

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.stopPolling();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    this.resetState();

    try {
      // Step 1: Upload JSON to S3
      this.isUploading.set(true);
      this.message.set('Upload du fichier JSON vers S3...');

      const s3Key = `imports/${Date.now()}-${file.name}`;
      await uploadData({
        path: s3Key,
        data: file,
        options: { contentType: 'application/json' },
      }).result;

      this.isUploading.set(false);
      this.message.set('Fichier uploadé. Lancement de l\'import...');

      // Step 2: Call startImport mutation
      const client = this.amplify.client;
      const result = await client.mutations.startImport({ s3Key });

      const parsed =
        typeof result.data === 'string'
          ? JSON.parse(result.data)
          : result.data;

      if (!parsed?.success || !parsed?.jobId) {
        this.errorMessage.set(
          `Erreur au lancement : ${parsed?.error || 'Erreur inconnue'}`,
        );
        this.message.set('');
        return;
      }

      this.isProcessing.set(true);
      this.message.set('Import en cours...');

      // Step 3: Start polling
      this.startPolling(parsed.jobId);
    } catch (error) {
      console.error('Import error:', error);
      this.errorMessage.set('Erreur pendant le processus d\'import.');
      this.isUploading.set(false);
      this.isProcessing.set(false);
    }
  }

  private startPolling(jobId: string) {
    this.pollingInterval = setInterval(async () => {
      try {
        const client = this.amplify.client;
        const result = await client.models.ImportJob.get({ id: jobId });
        const job = result.data;

        if (!job) return;

        this.jobStatus.set(job.status ?? '');
        this.totalSounds.set(job.totalSounds ?? 0);
        this.processedCount.set(job.processedCount ?? 0);
        this.importedCount.set(job.importedCount ?? 0);
        this.skippedCount.set(job.skippedCount ?? 0);

        if (job.totalSounds && job.totalSounds > 0) {
          this.progressPercent.set(
            Math.round(((job.processedCount ?? 0) / job.totalSounds) * 100),
          );
        }

        if (job.status === 'PROCESSING') {
          this.message.set(
            `Import en cours : ${job.processedCount ?? 0} / ${job.totalSounds ?? '?'} sons traités...`,
          );
        }

        if (job.status === 'COMPLETED') {
          this.stopPolling();
          this.isProcessing.set(false);
          this.progressPercent.set(100);
          this.message.set(
            `Import terminé ! ${job.importedCount} importés, ` +
              `${job.skippedCount} ignorés, ` +
              `${job.invalidCategoryCount} catégories invalides, ` +
              `${job.invalidDatesCount} dates invalides, ` +
              `${job.emptyHashtagsCount} hashtags vides.`,
          );
        } else if (job.status === 'FAILED') {
          this.stopPolling();
          this.isProcessing.set(false);
          this.errorMessage.set(
            `Import échoué : ${job.errorMessage || 'Erreur inconnue'}`,
          );
          this.message.set('');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private resetState() {
    this.totalSounds.set(0);
    this.processedCount.set(0);
    this.importedCount.set(0);
    this.skippedCount.set(0);
    this.progressPercent.set(0);
    this.jobStatus.set('');
    this.message.set('');
    this.errorMessage.set('');
    this.isUploading.set(false);
    this.isProcessing.set(false);
    this.stopPolling();
  }
}
