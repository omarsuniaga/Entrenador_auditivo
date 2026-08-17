/**
 * Infrastructure Adapter: LocalStorageAdapter
 * Implements IStoragePort for persistent client-side history, session records, and settings.
 */

import { IStoragePort, UserPreferences } from '../../core/ports/outbound/IStoragePort';
import { TrainingSession, ProgressReport } from '../../core/entities/TrainingSession';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { NoteTrainingSession } from '../../core/entities/NoteTrainingSession';
import { DifficultyLevel } from '../../core/entities/DifficultyProfile';

const SESSIONS_KEY = 'audiofit_training_sessions_v1';
const NOTE_SESSIONS_KEY = 'audiofit_note_training_sessions_v1';
const PREFS_KEY = 'audiofit_user_preferences_v1';
const ACTIVE_SESSION_KEY = 'audiofit_active_training_session_v1';
const LAST_REPORT_KEY = 'pitch_training_last_completed_report';

export interface ActiveSessionData {
  session: TrainingSession;
  sampleDurationSec: number;
  retentionWaitSec: number;
  submitOnRelease: boolean;
  rangeMode: 'continuous' | 'discrete_eq' | 'musical';
  roundIndex: number;
}

const DEFAULT_PREFS: UserPreferences = {
  defaultRoundsCount: 5,
  waveform: 'sine',
  autoPlayNextRound: true,
  frequencyRangeMode: 'continuous',
  difficultyLevel: 1,
  masterVolume: 0.7,
  playerName: 'Entrenador Auditivo',
  noteScaleType: 'chromatic',
  tuningSystem: '12tet',
  a4Reference: 440
};

export class LocalStorageAdapter implements IStoragePort {
  async saveSession(session: TrainingSession): Promise<void> {
    try {
      const existing = await this.getSerializedSessions();
      const serialized = {
        id: session.id,
        totalRounds: session.totalRounds,
        difficultyLevel: session.difficultyLevel,
        createdAt: session.createdAt,
        isCompleted: session.isCompleted,
        rounds: session.rounds.map(r => r.toJSON())
      };

      // Prepend recent session (up to 100 historical sessions)
      const updated = [serialized, ...existing.filter((s: any) => s.id !== session.id)].slice(0, 100);
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
  }

  async getSessions(): Promise<TrainingSession[]> {
    try {
      const serializedList = await this.getSerializedSessions();
      return serializedList.map((data: any) => {
        const session = new TrainingSession(data.totalRounds, data.difficultyLevel, data.id);
        session.isCompleted = data.isCompleted;

        if (Array.isArray(data.rounds)) {
          data.rounds.forEach((rData: any) => {
            const round = new ExerciseRound(
              rData.roundNumber,
              rData.targetHz,
              rData.id,
              rData.difficultyLevel || data.difficultyLevel || 1,
              rData.isVulnerabilityDrill ?? false,
              rData.focusZoneName,
              rData.focusRationale
            );
            round.targetPlayCount = rData.targetPlayCount || 1;
            round.userPlayCount = rData.userPlayCount || 0;
            if (rData.completed && rData.userHz !== undefined) {
              round.completeRound(rData.userHz, rData.responseTimeMs || 0);
              if (rData.accuracyPercentage !== undefined) round.accuracyPercentage = rData.accuracyPercentage;
              if (rData.deviationHz !== undefined) round.deviationHz = rData.deviationHz;
              if (rData.deviationCents !== undefined) round.deviationCents = rData.deviationCents;
              if (rData.scorePoints !== undefined) round.scorePoints = rData.scorePoints;
            }
            session.addRound(round);
          });
        }
        return session;
      });
    } catch (e) {
      console.warn('Failed to load sessions from localStorage:', e);
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    localStorage.removeItem(SESSIONS_KEY);
  }

  // Active in-progress session persistence
  async saveActiveSession(data: {
    session: TrainingSession;
    sampleDurationSec: number;
    retentionWaitSec: number;
    submitOnRelease: boolean;
    rangeMode: 'continuous' | 'discrete_eq' | 'musical';
    roundIndex: number;
  }): Promise<void> {
    try {
      const serialized = {
        id: data.session.id,
        totalRounds: data.session.totalRounds,
        difficultyLevel: data.session.difficultyLevel,
        currentRoundIndex: data.session.currentRoundIndex,
        createdAt: data.session.createdAt,
        isCompleted: data.session.isCompleted,
        sampleDurationSec: data.sampleDurationSec,
        retentionWaitSec: data.retentionWaitSec,
        submitOnRelease: data.submitOnRelease,
        rangeMode: data.rangeMode,
        roundIndex: data.roundIndex,
        rounds: data.session.rounds.map(r => r.toJSON())
      };
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.warn('Failed to save active session to localStorage:', e);
    }
  }

  async getActiveSession(): Promise<ActiveSessionData | null> {
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (!stored) return null;
      const data = JSON.parse(stored);
      if (!data || !data.totalRounds) return null;

      const session = new TrainingSession(data.totalRounds, data.difficultyLevel || 1, data.id);
      session.isCompleted = !!data.isCompleted;
      session.currentRoundIndex = data.currentRoundIndex || 0;

      if (Array.isArray(data.rounds)) {
        data.rounds.forEach((rData: any) => {
          const round = new ExerciseRound(
            rData.roundNumber,
            rData.targetHz,
            rData.id,
            rData.difficultyLevel || data.difficultyLevel || 1,
            rData.isVulnerabilityDrill ?? false,
            rData.focusZoneName,
            rData.focusRationale
          );
          round.targetPlayCount = rData.targetPlayCount || 0;
          round.userPlayCount = rData.userPlayCount || 0;
          if (rData.completed && rData.userHz !== undefined) {
            round.completeRound(rData.userHz, rData.responseTimeMs || 0);
            if (rData.accuracyPercentage !== undefined) round.accuracyPercentage = rData.accuracyPercentage;
            if (rData.deviationHz !== undefined) round.deviationHz = rData.deviationHz;
            if (rData.deviationCents !== undefined) round.deviationCents = rData.deviationCents;
            if (rData.scorePoints !== undefined) round.scorePoints = rData.scorePoints;
          }
          session.addRound(round);
        });
      }

      return {
        session,
        sampleDurationSec: data.sampleDurationSec ?? 4,
        retentionWaitSec: data.retentionWaitSec ?? 5,
        submitOnRelease: !!data.submitOnRelease,
        rangeMode: data.rangeMode || 'continuous',
        roundIndex: data.roundIndex || (session.completedRoundsCount + 1)
      };
    } catch (e) {
      console.warn('Failed to parse active session from localStorage:', e);
      return null;
    }
  }

  async clearActiveSession(): Promise<void> {
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear active session:', e);
    }
  }

