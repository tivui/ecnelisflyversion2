import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Schema } from '../../data/resource';

const s3 = new S3Client();

export const handler: Schema['deleteSoundFile']['functionHandler'] = async (
  event,
) => {
  const { filename } = event.arguments;

  // Validate filename
  if (!filename) {
    return { success: false, error: 'Missing filename argument' };
  }

  // Security: prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    return { success: false, error: 'Invalid filename' };
  }

  const bucketName = process.env.ECNELISFLY_STORAGE_BUCKET_NAME;
  if (!bucketName) {
    console.error('[DELETE-SOUND-FILE] ECNELISFLY_STORAGE_BUCKET_NAME not set');
    return { success: false, error: 'Bucket not configured' };
  }

  const key = `sounds/${filename}`;

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    console.log(`[DELETE-SOUND-FILE] Successfully deleted: ${key}`);
    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[DELETE-SOUND-FILE] Failed to delete ${key}:`, err);
    return { success: false, error: message };
  }
};
