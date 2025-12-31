import { Injectable } from '@angular/core';
import { getUrl, list, uploadData } from 'aws-amplify/storage';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly basePath = 'sounds/';

  /**
   * Get a presigned URL for a sound file
   * @param filename File name (ex: "foo.wav")
   */
  async getSoundUrl(filename: string): Promise<string> {
    const { url } = await getUrl({
      path: `${this.basePath}${filename}`,
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
   */
  uploadSound(
    file: File
  ): {
    progress$: Observable<number>;
    result: Promise<{ path: string }>;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;

    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const uploadTask = uploadData({
      path: `${this.basePath}${file.name}`,
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

    const result = uploadTask.result.finally(() => {
      progressObserver?.complete();
    });

    return { progress$, result };
  }
}
