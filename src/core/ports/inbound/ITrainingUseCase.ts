/**
 * Inbound Port: ITrainingUseCase
 * Primary port driving ear training workflows, user attempts, dynamic difficulty, and metrics.
 */

import { TrainingSession, ProgressReport } from '../../entities/TrainingSession';
import { ExerciseRound } from '../../entities/ExerciseRound';
import { DeviationAnalysis } from '../../services/DeviationCalculator';
import { DifficultyLevel } from '../../entities/DifficultyProfile';
import { FocusRemediationMode, VulnerabilityAnalysisResult } from '../../services/AcousticVulnerabilityEngine';
import { OutputProfileId } from '../../entities/AudioOutputProfile';

export interface StartTrainingParams {
  totalRounds: number;
  difficultyLevel?: DifficultyLevel;
  rangeMode?: 'continuous' | 'discrete_eq' | 'musical';
  customMinHz?: number;
  customMaxHz?: number;
  focusMode?: FocusRemediationMode;
  enableAdaptiveRemediation?: boolean;
  outputProfile?: OutputProfileId;
}

export interface GuessSubmissionResult {
  round: ExerciseRound;
  analysis: DeviationAnalysis;
  adaptiveMessage: string | null;
  isSessionFinished: boolean;
  progressReport?: ProgressReport;
}

export interface ITrainingUseCase {
  startSession(params: StartTrainingParams): Promise<TrainingSession>;
  getCurrentSession(): TrainingSession | null;
  setOutputProfile(profile: OutputProfileId): void;
  playTargetTone(): Promise<void>;
  startPreviewTone(frequencyHz: number): void;
  updatePreviewTone(frequencyHz: number): void;
  stopPreviewTone(): void;
  submitGuess(userHz: number, responseTimeMs: number): Promise<GuessSubmissionResult>;
  nextRound(): ExerciseRound | null;
  cancelSession(): void;
  getSessionHistory(): Promise<TrainingSession[]>;
  clearHistory(): Promise<void>;
}

