import { inject, Injectable } from '@angular/core';
import { getUrl, list, uploadData } from 'aws-amplify/storage';
import { Observable } from 'rxjs/internal/Observable';
import { generateUniqueFilename } from './filename.service';
import { AmplifyService } from './amplify.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly basePath = 'sounds/';
  private readonly amplifyService = inject(AmplifyService);

  /**
   * Get a presigned URL for a sound file
   * @param filename File name (ex: "foo.wav")
   */
  async getSoundUrl(filename: string): Promise<string> {
    const { url } = await getUrl({
      path: `${this.basePath}${filename}`,
      options: { expiresIn: 3600 },
    });
    return url.toString();
  }

  /**
   * List all sound files in the sounds/ folder
   */
  async listStorageSounds(): Promise<string[]> {
    const result = await list({ path: this.basePath });

    // Map to only return filenames without the base path
    return result.items.map((item) => item.path.replace(this.basePath, ''));
  }

/**
   * Upload a sound file with progress tracking
   * @returns Object with progress$ observable and result promise containing the sanitized filename
   */
  uploadSound(
    file: File
  ): {
    progress$: Observable<number>;
    result: Promise<{ filename: string }>;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;

    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    // Generate a unique sanitized filename
    const sanitizedFilename = generateUniqueFilename(file.name);
    const fullPath = `${this.basePath}${sanitizedFilename}`;

    const uploadTask = uploadData({
      path: fullPath,
      data: file,
      options: {
        contentType: file.type,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (totalBytes && progressObserver) {
            const percent = Math.round(
              (transferredBytes / totalBytes) * 100
            );
            progressObserver.next(percent);
          }
        },
      },
    });

    const result = uploadTask.result
      .then(() => ({ filename: sanitizedFilename }))
      .finally(() => {
        progressObserver?.complete();
      });

    return { progress$, result };
  }

  /**
   * Delete a sound file from S3 via Lambda
   * (authenticated users don't have direct S3 delete permissions)
   * @param filename File name only (e.g., "my-sound-1704067200000.mp3")
   * @returns true if deletion succeeded
   */
  async deleteSound(filename: string): Promise<boolean> {
    try {
      const result = await this.amplifyService.client.mutations.deleteSoundFile({
        filename,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any =
        typeof result.data === 'string'
          ? JSON.parse(result.data)
          : result.data;

      if (parsed?.success) {
        console.log(`[StorageService] Deleted: ${filename}`);
        return true;
      }

      console.warn(`[StorageService] Delete failed for ${filename}:`, parsed?.error);
      return false;
    } catch (error) {
      console.error(`[StorageService] Error deleting ${filename}:`, error);
      return false;
    }
  }
}