  // Last diagnostic progress report persistence
  async saveLastReport(report: ProgressReport): Promise<void> {
    try {
      localStorage.setItem(LAST_REPORT_KEY, JSON.stringify(report));
    } catch (e) {
      console.warn('Failed to save last progress report to localStorage:', e);
    }
  }

  async getLastReport(): Promise<ProgressReport | null> {
    try {
      const stored = localStorage.getItem(LAST_REPORT_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to load last progress report from localStorage:', e);
      return null;
    }
  }

  async saveNoteSession(session: NoteTrainingSession): Promise<void> {
    try {
      const existing = await this.getSerializedNoteSessions();
      const serialized = session.toJSON();
      const updated = [serialized, ...existing.filter((s: any) => s.id !== session.id)].slice(0, 100);
      localStorage.setItem(NOTE_SESSIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save note session to localStorage:', e);
    }
  }

  async getNoteSessions(): Promise<NoteTrainingSession[]> {
    try {
      const serializedList = await this.getSerializedNoteSessions();
      return serializedList.map((data: any) => NoteTrainingSession.fromJSON(data));
    } catch (e) {
      console.warn('Failed to load note sessions from localStorage:', e);
      return [];
    }
  }

  async clearNoteHistory(): Promise<void> {
    localStorage.removeItem(NOTE_SESSIONS_KEY);
  }

  async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    const current = await this.getPreferences();
    const merged = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  }

  async getPreferences(): Promise<UserPreferences> {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse preferences:', e);
    }
    return DEFAULT_PREFS;
  }

  private async getSerializedSessions(): Promise<any[]> {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  private async getSerializedNoteSessions(): Promise<any[]> {
    const stored = localStorage.getItem(NOTE_SESSIONS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
}

