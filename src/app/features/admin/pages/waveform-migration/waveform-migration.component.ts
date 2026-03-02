import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AmplifyService } from '../../../../core/services/amplify.service';
import { StorageService } from '../../../../core/services/storage.service';
import { extractPeaksFromArrayBuffer } from '../../../../core/services/peak-extraction.service';

interface MigrationError {
  filename: string;
  error: string;
}

@Component({
    selector: 'app-waveform-migration',
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
        MatListModule,
        MatChipsModule,
        TranslateModule,
    ],
    templateUrl: './waveform-migration.component.html',
    styleUrl: './waveform-migration.component.scss',
})
export class WaveformMigrationComponent implements OnDestroy {
  private readonly amplifyService = inject(AmplifyService);
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);

  // State
  totalSounds = signal(0);
  processedCount = signal(0);
  errorCount = signal(0);
  skippedCount = signal(0);
  currentFilename = signal('');
  isRunning = signal(false);
  isPaused = signal(false);
  isScanning = signal(false);
  scanComplete = signal(false);
  errors = signal<MigrationError[]>([]);

  private shouldStop = false;
  private shouldPause = false;

  get progressPercent(): number {
    const total = this.totalSounds();
    if (total === 0) return 0;
    return Math.round(((this.processedCount() + this.skippedCount() + this.errorCount()) / total) * 100);
  }

  async scan() {
    this.isScanning.set(true);
    this.scanComplete.set(false);
    this.totalSounds.set(0);

    try {
      const sounds = await this.listSoundsWithoutPeaks();
      this.totalSounds.set(sounds.length);
      this.scanComplete.set(true);
    } catch (err) {
      console.error('[WaveformMigration] Scan error:', err);
    } finally {
      this.isScanning.set(false);
    }
  }

  async start() {
    this.isRunning.set(true);
    this.isPaused.set(false);
    this.shouldStop = false;
    this.shouldPause = false;
    this.processedCount.set(0);
    this.errorCount.set(0);
    this.skippedCount.set(0);
    this.errors.set([]);
    this.currentFilename.set('');

    try {
      const sounds = await this.listSoundsWithoutPeaks();
      this.totalSounds.set(sounds.length);

      if (sounds.length === 0) {
        this.isRunning.set(false);
        this.scanComplete.set(true);
        return;
      }

      for (const sound of sounds) {
        if (this.shouldStop) break;

        // Pause loop
        while (this.shouldPause && !this.shouldStop) {
          await this.sleep(200);
        }
        if (this.shouldStop) break;

        const filename = sound.filename as string;
        this.currentFilename.set(filename);

        try {
          // Get presigned S3 URL
          const url = await this.storageService.getSoundUrl(filename);

          // Fetch the audio file
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();

          // Extract peaks
          const { peaks, duration } = await extractPeaksFromArrayBuffer(arrayBuffer);

          // Update DynamoDB record
          await this.amplifyService.client.models.Sound.update({
            id: sound.id as string,
            waveformPeaks: JSON.stringify(peaks),
            waveformDuration: duration,
          });

          this.processedCount.update(c => c + 1);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[WaveformMigration] Error processing ${filename}:`, err);
          this.errorCount.update(c => c + 1);
          this.errors.update(list => [...list, { filename, error: errorMsg }]);
        }
      }
    } catch (err) {
      console.error('[WaveformMigration] Fatal error:', err);
    } finally {
      this.isRunning.set(false);
      this.isPaused.set(false);
      this.currentFilename.set('');
    }
  }

  pause() {
    this.shouldPause = true;
    this.isPaused.set(true);
  }

  resume() {
    this.shouldPause = false;
    this.isPaused.set(false);
  }

  stop() {
    this.shouldStop = true;
    this.shouldPause = false;
    this.isPaused.set(false);
  }

  ngOnDestroy() {
    this.shouldStop = true;
    this.shouldPause = false;
  }

  /**
   * Paginate all sounds that don't have waveformPeaks yet.
   */
  private async listSoundsWithoutPeaks(): Promise<{ id: unknown; filename: unknown }[]> {
    const allSounds: { id: unknown; filename: unknown }[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      const result: { data: unknown[]; nextToken?: string | null } =
        await this.amplifyService.client.models.Sound.list({
          limit: 500,
          nextToken: nextToken as string | undefined,
          selectionSet: ['id', 'filename', 'waveformPeaks'],
        });

      const sounds = result.data || [];
      for (const s of sounds) {
        const sound = s as { id: unknown; filename: unknown; waveformPeaks: unknown };
        // Only include sounds without peaks and with a valid filename
        if (!sound.waveformPeaks && sound.filename) {
          allSounds.push({ id: sound.id, filename: sound.filename });
        }
      }

      nextToken = result.nextToken;
    } while (nextToken);

    return allSounds;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
