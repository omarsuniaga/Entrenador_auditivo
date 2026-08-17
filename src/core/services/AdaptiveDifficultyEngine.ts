/**
 * Domain Service: AdaptiveDifficultyEngine
 * Dynamically calibrates exercise difficulty (levels 1-20), frequency bounds,
 * tolerances in Hertz and duration in real time based on recent performance.
 */

import { DifficultyProfile, DifficultyLevel, DifficultyConfig, DIFFICULTY_CONFIGS_20 } from '../entities/DifficultyProfile';
import { ExerciseRound } from '../entities/ExerciseRound';

export interface DynamicDifficultyState {
  currentLevel: DifficultyLevel;
  title: string;
  minHz: number;
  maxHz: number;
  sliderStepHz: number;
  toleranceHz: number;
  toleranceCents: number;
  playbackDurationMs: number;
  previewEnabled: boolean;
  streakSuccess: number;
  streakStruggle: number;
  lastAdjustmentMessage: string | null;
}

export class AdaptiveDifficultyEngine {
  private profile: DifficultyProfile;

  constructor(initialLevel: DifficultyLevel = 1) {
    this.profile = new DifficultyProfile(initialLevel);
  }

  get currentState(): DynamicDifficultyState {
    const config = this.profile.config;
    return {
      currentLevel: this.profile.level,
      title: config.title,
      minHz: config.minHz,
      maxHz: config.maxHz,
      sliderStepHz: config.sliderStepHz,
      toleranceHz: config.toleranceHz,
      toleranceCents: config.toleranceCents,
      playbackDurationMs: config.playbackDurationMs,
      previewEnabled: config.previewEnabled,
      streakSuccess: this.profile.streakSuccess,
      streakStruggle: this.profile.streakStruggle,
      lastAdjustmentMessage: this.profile.lastAdjustmentMessage
    };
  }

  get config(): DifficultyConfig {
    return this.profile.config;
  }

  processRound(round: ExerciseRound): string | null {
    if (!round.completed || round.accuracyPercentage === undefined || round.deviationHz === undefined) {
      return null;
    }

    return this.profile.registerAttempt(round.accuracyPercentage, Math.abs(round.deviationHz));
  }

  setLevel(level: DifficultyLevel | number) {
    this.profile.setLevel(level);
  }

  getProfile(): DifficultyProfile {
    return this.profile;
  }

  static getAllConfigs(): DifficultyConfig[] {
    return Object.values(DIFFICULTY_CONFIGS_20);
  }
}
