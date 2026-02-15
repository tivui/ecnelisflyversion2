import { Injectable, signal } from '@angular/core';

/**
 * Web Audio API synthesis service for the interactive "Gooey Logo" feature.
 * All sounds are generated in real-time — no audio files needed.
 * Inspired by World of Goo: elastic, bubbly, satisfying.
 */
@Injectable({ providedIn: 'root' })
export class GooeyAudioService {
  private ctx: AudioContext | null = null;
  private _enabled = signal(false);
  readonly enabled = this._enabled.asReadonly();

  // Reusable noise buffer (1 second)
  private noiseBuffer: AudioBuffer | null = null;

  // Active continuous nodes (stretch / drone — need manual stop)
  private stretchOsc: OscillatorNode | null = null;
  private stretchGain: GainNode | null = null;
  private stretchLfo: OscillatorNode | null = null;
  private stretchFilter: BiquadFilterNode | null = null;

  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneLfo: OscillatorNode | null = null;

  /** Initialize AudioContext on first user gesture (browser autoplay policy). */
  ensureContext(): void {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this._enabled.set(true);
  }

  private get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  // ─── Tap: "Boing" ──────────────────────────────────────────────

  playBoing(): void {
    if (!this.ctx) return;
    const t = this.now;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  // ─── Drag: "Stretch" (continuous) ──────────────────────────────

  startStretch(distance: number): void {
    if (!this.ctx) return;
    this.stopStretch(); // clean any existing

    const t = this.now;
    const freq = 80 + distance * 2;

    // Main oscillator
    this.stretchOsc = this.ctx.createOscillator();
    this.stretchOsc.type = 'sine';
    this.stretchOsc.frequency.setValueAtTime(freq, t);

    // LFO for vibrato
    this.stretchLfo = this.ctx.createOscillator();
    this.stretchLfo.type = 'sine';
    this.stretchLfo.frequency.setValueAtTime(6, t);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(5, t); // vibrato depth ±5Hz
    this.stretchLfo.connect(lfoGain).connect(this.stretchOsc.frequency);

    // Warmth filter
    this.stretchFilter = this.ctx.createBiquadFilter();
    this.stretchFilter.type = 'lowpass';
    this.stretchFilter.frequency.setValueAtTime(400, t);

    // Output gain
    this.stretchGain = this.ctx.createGain();
    this.stretchGain.gain.setValueAtTime(0, t);
    this.stretchGain.gain.linearRampToValueAtTime(0.15, t + 0.1);

    this.stretchOsc.connect(this.stretchFilter)
      .connect(this.stretchGain)
      .connect(this.ctx.destination);
    this.stretchLfo.start(t);
    this.stretchOsc.start(t);
  }

  updateStretch(distance: number): void {
    if (!this.stretchOsc || !this.ctx) return;
    this.stretchOsc.frequency.setTargetAtTime(80 + distance * 2, this.now, 0.05);
  }

  stopStretch(): void {
    if (!this.ctx) return;
    const t = this.now;
    try {
      if (this.stretchGain) {
        this.stretchGain.gain.cancelScheduledValues(t);
        this.stretchGain.gain.setValueAtTime(this.stretchGain.gain.value, t);
        this.stretchGain.gain.linearRampToValueAtTime(0, t + 0.08);
      }
      if (this.stretchOsc) { this.stretchOsc.stop(t + 0.1); }
      if (this.stretchLfo) { this.stretchLfo.stop(t + 0.1); }
    } catch { /* already stopped */ }
    this.stretchOsc = null;
    this.stretchGain = null;
    this.stretchLfo = null;
    this.stretchFilter = null;
  }

  // ─── Release slow: "Snap" ──────────────────────────────────────

  playSnap(velocity: number): void {
    if (!this.ctx) return;
    const t = this.now;
    const startFreq = 250 + Math.min(velocity, 500) * 0.1;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.2);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // ─── Flick: "Whoosh" ──────────────────────────────────────────

  playWhoosh(velocity: number): void {
    if (!this.ctx) return;
    const t = this.now;

    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.Q.setValueAtTime(0.5, t);

    const gain = this.ctx.createGain();
    const vol = Math.max(0.1, Math.min(velocity / 2000, 0.4));
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(t);
    source.stop(t + 0.45);
  }

  // ─── Wall bounce: "Plop" ──────────────────────────────────────

  playPlop(velocity: number): void {
    if (!this.ctx) return;
    const t = this.now;
    const startFreq = 120 + 80 * Math.min(velocity / 1000, 1);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // ─── Long press: "Drone" ──────────────────────────────────────

  startDrone(): void {
    if (!this.ctx) return;
    this.stopDrone();

    const t = this.now;

    // Two oscillators for richness
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(60, t);

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(120, t);

    // LFO for pulsing gain
    this.droneLfo = this.ctx.createOscillator();
    this.droneLfo.type = 'sine';
    this.droneLfo.frequency.setValueAtTime(2, t);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.05, t);

    // Master gain with slow ramp
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0, t);
    this.droneGain.gain.linearRampToValueAtTime(0.2, t + 1.5);

    this.droneLfo.connect(lfoGain).connect(this.droneGain.gain);
    this.droneOsc1.connect(this.droneGain).connect(this.ctx.destination);
    this.droneOsc2.connect(this.droneGain);

    this.droneOsc1.start(t);
    this.droneOsc2.start(t);
    this.droneLfo.start(t);
  }

