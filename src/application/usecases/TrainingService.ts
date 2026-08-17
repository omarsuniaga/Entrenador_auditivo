/**
 * Application Service: TrainingService
 * Implements the ITrainingUseCase primary port orchestrating domain entities,
 * calculation services, audio synthesis port, and storage port.
 */

import { ITrainingUseCase, StartTrainingParams, GuessSubmissionResult } from '../../core/ports/inbound/ITrainingUseCase';
import { IAudioSynthesizerPort } from '../../core/ports/outbound/IAudioSynthesizerPort';
import { IStoragePort } from '../../core/ports/outbound/IStoragePort';
import { TrainingSession } from '../../core/entities/TrainingSession';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { DeviationCalculator } from '../../core/services/DeviationCalculator';
import { AdaptiveDifficultyEngine } from '../../core/services/AdaptiveDifficultyEngine';
import { DifficultyLevel } from '../../core/entities/DifficultyProfile';
import {
  AcousticVulnerabilityEngine,
  FocusRemediationMode,
  VulnerabilityAnalysisResult
} from '../../core/services/AcousticVulnerabilityEngine';
import { OutputProfileId, getEffectiveFrequencyBounds } from '../../core/entities/AudioOutputProfile';

export class TrainingService implements ITrainingUseCase {
  private currentSession: TrainingSession | null = null;
  private adaptiveEngine: AdaptiveDifficultyEngine;
  private audioPort: IAudioSynthesizerPort;
  private storagePort: IStoragePort;
  private rangeMode: 'continuous' | 'discrete_eq' | 'musical' = 'continuous';
  private customDurationMs?: number;
  private focusMode: FocusRemediationMode = 'auto';
  private enableAdaptiveRemediation: boolean = true;
  private outputProfile: OutputProfileId = 'mobile_speaker';
  private cachedHistorySessions: TrainingSession[] = [];
  private cachedVulnerabilityProfile: VulnerabilityAnalysisResult | null = null;


  constructor(audioPort: IAudioSynthesizerPort, storagePort: IStoragePort) {
    this.audioPort = audioPort;
    this.storagePort = storagePort;
    this.adaptiveEngine = new AdaptiveDifficultyEngine(1);
    this.refreshVulnerabilityProfile();
  }

  async refreshVulnerabilityProfile(): Promise<VulnerabilityAnalysisResult> {
    try {
      this.cachedHistorySessions = await this.storagePort.getSessions();
      this.cachedVulnerabilityProfile = AcousticVulnerabilityEngine.analyzeVulnerabilities(this.cachedHistorySessions);
    } catch {
      this.cachedVulnerabilityProfile = AcousticVulnerabilityEngine.analyzeVulnerabilities([]);
    }
    return this.cachedVulnerabilityProfile;
  }

  getVulnerabilityProfile(): VulnerabilityAnalysisResult | null {
    return this.cachedVulnerabilityProfile;
  }

  setFocusMode(mode: FocusRemediationMode): void {
    this.focusMode = mode;
  }

  setOutputProfile(profile: OutputProfileId): void {
    this.outputProfile = profile;
  }

  setAdaptiveRemediation(enabled: boolean): void {
    this.enableAdaptiveRemediation = enabled;
  }

  async startSession(params: StartTrainingParams): Promise<TrainingSession> {
    const level: DifficultyLevel = (params.difficultyLevel || 1) as DifficultyLevel;
    this.adaptiveEngine.setLevel(level);
    this.rangeMode = params.rangeMode || 'continuous';
    if (params.focusMode !== undefined) this.focusMode = params.focusMode;
    if (params.enableAdaptiveRemediation !== undefined) this.enableAdaptiveRemediation = params.enableAdaptiveRemediation;
    if (params.outputProfile !== undefined) this.outputProfile = params.outputProfile;

    // Refresh history analytics before starting
    await this.refreshVulnerabilityProfile();

    this.currentSession = new TrainingSession(params.totalRounds, level);

    // Create the first round
    this.spawnNextRound();

    return this.currentSession;
  }

  restoreSession(
    session: TrainingSession,
    rangeMode: 'continuous' | 'discrete_eq' | 'musical' = 'continuous',
    focusMode: FocusRemediationMode = 'auto',
    enableAdaptiveRemediation: boolean = true,
    outputProfile: OutputProfileId = 'mobile_speaker'
  ): void {
    this.currentSession = session;
    this.rangeMode = rangeMode;
    this.focusMode = focusMode;
    this.enableAdaptiveRemediation = enableAdaptiveRemediation;
    this.outputProfile = outputProfile;
    this.adaptiveEngine.setLevel(session.difficultyLevel);
  }

  getCurrentSession(): TrainingSession | null {
    return this.currentSession;
  }

  getAdaptiveEngine(): AdaptiveDifficultyEngine {
    return this.adaptiveEngine;
  }

  setCustomDuration(durationMs: number): void {
    this.customDurationMs = Math.max(500, Math.min(10000, durationMs));
  }

