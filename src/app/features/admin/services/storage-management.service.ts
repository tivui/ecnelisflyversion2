import { inject, Injectable } from '@angular/core';
import { StorageService } from '../../../core/services/storage.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { AmplifyService } from '../../../core/services/amplify.service';
import { Sound } from '../../../core/models/sound.model';

export interface S3FileInfo {
  filename: string;
  path: string;
  size: number;
  lastModified: Date;
  format: string;
}

export interface StorageFileEntry extends S3FileInfo {
  linkedSound?: {
    id: string;
    title: string;
    status: string;
    category?: string;
    username?: string;
  };
}

export interface BrokenReference {
  soundId: string;
  filename: string;
  title: string;
  status: string;
  category?: string;
  username?: string;
  /** If a case-insensitive match exists on S3, this is the correct filename */
  suggestedFilename?: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  avgSize: number;
  largestFile: { filename: string; size: number } | null;
  monthlyCostEstimate: number;
  orphanCount: number;
  orphanSize: number;
  brokenRefCount: number;
  formatDistribution: { name: string; value: number }[];
  sizeDistribution: { name: string; value: number }[];
  categoryDistribution: { name: string; value: number }[];
  uploadTimeline: { name: string; value: number }[];
}

export interface StorageLoadResult {
  files: StorageFileEntry[];
  brokenRefs: BrokenReference[];
  stats: StorageStats;
}

@Injectable({
  providedIn: 'root',
})
export class StorageManagementService {
  private readonly storageService = inject(StorageService);
  private readonly dashboardService = inject(DashboardService);
  private readonly amplifyService = inject(AmplifyService);

  async loadAll(): Promise<StorageLoadResult> {
    const [s3Files, allSounds] = await Promise.all([
      this.storageService.listStorageSoundsWithMetadata(),
      this.dashboardService.loadAllSounds(),
    ]);

    // Build lookup maps
    const soundByFilename = new Map<string, Sound>();
    for (const sound of allSounds) {
      if (sound.filename) {
        soundByFilename.set(sound.filename, sound);
      }
    }

    const s3FilenameSet = new Set(s3Files.map((f) => f.filename));

    // Case-insensitive S3 lookup (lowercase → actual filename)
    const s3FilenameLCMap = new Map<string, string>();
    for (const f of s3Files) {
      s3FilenameLCMap.set(f.filename.toLowerCase(), f.filename);
    }

    // Cross-reference: enrich S3 files with DynamoDB info
    const files: StorageFileEntry[] = s3Files.map((f) => {
      const sound = soundByFilename.get(f.filename);
      const format = this.extractFormat(f.filename);
      return {
        ...f,
        format,
        linkedSound: sound
          ? {
              id: sound.id!,
              title: sound.title,
              status: sound.status ?? 'unknown',
              category: sound.category,
              username: sound.user?.username,
            }
          : undefined,
      };
    });

    // Detect broken references: DynamoDB records without S3 file
    const brokenRefs: BrokenReference[] = allSounds
      .filter((s) => s.filename && !s3FilenameSet.has(s.filename))
      .map((s) => {
        // Check for case-insensitive match on S3
        const suggested = s3FilenameLCMap.get(s.filename.toLowerCase());
        return {
          soundId: s.id!,
          filename: s.filename,
          title: s.title,
          status: s.status ?? 'unknown',
          category: s.category,
          username: s.user?.username,
          suggestedFilename: suggested && suggested !== s.filename ? suggested : undefined,
        };
      });

    // Compute stats
    const stats = this.computeStats(files, brokenRefs);

    return { files, brokenRefs, stats };
  }

  async deleteOrphan(filename: string): Promise<boolean> {
    return this.storageService.deleteSound(filename);
  }

  async deleteBrokenRef(soundId: string): Promise<void> {
    await this.amplifyService.client.models.Sound.delete({ id: soundId });
  }

  async repairBrokenRef(soundId: string, correctFilename: string): Promise<void> {
    await this.amplifyService.client.models.Sound.update({
      id: soundId,
      filename: correctFilename,
    });
  }

  private extractFormat(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return ext;
  }

  private computeStats(
    files: StorageFileEntry[],
    brokenRefs: BrokenReference[],
  ): StorageStats {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const avgSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    const largestFile =
      files.length > 0
        ? files.reduce(
            (max, f) => (f.size > max.size ? f : max),
            files[0],
          )
        : null;

    const orphanFiles = files.filter((f) => !f.linkedSound);
    const orphanCount = orphanFiles.length;
    const orphanSize = orphanFiles.reduce((sum, f) => sum + f.size, 0);

    // $0.023 per GB per month (S3 Standard)
    const monthlyCostEstimate = (totalSize / 1e9) * 0.023;

    // Format distribution (count)
    const formatMap = new Map<string, number>();
    for (const f of files) {
      const fmt = f.format || 'unknown';
      formatMap.set(fmt, (formatMap.get(fmt) ?? 0) + 1);
    }
    const formatDistribution = [...formatMap.entries()]
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value);

    // Size distribution (count by range)
    const sizeRanges = [
      { name: '< 1 MB', max: 1e6 },
      { name: '1-5 MB', max: 5e6 },
      { name: '5-10 MB', max: 10e6 },
      { name: '10-25 MB', max: 25e6 },
      { name: '25-50 MB', max: 50e6 },
    ];
    const sizeDistribution = sizeRanges.map((range, i) => {
      const min = i === 0 ? 0 : sizeRanges[i - 1].max;
      return {
        name: range.name,
        value: files.filter((f) => f.size >= min && f.size < range.max).length,
      };
    });

    // Category distribution (total size by category)
    const categoryMap = new Map<string, number>();
    for (const f of files) {
      if (f.linkedSound?.category) {
        const cat = f.linkedSound.category;
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + f.size);
      } else {
        categoryMap.set(
          'uncategorized',
          (categoryMap.get('uncategorized') ?? 0) + f.size,
        );
      }
    }
    const categoryDistribution = [...categoryMap.entries()]
      .map(([name, value]) => ({
        name,
        value: Math.round(value / 1e6), // MB
      }))
      .sort((a, b) => b.value - a.value);

    // Upload timeline (last 12 months)
    const now = new Date();
    const uploadTimeline: { name: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const count = files.filter(
        (f) => f.lastModified >= monthStart && f.lastModified < monthEnd,
      ).length;
      uploadTimeline.push({ name: monthLabel, value: count });
    }

    return {
      totalFiles,
      totalSize,
      avgSize,
      largestFile: largestFile
        ? { filename: largestFile.filename, size: largestFile.size }
        : null,
      monthlyCostEstimate,
      orphanCount,
      orphanSize,
      brokenRefCount: brokenRefs.length,
      formatDistribution,
      sizeDistribution,
      categoryDistribution,
      uploadTimeline,
    };
  }
}
