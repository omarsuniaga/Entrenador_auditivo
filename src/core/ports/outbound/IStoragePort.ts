/**
 * Outbound Port: IStoragePort
 * Contract for saving training sessions, persistent settings, calibration and progress logs.
 */

import { TrainingSession } from '../../entities/TrainingSession';
import { NoteTrainingSession } from '../../entities/NoteTrainingSession';
import { DifficultyLevel } from '../../entities/DifficultyProfile';

export interface UserPreferences {
  defaultRoundsCount: number;
  waveform: string;
  autoPlayNextRound: boolean;
  frequencyRangeMode: 'continuous' | 'discrete_eq' | 'musical';
  difficultyLevel: DifficultyLevel;
  masterVolume: number;
  playerName: string;
  noteScaleType?: 'chromatic' | 'diatonic';
  tuningSystem?: '12tet' | 'pythagorean' | 'just';
  a4Reference?: number;
}

export interface IStoragePort {
  saveSession(session: TrainingSession): Promise<void>;
  getSessions(): Promise<TrainingSession[]>;
  clearHistory(): Promise<void>;
  saveNoteSession(session: NoteTrainingSession): Promise<void>;
  getNoteSessions(): Promise<NoteTrainingSession[]>;
  clearNoteHistory(): Promise<void>;
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;
  getPreferences(): Promise<UserPreferences>;
}
