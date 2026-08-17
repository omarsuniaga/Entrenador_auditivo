/**
 * Domain Entity: TrainingSession
 * Manages an ear training session with chosen repetitions (1-50),
 * history of rounds, accuracy trends, standard deviation, improvement regression,
 * and automated progress reports across all frequency bands.
 */

import { ExerciseRound } from './ExerciseRound';
import { FREQUENCY_BANDS, FrequencyBandInfo } from './Frequency';
import { DifficultyLevel } from './DifficultyProfile';

export interface BandPerformanceSummary {
  band: FrequencyBandInfo;
  attemptsCount: number;
  averageAccuracy: number;
  averageDeviationHz: number;
  averageDeviationCents: number;
  masteryScore: number; // 0 to 100
}

export interface ProgressReport {
  sessionId: string;
  timestamp: number;
  totalRounds: number;
  completedRounds: number;
  overallAccuracy: number;
  overallAvgDeviationHz: number;
  overallAvgDeviationCents: number;
  standardDeviationHz: number;
  improvementSlope: number; // Positive = improving across session
  totalScore: number;
  maxPossibleScore: number;
  bestRound: { roundNumber: number; accuracy: number; deviationHz: number; targetHz: number } | null;
  worstRound: { roundNumber: number; accuracy: number; deviationHz: number; targetHz: number } | null;
  bandSummaries: BandPerformanceSummary[];
  strongestBand: FrequencyBandInfo | null;
  weakestBand: FrequencyBandInfo | null;
  recommendations: string[];
  difficultyLevel: DifficultyLevel;
}

export class TrainingSession {
  public readonly id: string;
  public readonly totalRounds: number;
  public readonly rounds: ExerciseRound[] = [];
  public currentRoundIndex: number = 0;
  public readonly createdAt: number;
  public difficultyLevel: DifficultyLevel;
  public isCompleted: boolean = false;

  constructor(totalRounds: number = 5, difficultyLevel: DifficultyLevel = 1, id?: string) {
    this.id = id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.totalRounds = Math.max(1, Math.min(50, totalRounds));
    this.difficultyLevel = difficultyLevel;
    this.createdAt = Date.now();
  }

  get currentRound(): ExerciseRound | null {
    if (this.currentRoundIndex < this.rounds.length) {
      return this.rounds[this.currentRoundIndex];
    }
    return null;
  }

  get completedRoundsCount(): number {
    return this.rounds.filter(r => r.completed).length;
  }

  get averageAccuracy(): number {
    const completed = this.rounds.filter(r => r.completed && r.accuracyPercentage !== undefined);
    if (completed.length === 0) return 0;
    const sum = completed.reduce((acc, r) => acc + (r.accuracyPercentage || 0), 0);
    return Math.round((sum / completed.length) * 10) / 10;
  }

  get averageDeviationHz(): number {
    const completed = this.rounds.filter(r => r.completed && r.deviationHz !== undefined);
    if (completed.length === 0) return 0;
    const sum = completed.reduce((acc, r) => acc + Math.abs(r.deviationHz || 0), 0);
    return Math.round((sum / completed.length) * 10) / 10;
  }

  get totalScore(): number {
    return this.rounds.filter(r => r.completed).reduce((sum, r) => sum + (r.scorePoints || 0), 0);
  }

