/**
 * Domain Entity: ExerciseRound
 * Captures one round of ear training: target vs user frequency, deviation in Hz/cents,
 * accuracy percentage, time taken, score points, and performance tier.
 */

import { Frequency } from './Frequency';
import { DeviationCalculator } from '../services/DeviationCalculator';

export type PerformanceTier = 
  | 'perfect'      // >= 98% (Oído Absoluto)
  | 'excellent'    // >= 90% (Ingeniero de Sonido Senior)
  | 'good'         // >= 75% (Buena Percepción)
  | 'moderate'     // >= 50% (En Calibración)
  | 'practice';    // < 50% (Requiere Práctica)

export interface PerformanceTierInfo {
  tier: PerformanceTier;
  title: string;
  badgeColor: string;
  description: string;
}

export const TIER_CONFIG: Record<PerformanceTier, PerformanceTierInfo> = {
  perfect: {
    tier: 'perfect',
    title: 'Precisión Milimétrica',
    badgeColor: 'bg-emerald-500 text-black',
    description: '¡Desviación casi nula! Oído afinado con precisión de nivel estudio profesional.'
  },
  excellent: {
    tier: 'excellent',
    title: 'Excelente Precisión',
    badgeColor: 'bg-cyan-500 text-black',
    description: 'Gran capacidad de discriminación tonal y discriminación espectral.'
  },
  good: {
    tier: 'good',
    title: 'Buen Reconocimiento',
    badgeColor: 'bg-blue-500 text-white',
    description: 'Dentro del rango armónico correcto. Ajuste fino en progreso.'
  },
  moderate: {
    tier: 'moderate',
    title: 'Aproximación Moderada',
    badgeColor: 'bg-amber-500 text-black',
    description: 'Detectaste la zona general, pero la desviación en Hz supera el umbral de ajuste.'
  },
  practice: {
    tier: 'practice',
    title: 'Zona de Entrenamiento',
    badgeColor: 'bg-rose-500 text-white',
    description: 'Diferencia notable de tono. El sistema adaptará el rango para asistirte.'
  }
};

export class ExerciseRound {
  public readonly id: string;
  public readonly roundNumber: number;
  public readonly targetFrequency: Frequency;
  public userFrequency?: Frequency;
  public deviationHz?: number;
  public deviationCents?: number;
  public accuracyPercentage?: number; // 0 to 100%
  public scorePoints: number = 0;
  public responseTimeMs?: number;
  public targetPlayCount: number = 0;
  public userPlayCount: number = 0;
  public readonly timestamp: number;
  public completed: boolean = false;
  public difficultyLevel: number = 1;
  public isVulnerabilityDrill: boolean = false;
  public focusZoneName?: string;
  public focusRationale?: string;

  constructor(
    roundNumber: number,
    targetHz: number,
    id?: string,
    difficultyLevel: number = 1,
    isVulnerabilityDrill: boolean = false,
    focusZoneName?: string,
    focusRationale?: string
  ) {
    this.id = id || `round_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.roundNumber = roundNumber;
    this.targetFrequency = new Frequency(targetHz);
    this.timestamp = Date.now();
    this.difficultyLevel = difficultyLevel;
    this.isVulnerabilityDrill = isVulnerabilityDrill;
    this.focusZoneName = focusZoneName;
    this.focusRationale = focusRationale;
  }

  /**
   * Completes the round with user guess and response timing
   */
  completeRound(userHz: number, responseTimeMs: number, toleranceHz: number = 30): void {
    this.userFrequency = new Frequency(userHz);
    this.responseTimeMs = responseTimeMs;
    this.completed = true;

    const analysis = DeviationCalculator.analyze(this.targetFrequency.hz, userHz, toleranceHz);
    this.deviationHz = analysis.deviationHz;
    this.deviationCents = analysis.deviationCents;
    this.accuracyPercentage = analysis.accuracyPercentage;
    this.scorePoints = analysis.scoreClassification.points;
  }

  get performanceTier(): PerformanceTierInfo {
    const acc = this.accuracyPercentage ?? 0;
    if (acc >= 95) return TIER_CONFIG.perfect;
    if (acc >= 85) return TIER_CONFIG.excellent;
    if (acc >= 70) return TIER_CONFIG.good;
    if (acc >= 45) return TIER_CONFIG.moderate;
    return TIER_CONFIG.practice;
  }

  toJSON() {
    return {
      id: this.id,
      roundNumber: this.roundNumber,
      targetHz: this.targetFrequency.hz,
      targetBand: this.targetFrequency.band.id,
      userHz: this.userFrequency?.hz,
      deviationHz: this.deviationHz,
      deviationCents: this.deviationCents,
      accuracyPercentage: this.accuracyPercentage,
      scorePoints: this.scorePoints,
      responseTimeMs: this.responseTimeMs,
      targetPlayCount: this.targetPlayCount,
      completed: this.completed,
      timestamp: this.timestamp,
      difficultyLevel: this.difficultyLevel,
      isVulnerabilityDrill: this.isVulnerabilityDrill,
      focusZoneName: this.focusZoneName,
      focusRationale: this.focusRationale
    };
  }
}
