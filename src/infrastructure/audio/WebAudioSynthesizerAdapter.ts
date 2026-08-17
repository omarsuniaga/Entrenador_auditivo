/**
 * Infrastructure Adapter: WebAudioSynthesizerAdapter
 * Implements IAudioSynthesizerPort using the native Web Audio API.
 * Features:
 * - Click-free exponential gain envelopes (ADSR)
 * - Master DynamicsCompressor to avoid clipping
 * - AnalyserNode for real-time wave/spectrum visualization
 * - Instant frequency ramping for the interactive slider
 */

import { IAudioSynthesizerPort, ToneOptions, WaveformType } from '../../core/ports/outbound/IAudioSynthesizerPort';

export class WebAudioSynthesizerAdapter implements IAudioSynthesizerPort {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // Continuous oscillator reference for slider
  private continuousOsc: OscillatorNode | null = null;
  private continuousGain: GainNode | null = null;
  private isContinuousActive: boolean = false;
  
  // Active discrete tone oscillators
  private activeDiscreteOscs: OscillatorNode[] = [];

  constructor() {
    // Lazy AudioContext initialization
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Master Compressor
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.audioCtx.currentTime);

      // Analyser Node
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);

      // Connect pipeline: MasterGain -> Compressor -> Analyser -> Destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (e) {
        console.warn('Could not resume audio context:', e);
      }
    }

    return this.audioCtx;
  }

  async initialize(): Promise<void> {
    await this.ensureContext();
  }

  async playTone(options: ToneOptions): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.masterGain) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
      }
    }

    // Stop any previously playing discrete tones first
    this.activeDiscreteOscs.forEach(o => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeDiscreteOscs = [];

    const {
      frequencyHz,
      durationMs = 2000,
      volume = 0.5,
      waveform = 'sine',
      fadeInMs = 40,
      fadeOutMs = 80
    } = options;

    const now = ctx.currentTime;
    const durationSec = Math.max(0.3, durationMs / 1000);
    const fadeInSec = Math.min(0.1, fadeInMs / 1000);
    const fadeOutSec = Math.min(0.15, fadeOutMs / 1000);

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = waveform === 'organ' ? 'sine' : waveform;
    osc.frequency.setValueAtTime(Math.max(20, Math.min(20000, frequencyHz)), now);

    // Reliable click-free ADSR envelope using linear ramps (immune to 0-value WebAudio DOMExceptions)
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(Math.max(0.01, volume), now + fadeInSec);
    gainNode.gain.setValueAtTime(Math.max(0.01, volume), Math.max(now + fadeInSec, now + durationSec - fadeOutSec));
    gainNode.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    try {
      osc.stop(now + durationSec);
    } catch {
      // ignore
    }

    this.activeDiscreteOscs.push(osc);

    // Cleanup after stop with safety fallback timeout
    return new Promise((resolve) => {
      let isResolved = false;
      const safeResolve = () => {
        if (isResolved) return;
        isResolved = true;
        try {
          osc.disconnect();
          gainNode.disconnect();
          this.activeDiscreteOscs = this.activeDiscreteOscs.filter(o => o !== osc);
        } catch {
          // ignore
        }
        resolve();
      };

      osc.onended = safeResolve;

      // Fail-safe timeout: always resolves after duration + buffer
      setTimeout(safeResolve, durationMs + 150);
    });
  }

  async startContinuousTone(frequencyHz: number, volume: number = 0.45, waveform: WaveformType = 'sine'): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.masterGain) return;

    // If continuous tone is already running, just update its frequency smoothly
    if (this.isContinuousActive && this.continuousOsc && this.continuousGain) {
      this.setContinuousFrequency(frequencyHz);
      return;
    }

    this.stopContinuousTone();

    const now = ctx.currentTime;
    this.continuousOsc = ctx.createOscillator();
    this.continuousGain = ctx.createGain();

    this.continuousOsc.type = waveform === 'organ' ? 'sine' : waveform;
    this.continuousOsc.frequency.setValueAtTime(frequencyHz, now);

    // Smooth fade in to avoid pop
    this.continuousGain.gain.setValueAtTime(0.0001, now);
    this.continuousGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.04);

    this.continuousOsc.connect(this.continuousGain);
    this.continuousGain.connect(this.masterGain);

    this.continuousOsc.start(now);
    this.isContinuousActive = true;
  }

  setContinuousFrequency(frequencyHz: number): void {
    if (!this.audioCtx || !this.continuousOsc || !this.isContinuousActive) return;

    const now = this.audioCtx.currentTime;
    // Set smooth ramp parameter for smooth slider gliding
    this.continuousOsc.frequency.cancelScheduledValues(now);
    this.continuousOsc.frequency.setTargetAtTime(frequencyHz, now, 0.015);
  }

  stopContinuousTone(): void {
    if (!this.audioCtx || !this.continuousGain || !this.continuousOsc || !this.isContinuousActive) {
      this.isContinuousActive = false;
      return;
    }

    try {
      const now = this.audioCtx.currentTime;
      this.continuousGain.gain.cancelScheduledValues(now);
      this.continuousGain.gain.setValueAtTime(Math.max(0.0001, this.continuousGain.gain.value), now);
      this.continuousGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      const oscToStop = this.continuousOsc;
      const gainToDisconnect = this.continuousGain;

      setTimeout(() => {
        try {
          oscToStop.stop();
          oscToStop.disconnect();
          gainToDisconnect.disconnect();
        } catch {
          // ignore
        }
      }, 60);
    } catch {
      // ignore
    }

    this.continuousOsc = null;
    this.continuousGain = null;
    this.isContinuousActive = false;
  }

  stopAll(): void {
    this.stopContinuousTone();

    if (this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.activeDiscreteOscs.forEach(osc => {
        try {
          osc.stop(now + 0.01);
        } catch {
          // ignore
        }
      });
      this.activeDiscreteOscs = [];
    }
  }

  isPlaying(): boolean {
    return this.isContinuousActive || this.activeDiscreteOscs.length > 0;
  }

  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer;
  }

  getTimeDomainData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buffer);
    return buffer;
  }
}