  get standardDeviationHz(): number {
    const completed = this.rounds.filter(r => r.completed && r.deviationHz !== undefined);
    if (completed.length <= 1) return 0;
    const mean = this.averageDeviationHz;
    const variance = completed.reduce((sum, r) => sum + Math.pow(Math.abs(r.deviationHz || 0) - mean, 2), 0) / completed.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  get improvementSlope(): number {
    const completed = this.rounds.filter(r => r.completed && r.accuracyPercentage !== undefined);
    if (completed.length < 2) return 0;
    const n = completed.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    completed.forEach((r, idx) => {
      const x = idx + 1;
      const y = r.accuracyPercentage || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    return Math.round(slope * 100) / 100;
  }

  addRound(round: ExerciseRound): void {
    this.rounds.push(round);
  }

  completeCurrentRound(userHz: number, responseTimeMs: number, toleranceHz: number = 30): ExerciseRound | null {
    const current = this.currentRound;
    if (!current) return null;

    current.completeRound(userHz, responseTimeMs, toleranceHz);

    if (this.completedRoundsCount >= this.totalRounds) {
      this.isCompleted = true;
    } else {
      this.currentRoundIndex += 1;
    }

    return current;
  }

  generateProgressReport(): ProgressReport {
    const completed = this.rounds.filter(r => r.completed);

    // Group metrics by frequency bands
    const bandSummaries: BandPerformanceSummary[] = FREQUENCY_BANDS.map(band => {
      const roundsInBand = completed.filter(r => r.targetFrequency.band.id === band.id);
      if (roundsInBand.length === 0) {
        return {
          band,
          attemptsCount: 0,
          averageAccuracy: 0,
          averageDeviationHz: 0,
          averageDeviationCents: 0,
          masteryScore: 0
        };
      }

      const totalAcc = roundsInBand.reduce((sum, r) => sum + (r.accuracyPercentage || 0), 0);
      const totalDevHz = roundsInBand.reduce((sum, r) => sum + Math.abs(r.deviationHz || 0), 0);
      const totalDevCents = roundsInBand.reduce((sum, r) => sum + Math.abs(r.deviationCents || 0), 0);

      const avgAcc = Math.round((totalAcc / roundsInBand.length) * 10) / 10;
      const avgDevHz = Math.round((totalDevHz / roundsInBand.length) * 10) / 10;
      const avgDevCents = Math.round((totalDevCents / roundsInBand.length) * 10) / 10;

      return {
        band,
        attemptsCount: roundsInBand.length,
        averageAccuracy: avgAcc,
        averageDeviationHz: avgDevHz,
        averageDeviationCents: avgDevCents,
        masteryScore: Math.min(100, Math.round(avgAcc))
      };
    });

    const activeBands = bandSummaries.filter(b => b.attemptsCount > 0);
    const sortedByAcc = [...activeBands].sort((a, b) => b.averageAccuracy - a.averageAccuracy);

    const strongestBand = sortedByAcc.length > 0 ? sortedByAcc[0].band : null;
    const weakestBand = sortedByAcc.length > 1 ? sortedByAcc[sortedByAcc.length - 1].band : null;

    let bestRound = null;
    let worstRound = null;

    if (completed.length > 0) {
      const sortedRounds = [...completed].sort((a, b) => (b.accuracyPercentage || 0) - (a.accuracyPercentage || 0));
      const b = sortedRounds[0];
      const w = sortedRounds[sortedRounds.length - 1];

      bestRound = {
        roundNumber: b.roundNumber,
        accuracy: b.accuracyPercentage || 0,
        deviationHz: b.deviationHz || 0,
        targetHz: b.targetFrequency.hz
      };

      worstRound = {
        roundNumber: w.roundNumber,
        accuracy: w.accuracyPercentage || 0,
        deviationHz: w.deviationHz || 0,
        targetHz: w.targetFrequency.hz
      };
    }

    const recommendations: string[] = [];
    if (this.averageAccuracy >= 90) {
      recommendations.push('¡Percepción de nivel estudio profesional! Estás listo para pruebas microtonales o sin feedback en tiempo real.');
    } else if (this.averageAccuracy >= 75) {
      recommendations.push('Buen reconocimiento tonal. Enfócate en distinguir transitorios en agudos y subgraves profundos.');
    } else {
      recommendations.push('Consejo: Escucha la frecuencia objetivo con atención antes de barrer con el sintonizador.');
    }

    if (weakestBand) {
      recommendations.push(`Zona de mejora prioritaria: ${weakestBand.nameEs} (${weakestBand.minHz}-${weakestBand.maxHz} Hz) donde tu desviación promedio fue mayor.`);
    }

    if (this.improvementSlope > 0) {
      recommendations.push(`Tendencia positiva (+${this.improvementSlope.toFixed(1)}%/ejercicio): tu oído se adaptó y afinó rápidamente durante la sesión.`);
    }

    return {
      sessionId: this.id,
      timestamp: this.createdAt,
      totalRounds: this.totalRounds,
      completedRounds: this.completedRoundsCount,
      overallAccuracy: this.averageAccuracy,
      overallAvgDeviationHz: this.averageDeviationHz,
      overallAvgDeviationCents: completed.length ? Math.round(completed.reduce((s, r) => s + Math.abs(r.deviationCents || 0), 0) / completed.length * 10) / 10 : 0,
      standardDeviationHz: this.standardDeviationHz,
      improvementSlope: this.improvementSlope,
      totalScore: this.totalScore,
      maxPossibleScore: this.totalRounds * 100,
      bestRound,
      worstRound,
      bandSummaries,
      strongestBand,
      weakestBand,
      recommendations,
      difficultyLevel: this.difficultyLevel
    };
  }
}