  async playTargetTone(): Promise<void> {
    if (!this.currentSession || !this.currentSession.currentRound) {
      throw new Error('No active round in progress');
    }

    const round = this.currentSession.currentRound;
    round.targetPlayCount += 1;

    const diffState = this.adaptiveEngine.currentState;
    const durationMs = this.customDurationMs || diffState.playbackDurationMs;

    await this.audioPort.playTone({
      frequencyHz: round.targetFrequency.hz,
      durationMs,
      volume: 0.5,
      fadeInMs: 40,
      fadeOutMs: 80
    });
  }

  startPreviewTone(frequencyHz: number): void {
    const diffState = this.adaptiveEngine.currentState;
    if (!diffState.previewEnabled) {
      // Level 15+ has real-time slider preview disabled for hardcore blind ear training
      return;
    }

    this.audioPort.startContinuousTone(frequencyHz, 0.45);
    if (this.currentSession?.currentRound) {
      this.currentSession.currentRound.userPlayCount += 1;
    }
  }

  updatePreviewTone(frequencyHz: number): void {
    const diffState = this.adaptiveEngine.currentState;
    if (!diffState.previewEnabled) return;

    this.audioPort.setContinuousFrequency(frequencyHz);
  }

  stopPreviewTone(): void {
    this.audioPort.stopContinuousTone();
  }

  async submitGuess(userHz: number, responseTimeMs: number): Promise<GuessSubmissionResult> {
    if (!this.currentSession || !this.currentSession.currentRound) {
      throw new Error('No active round to submit guess');
    }

    this.audioPort.stopAll();

    const currentRound = this.currentSession.currentRound;
    const targetHz = currentRound.targetFrequency.hz;
    const diffState = this.adaptiveEngine.currentState;

    // Complete the round calculation with current tolerance
    currentRound.completeRound(userHz, responseTimeMs, diffState.toleranceHz);

    // Perform domain deviation analysis
    const analysis = DeviationCalculator.analyze(targetHz, userHz, diffState.toleranceHz);

    // Feed result into adaptive difficulty engine
    const adaptiveMessage = this.adaptiveEngine.processRound(currentRound);

    // Check if session has finished all rounds
    const isSessionFinished = (this.currentSession.completedRoundsCount >= this.currentSession.totalRounds);
    let progressReport;

    if (isSessionFinished) {
      this.currentSession.isCompleted = true;
      progressReport = this.currentSession.generateProgressReport();
      // Persist session asynchronously
      await this.storagePort.saveSession(this.currentSession);
    }

    return {
      round: currentRound,
      analysis,
      adaptiveMessage,
      isSessionFinished,
      progressReport
    };
  }

  nextRound(): ExerciseRound | null {
    if (!this.currentSession || this.currentSession.isCompleted) {
      return null;
    }

    if (this.currentSession.completedRoundsCount >= this.currentSession.totalRounds) {
      this.currentSession.isCompleted = true;
      return null;
    }

    this.currentSession.currentRoundIndex = this.currentSession.completedRoundsCount;
    return this.spawnNextRound();
  }

  cancelSession(): void {
    this.audioPort.stopAll();
    this.currentSession = null;
  }

  async getSessionHistory(): Promise<TrainingSession[]> {
    return this.storagePort.getSessions();
  }

  async clearHistory(): Promise<void> {
    return this.storagePort.clearHistory();
  }

  private spawnNextRound(): ExerciseRound {
    if (!this.currentSession) throw new Error('No session');

    const diffState = this.adaptiveEngine.currentState;
    const { minHz, maxHz } = getEffectiveFrequencyBounds(
      this.outputProfile,
      diffState.minHz,
      diffState.maxHz
    );

    let targetHz: number;
    let isVulnerabilityDrill = false;
    let focusZoneName: string | undefined;
    let focusRationale: string | undefined;

    if (this.enableAdaptiveRemediation) {
      const adaptiveResult = AcousticVulnerabilityEngine.generateAdaptiveFrequency({
        minHz,
        maxHz,
        mode: this.rangeMode,
        focusMode: this.focusMode,
        vulnerabilityProfile: this.cachedVulnerabilityProfile || undefined
      });
      targetHz = adaptiveResult.hz;
      isVulnerabilityDrill = adaptiveResult.isVulnerabilityDrill;
      focusZoneName = adaptiveResult.zoneName;
      focusRationale = adaptiveResult.focusRationale;
    } else {
      targetHz = DeviationCalculator.generateTargetFrequency(
        minHz,
        maxHz,
        this.rangeMode
      );
    }

    const nextRoundNumber = this.currentSession.rounds.length + 1;
    const round = new ExerciseRound(
      nextRoundNumber,
      targetHz,
      undefined,
      diffState.currentLevel,
      isVulnerabilityDrill,
      focusZoneName,
      focusRationale
    );
    this.currentSession.addRound(round);
    return round;
  }
}