  /** Modulate drone frequencies based on elapsed seconds. Exponential rise into treble. */
  updateDrone(elapsed: number): void {
    if (!this.droneOsc1 || !this.droneOsc2 || !this.ctx) return;
    const t = this.now;
    // Exponential rise: bass → treble over ~20s (1.18^elapsed growth curve)
    const factor = Math.pow(1.18, elapsed) - 1;
    const freq1 = Math.min(60 + 60 * factor, 2500);   // 60Hz → 2500Hz
    const freq2 = Math.min(120 + 120 * factor, 4000);  // 120Hz → 4000Hz
    this.droneOsc1.frequency.setTargetAtTime(freq1, t, 0.08);
    this.droneOsc2.frequency.setTargetAtTime(freq2, t, 0.08);
    // LFO pulsing accelerates with time
    if (this.droneLfo) {
      this.droneLfo.frequency.setTargetAtTime(2 + Math.min(elapsed * 1.5, 20), t, 0.1);
    }
  }

  stopDrone(): void {
    if (!this.ctx) return;
    const t = this.now;
    try {
      if (this.droneGain) {
        this.droneGain.gain.cancelScheduledValues(t);
        this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, t);
        this.droneGain.gain.linearRampToValueAtTime(0, t + 0.15);
      }
      if (this.droneOsc1) { this.droneOsc1.stop(t + 0.2); }
      if (this.droneOsc2) { this.droneOsc2.stop(t + 0.2); }
      if (this.droneLfo) { this.droneLfo.stop(t + 0.2); }
    } catch { /* already stopped */ }
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneGain = null;
    this.droneLfo = null;
  }

  // ─── Long press release: "Pop" ────────────────────────────────

  playPop(): void {
    if (!this.ctx) return;
    const t = this.now;

    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.08);

    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(t);
    source.stop(t + 0.1);
  }

  // ─── Hover: random micro-sounds ──────────────────────────────

  /** Electric buzz — rapid LFO-modulated sawtooth. */
  playBuzz(): void {
    if (!this.ctx) return;
    const t = this.now;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.15);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(40, t);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(30, t);
    lfo.connect(lfoGain).connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);

    osc.connect(filter).connect(gain).connect(this.ctx.destination);
    lfo.start(t);
    osc.start(t);
    osc.stop(t + 0.3);
    lfo.stop(t + 0.3);
  }

  /** Bubbly bloop — sine sweep down with resonance. */
  playBloop(): void {
    if (!this.ctx) return;
    const t = this.now;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.35);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** Rising whir — sine sweep up. */
  playWhir(): void {
    if (!this.ctx) return;
    const t = this.now;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  /** Double heartbeat thump — two quick low-frequency pulses. */
  playThump(): void {
    if (!this.ctx) return;
    const t = this.now;

    for (let i = 0; i < 2; i++) {
      const offset = i * 0.15;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t + offset);
      osc.frequency.exponentialRampToValueAtTime(40, t + offset + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, t + offset);
      gain.gain.linearRampToValueAtTime(0, t + offset + 0.12);

      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.15);
    }
  }

  /** Ethereal ascending sparkle — 3 quick high notes. */
  playTwinkle(): void {
    if (!this.ctx) return;
    const t = this.now;
    const notes = [800, 1200, 1600];

    notes.forEach((freq, i) => {
      const offset = i * 0.08;
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + offset);

      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.linearRampToValueAtTime(0, t + offset + 0.15);

      osc.connect(gain).connect(this.ctx!.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.2);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sr = this.ctx!.sampleRate;
    const buf = this.ctx!.createBuffer(1, sr, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < sr; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  destroy(): void {
    this.stopStretch();
    this.stopDrone();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.noiseBuffer = null;
    this._enabled.set(false);
  }
}
