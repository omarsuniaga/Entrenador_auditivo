/**
 * Outbound Port: IAudioSynthesizerPort
 * Defines the contract for acoustic tone generation, frequency sweep, audio synthesis and spectrum analysis.
 */

export type WaveformType = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'organ';

export interface ToneOptions {
  frequencyHz: number;
  durationMs?: number;
  volume?: number;       // 0.0 to 1.0
  waveform?: WaveformType;
  fadeInMs?: number;
  fadeOutMs?: number;
}

export interface IAudioSynthesizerPort {
  /**
   * Initializes or resumes the audio context on user gesture
   */
  initialize(): Promise<void>;

  /**
   * Plays a discrete tone for a given duration with smooth envelope
   */
  playTone(options: ToneOptions): Promise<void>;

  /**
   * Starts playing a continuous tone (e.g. while dragging the frequency slider)
   */
  startContinuousTone(frequencyHz: number, volume?: number, waveform?: WaveformType): void;

  /**
   * Updates frequency in real-time without glitch/click while dragging slider
   */
  setContinuousFrequency(frequencyHz: number): void;

  /**
   * Stops the continuous tone
   */
  stopContinuousTone(): void;

  /**
   * Stops all active audio nodes immediately
   */
  stopAll(): void;

  /**
   * Returns current master audio status
   */
  isPlaying(): boolean;

  /**
   * Returns Web Audio AnalyserNode frequency byte data for live visualizers
   */
  getAnalyserData(): Uint8Array | null;

  /**
   * Returns Web Audio AnalyserNode time-domain byte data for sinusoidal wave visualizers
   */
  getTimeDomainData(): Uint8Array | null;
}
