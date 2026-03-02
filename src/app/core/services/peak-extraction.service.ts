/**
 * Extract waveform peaks from an audio File using Web Audio API.
 * Used to pre-compute peaks for instant WaveSurfer rendering.
 *
 * Reproduces WaveSurfer v7's exact exportPeaks() algorithm:
 * - Decodes at 8000 Hz (WaveSurfer's default sampleRate) for identical peak distribution
 * - Separate peaks per channel (no mono merge) for asymmetric stereo rendering
 * - One value per bucket: sample with highest absolute magnitude, keeping its sign
 * - 4 decimal places precision (10000 multiplier)
 *
 * @param file The audio File object
 * @param maxLength Number of peak buckets per channel (default 800)
 * @returns Peaks in WaveSurfer format [[ch0_peaks], [ch1_peaks]] and duration in seconds
 */
export async function extractPeaksFromFile(
  file: File,
  maxLength = 800,
): Promise<{ peaks: number[][]; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  return extractPeaksFromArrayBuffer(arrayBuffer, maxLength);
}

/**
 * Extract waveform peaks from an ArrayBuffer (decoded audio).
 * Shared between upload flow (File) and migration tool (fetched audio).
 *
 * Matches WaveSurfer v7 exportPeaks() exactly:
 * - Decodes at 8000 Hz to match WaveSurfer's default AudioContext sampleRate
 * - Per-channel extraction (stereo → 2 arrays, mono → 1 array)
 * - Per bucket: if (Math.abs(n) > Math.abs(max)) max = n
 * - Precision: Math.round(max * 10000) / 10000
 */
export async function extractPeaksFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  maxLength = 800,
): Promise<{ peaks: number[][]; duration: number }> {
  // Decode at 8000 Hz — same as WaveSurfer's default sampleRate option.
  // This ensures the anti-aliasing filter produces identical peak distribution.
  const audioCtx = new AudioContext({ sampleRate: 8000 });
  const precision = 10000;

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    const numChannels = Math.min(audioBuffer.numberOfChannels, 2);

    const peaks: number[][] = [];

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      const data: number[] = [];
      const sampleSize = channelData.length / maxLength;

      for (let j = 0; j < maxLength; j++) {
        const start = Math.floor(j * sampleSize);
        const end = Math.ceil((j + 1) * sampleSize);
        let max = 0;
        for (let x = start; x < end; x++) {
          const n = channelData[x];
          if (Math.abs(n) > Math.abs(max)) {
            max = n;
          }
        }
        data.push(Math.round(max * precision) / precision);
      }

      peaks.push(data);
    }

    return {
      peaks,
      duration: Math.round(duration * 1000) / 1000,
    };
  } finally {
    await audioCtx.close();
  }
}
