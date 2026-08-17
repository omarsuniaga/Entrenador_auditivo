/**
 * Domain Entity: NoteTrainingSession
 * Manages ear training sessions specifically designed for musical note identification,
 * tracking pitch-class mastery, diatonic vs chromatic accuracy, octave perception,
 * microtonal approximation tolerance, and historical progress reports.
 */

import {
  MusicalNoteCalculator,
  CHROMATIC_NOTES,
  NoteApproximationAnalysis,
  TuningSystem,
  NoteScaleType
} from './MusicalNote';

export interface NoteRoundResult {
  roundNumber: number;
  targetHz: number;
  theoreticalHz: number;
  closestNote: string;       // e.g. "A"
  closestSolfege: string;    // e.g. "La"
  closestOctave: number;     // e.g. 4
  closestFullName: string;   // e.g. "A4"
  isAccidental: boolean;
  userGuessedNoteIndex: number;
  userGuessedNoteName: string;
  userGuessedSolfege: string;
  userGuessedOctave: number;
  userGuessedFullName: string;
  isExactNoteMatch: boolean;
  isCorrectPitchClass: boolean;
  isOctaveMatch: boolean;
  deviationHz: number;
  deviationCents: number;
  responseTimeMs: number;
  scorePoints: number;
  accuracyPercentage: number;
  tuningSystem: TuningSystem;
  feedbackMessage: string;
  timestamp: number;
}

export interface NoteMasteryStat {
  noteIndex: number;
  name: string;
  solfege: string;
  isAccidental: boolean;
  attempts: number;
  correctPitchClassCount: number;
  exactMatchCount: number;
  pitchAccuracy: number; // 0-100%
  exactAccuracy: number; // 0-100%
  averageResponseTimeMs: number;
}

export interface NoteProgressReport {
  sessionId: string;
  timestamp: number;
  totalRounds: number;
  completedRounds: number;
  overallAccuracy: number;
  exactNoteAccuracy: number;
  pitchClassAccuracy: number;
  diatonicAccuracy: number;
  chromaticAccuracy: number;
  octaveAccuracy: number;
  totalScore: number;
  maxPossibleScore: number;
  averageResponseTimeMs: number;
  scaleType: NoteScaleType;
  tuningSystem: TuningSystem;
  a4Reference: number;
  strongestNote: NoteMasteryStat | null;
  weakestNote: NoteMasteryStat | null;
  noteStats: NoteMasteryStat[];
  recommendations: string[];
}

export class NoteTrainingSession {
  public readonly id: string;
  public readonly createdAt: number;
  public readonly totalRounds: number;
  public readonly scaleType: NoteScaleType;
  public readonly tuningSystem: TuningSystem;
  public readonly a4Reference: number;
  public readonly minOctave: number;
  public readonly maxOctave: number;
  public rounds: NoteRoundResult[] = [];
  public currentRoundIndex: number = 0;
  public isCompleted: boolean = false;

