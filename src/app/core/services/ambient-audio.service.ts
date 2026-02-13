import { Injectable, signal } from '@angular/core';

/**
 * Service for managing ambient background audio (looping soundscapes).
 * Used by terroir zones to create an immersive experience.
 * Mute preference lasts for the current session only (sessionStorage).
 */
@Injectable({ providedIn: 'root' })
export class AmbientAudioService {
  private audio: HTMLAudioElement | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  isPlaying = signal(false);
  volume = signal(0.3);
  isUserMuted = signal(this.loadMutePreference());
  currentTrackUrl = signal('');

  constructor() {
    // Clean up legacy localStorage key from previous implementation
    localStorage.removeItem('ambientMuted');
  }

  /**
   * Start ambient sound with fade-in.
   * Respects user mute preference.
   * Handles browser autoplay policy gracefully.
   */
  play(url: string, fadeInMs = 2000): void {
    // If same track already playing, skip
    if (this.audio && this.currentTrackUrl() === url && this.isPlaying()) {
      return;
    }

    // Stop any existing track first
    this.stopImmediate();

    // Respect user mute preference
    if (this.isUserMuted()) {
      this.currentTrackUrl.set(url);
      return;
    }

    this.currentTrackUrl.set(url);

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    this.audio = audio;

    // Attempt autoplay with graceful fallback
    audio
      .play()
      .then(() => {
        this.isPlaying.set(true);
        this.fadeIn(fadeInMs);
      })
      .catch(() => {
        // Browser blocked autoplay — mark as muted so UI reflects reality
        console.info('[AmbientAudio] Autoplay blocked by browser, showing muted state');
        this.isPlaying.set(false);
        this.isUserMuted.set(true);
      });
  }

  /**
   * Stop ambient sound with fade-out.
   */
  stop(fadeOutMs = 1000): void {
    if (!this.audio || !this.isPlaying()) {
      this.stopImmediate();
      return;
    }

    this.clearFade();

    const startVol = this.audio.volume;
    const steps = 20;
    const stepMs = fadeOutMs / steps;
    const stepVol = startVol / steps;
    let current = startVol;

    this.fadeTimer = setInterval(() => {
      current -= stepVol;
      if (current <= 0 || !this.audio) {
        this.stopImmediate();
        return;
      }
      this.audio.volume = Math.max(0, current);
    }, stepMs);
  }

  /**
   * Toggle mute/unmute. Persists preference in sessionStorage (current session only).
   */
  toggleMute(): void {
    const muted = !this.isUserMuted();
    this.isUserMuted.set(muted);
    this.saveMutePreference(muted);

    if (muted) {
      // Fade out
      this.stop(500);
    } else {
      // Resume playing if we have a track URL
      const url = this.currentTrackUrl();
      if (url) {
        this.play(url, 1000);
      }
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol: number): void {
    this.volume.set(vol);
    if (this.audio && this.isPlaying()) {
      this.audio.volume = vol;
    }
  }

  /**
   * Duck (lower volume) when another audio source plays.
   * Different from mute — does not persist to localStorage.
   */
  private ducked = false;

  duck(durationMs = 1200): void {
    if (!this.audio || !this.isPlaying() || this.ducked) return;
    this.ducked = true;
    this.clearFade();

    // Smooth fade to silence with ease-out curve
    const startVol = this.audio.volume;
    const steps = 30;
    const stepMs = durationMs / steps;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      if (step >= steps || !this.audio) {
        if (this.audio) this.audio.volume = 0;
        this.clearFade();
        return;
      }
      // Ease-out: fast start, gentle end
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      this.audio.volume = Math.max(0, startVol * (1 - eased));
    }, stepMs);
  }

  unduck(durationMs = 1500): void {
    if (!this.ducked) return;
    this.ducked = false;
    if (!this.audio || !this.isPlaying() || this.isUserMuted()) return;
    this.clearFade();

    // Smooth fade back to normal volume with ease-in curve
    const targetVol = this.volume();
    const steps = 30;
    const stepMs = durationMs / steps;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      if (step >= steps || !this.audio) {
        if (this.audio) this.audio.volume = targetVol;
        this.clearFade();
        return;
      }
      // Ease-in: gentle start, accelerates
      const progress = step / steps;
      const eased = Math.pow(progress, 2);
      this.audio.volume = Math.min(targetVol, targetVol * eased);
    }, stepMs);
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.stopImmediate();
    this.currentTrackUrl.set('');
  }

  // --- Private helpers ---

  private fadeIn(durationMs: number): void {
    if (!this.audio) return;

    this.clearFade();

    const targetVol = this.volume();
    const steps = 20;
    const stepMs = durationMs / steps;
    const stepVol = targetVol / steps;
    let current = 0;

    this.fadeTimer = setInterval(() => {
      current += stepVol;
      if (current >= targetVol || !this.audio) {
        if (this.audio) this.audio.volume = targetVol;
        this.clearFade();
        return;
      }
      this.audio.volume = current;
    }, stepMs);
  }

  private stopImmediate(): void {
    this.clearFade();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.isPlaying.set(false);
  }

  private clearFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private loadMutePreference(): boolean {
    return sessionStorage.getItem('ambientMuted') === 'true';
  }

  private saveMutePreference(muted: boolean): void {
    sessionStorage.setItem('ambientMuted', muted ? 'true' : 'false');
  }
}
