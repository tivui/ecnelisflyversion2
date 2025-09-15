import { Injectable } from '@angular/core';
import { getUrl, list } from 'aws-amplify/storage';

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
}