  constructor(options: {
    totalRounds?: number;
    scaleType?: NoteScaleType;
    tuningSystem?: TuningSystem;
    a4Reference?: number;
    minOctave?: number;
    maxOctave?: number;
    id?: string;
  } = {}) {
    this.id = options.id || `note_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.createdAt = Date.now();
    this.totalRounds = Math.max(1, Math.min(50, options.totalRounds || 5));
    this.scaleType = options.scaleType || 'chromatic';
    this.tuningSystem = options.tuningSystem || '12tet';
    this.a4Reference = options.a4Reference || 440;
    this.minOctave = options.minOctave || 3;
    this.maxOctave = options.maxOctave || 5;
  }

  addRoundResult(result: NoteRoundResult): void {
    this.rounds.push(result);
    this.currentRoundIndex = this.rounds.length;
    if (this.rounds.length >= this.totalRounds) {
      this.isCompleted = true;
    }
  }

  get completedRoundsCount(): number {
    return this.rounds.length;
  }

  get overallAccuracy(): number {
    if (this.rounds.length === 0) return 0;
    const sum = this.rounds.reduce((acc, r) => acc + r.accuracyPercentage, 0);
    return Math.round((sum / this.rounds.length) * 10) / 10;
  }

  get exactAccuracy(): number {
    if (this.rounds.length === 0) return 0;
    const exact = this.rounds.filter(r => r.isExactNoteMatch).length;
    return Math.round((exact / this.rounds.length) * 1000) / 10;
  }

  get pitchClassAccuracy(): number {
    if (this.rounds.length === 0) return 0;
    const pitch = this.rounds.filter(r => r.isCorrectPitchClass).length;
    return Math.round((pitch / this.rounds.length) * 1000) / 10;
  }

  get totalScore(): number {
    return this.rounds.reduce((sum, r) => sum + r.scorePoints, 0);
  }

  get averageResponseTimeMs(): number {
    if (this.rounds.length === 0) return 0;
    const sum = this.rounds.reduce((acc, r) => acc + r.responseTimeMs, 0);
    return Math.round(sum / this.rounds.length);
  }

  generateProgressReport(): NoteProgressReport {
    const noteStatsMap = new Map<number, NoteMasteryStat>();
    
    CHROMATIC_NOTES.forEach(note => {
      noteStatsMap.set(note.index, {
        noteIndex: note.index,
        name: note.name,
        solfege: note.solfege,
        isAccidental: note.isAccidental,
        attempts: 0,
        correctPitchClassCount: 0,
        exactMatchCount: 0,
        pitchAccuracy: 0,
        exactAccuracy: 0,
        averageResponseTimeMs: 0
      });
    });

    let diatonicAttempts = 0;
    let diatonicHits = 0;
    let chromaticAttempts = 0;
    let chromaticHits = 0;
    let octaveHits = 0;

    this.rounds.forEach(r => {
      const targetNoteIndex = CHROMATIC_NOTES.findIndex(n => n.name === r.closestNote);
      if (targetNoteIndex >= 0) {
        const stat = noteStatsMap.get(targetNoteIndex)!;
        stat.attempts += 1;
        if (r.isCorrectPitchClass) stat.correctPitchClassCount += 1;
        if (r.isExactNoteMatch) stat.exactMatchCount += 1;
      }

      if (r.isAccidental) {
        chromaticAttempts += 1;
        if (r.isCorrectPitchClass) chromaticHits += 1;
      } else {
        diatonicAttempts += 1;
        if (r.isCorrectPitchClass) diatonicHits += 1;
      }

      if (r.isOctaveMatch) {
        octaveHits += 1;
      }
    });

    const noteStats = Array.from(noteStatsMap.values()).map(stat => {
      return {
        ...stat,
        pitchAccuracy: stat.attempts > 0 ? Math.round((stat.correctPitchClassCount / stat.attempts) * 100) : 0,
        exactAccuracy: stat.attempts > 0 ? Math.round((stat.exactMatchCount / stat.attempts) * 100) : 0
      };
    });

    const testedStats = noteStats.filter(s => s.attempts > 0);
    const strongestNote = testedStats.length > 0
      ? [...testedStats].sort((a, b) => b.pitchAccuracy - a.pitchAccuracy || b.attempts - a.attempts)[0]
      : null;
    const weakestNote = testedStats.length > 0
      ? [...testedStats].sort((a, b) => a.pitchAccuracy - b.pitchAccuracy || b.attempts - a.attempts)[0]
      : null;

    const diatonicAccuracy = diatonicAttempts > 0 ? Math.round((diatonicHits / diatonicAttempts) * 1000) / 10 : 100;
    const chromaticAccuracy = chromaticAttempts > 0 ? Math.round((chromaticHits / chromaticAttempts) * 1000) / 10 : 100;
    const octaveAccuracy = this.rounds.length > 0 ? Math.round((octaveHits / this.rounds.length) * 1000) / 10 : 100;

    // Automated algorithmic recommendations
    const recommendations: string[] = [];
    if (this.overallAccuracy >= 90) {
      recommendations.push('¡Excelente oído absoluto y percepción tonal! Tu discriminación cromática es de nivel profesional.');
    } else if (this.overallAccuracy >= 75) {
      recommendations.push('Buen reconocimiento de intervalos y notas fundamentales. Mantén el entrenamiento constante.');
    } else {
      recommendations.push('Recomendado entrenar primero en Modo Diatónico (7 notas naturales) antes de pasar al cromático total.');
    }

    if (chromaticAttempts > 0 && chromaticAccuracy < diatonicAccuracy - 20) {
      recommendations.push('Refuerza la discriminación de notas alteradas sostenidas y bemoles (# / ♭) practicando escalas menores.');
    }

    if (this.tuningSystem === 'pythagorean') {
      recommendations.push('Atención a las comas pitagóricas: recuerda que A# y Bb difieren en 4.76 Hz (23.46 cents) en afinación pitagórica pura.');
    }

    return {
      sessionId: this.id,
      timestamp: this.createdAt,
      totalRounds: this.totalRounds,
      completedRounds: this.rounds.length,
      overallAccuracy: this.overallAccuracy,
      exactNoteAccuracy: this.exactAccuracy,
      pitchClassAccuracy: this.pitchClassAccuracy,
      diatonicAccuracy,
      chromaticAccuracy,
      octaveAccuracy,
      totalScore: this.totalScore,
      maxPossibleScore: this.totalRounds * 1250,
      averageResponseTimeMs: this.averageResponseTimeMs,
      scaleType: this.scaleType,
      tuningSystem: this.tuningSystem,
      a4Reference: this.a4Reference,
      strongestNote,
      weakestNote,
      noteStats,
      recommendations
    };
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      totalRounds: this.totalRounds,
      scaleType: this.scaleType,
      tuningSystem: this.tuningSystem,
      a4Reference: this.a4Reference,
      minOctave: this.minOctave,
      maxOctave: this.maxOctave,
      isCompleted: this.isCompleted,
      rounds: this.rounds
    };
  }

  static fromJSON(data: any): NoteTrainingSession {
    const session = new NoteTrainingSession({
      id: data.id,
      totalRounds: data.totalRounds,
      scaleType: data.scaleType,
      tuningSystem: data.tuningSystem,
      a4Reference: data.a4Reference,
      minOctave: data.minOctave,
      maxOctave: data.maxOctave
    });
    session.isCompleted = !!data.isCompleted;
    if (Array.isArray(data.rounds)) {
      session.rounds = data.rounds;
      session.currentRoundIndex = data.rounds.length;
    }
    return session;
  }
}
