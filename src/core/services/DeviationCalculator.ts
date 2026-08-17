/**
 * Domain Service: DeviationCalculator
 * Encapsulates scientific acoustic calculations for Hertz deviation, cents deviation,
 * formulaic closeness accuracy, score points, and musical interval proximity.
 */

import { AcousticVulnerabilityEngine, GeneratedAdaptiveTarget, FocusRemediationMode, VulnerabilityAnalysisResult } from './AcousticVulnerabilityEngine';

export interface ScoreClassification {
  category: 'exact' | 'close' | 'far';
  points: number;
  label: string;
  badgeColor: string;
  textColor: string;
}

export interface DeviationAnalysis {
  targetHz: number;
  userHz: number;
  deviationHz: number;          // userHz - targetHz (signed)
  absDeviationHz: number;       // |targetHz - userHz|
  deviationCents: number;       // In musical cents (1 semitone = 100 cents)
  absDeviationCents: number;
  accuracyPercentage: number;   // max(0, 100 - (absDeviationHz / targetHz * 100))
  scoreClassification: ScoreClassification;
  direction: 'exact' | 'sharp' | 'flat'; // sharp = higher, flat = lower
  proportionalError: number;    // |f_user - f_target| / f_target
  musicalIntervalDescription: string;
}

export class DeviationCalculator {
  /**
   * Performs high-precision acoustic analysis between target and user frequencies.
   * @param targetHz Hidden target frequency in Hz
   * @param userHz User selected frequency in Hz
   * @param toleranceHz Optional level tolerance in Hz (default: 30 Hz)
   */
  static analyze(targetHz: number, userHz: number, toleranceHz: number = 30): DeviationAnalysis {
    const deviationHz = Math.round((userHz - targetHz) * 100) / 100;
    const absDeviationHz = Math.abs(deviationHz);
    
    // Musical cents = 1200 * log2(userHz / targetHz)
    const deviationCents = Math.round((1200 * Math.log2(userHz / targetHz)) * 10) / 10;
    const absDeviationCents = Math.abs(deviationCents);

    const proportionalError = absDeviationHz / targetHz;

    // Technical Prompt specification formula:
    // accuracy% = max(0, 100 - (deviationHz / targetFrequency * 100))
    let accuracyPercentage = Math.max(0, 100 - (absDeviationHz / targetHz * 100));
    
    // High accuracy bonus for exact or sub-Hz hits
    if (absDeviationHz <= 0.2) {
      accuracyPercentage = 100;
    } else if (absDeviationHz <= 1.0) {
      accuracyPercentage = Math.max(accuracyPercentage, 99.5);
    }
    accuracyPercentage = Math.round(accuracyPercentage * 10) / 10;

    // Score Classification according to Section 3.3:
    // Exact: deviationHz <= tolerance -> +100 pts
    // Close: deviationHz <= tolerance * 2 -> +50 pts
    // Far: deviationHz > tolerance * 2 -> 0 pts
    let scoreClassification: ScoreClassification;
    if (absDeviationHz <= toleranceHz) {
      scoreClassification = {
        category: 'exact',
        points: 100,
        label: 'EXACTO',
        badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        textColor: 'text-emerald-400'
      };
    } else if (absDeviationHz <= toleranceHz * 2) {
      scoreClassification = {
        category: 'close',
        points: 50,
        label: 'CERCANO',
        badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
        textColor: 'text-amber-400'
      };
    } else {
      scoreClassification = {
        category: 'far',
        points: 0,
        label: 'LEJANO',
        badgeColor: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
        textColor: 'text-rose-400'
      };
    }

    let direction: 'exact' | 'sharp' | 'flat' = 'exact';
    if (deviationHz > 0.05) direction = 'sharp';
    else if (deviationHz < -0.05) direction = 'flat';

    // Interval description
    let intervalDesc = 'En el blanco';
    if (absDeviationCents < 5) {
      intervalDesc = 'Unísono exacto (< 5 cents)';
    } else if (absDeviationCents < 25) {
      intervalDesc = 'Micro-desviación (< 1/4 semitono)';
    } else if (absDeviationCents < 50) {
      intervalDesc = 'Desviación de 1/4 tono';
    } else if (absDeviationCents < 100) {
      intervalDesc = 'Desviación menor a 1 semitono';
    } else if (absDeviationCents < 200) {
      intervalDesc = 'Diferencia de ~1 tono entero';
    } else {
      const semitones = (absDeviationCents / 100).toFixed(1);
      intervalDesc = `Diferencia de ${semitones} semitonos`;
    }

    return {
      targetHz,
      userHz,
      deviationHz,
      absDeviationHz,
      deviationCents,
      absDeviationCents,
      accuracyPercentage,
      scoreClassification,
      direction,
      proportionalError,
      musicalIntervalDescription: intervalDesc
    };
  }

  /**
   * Generates a random target frequency within bounds
   */
  static generateTargetFrequency(minHz: number, maxHz: number, mode: 'continuous' | 'discrete_eq' | 'musical' = 'continuous'): number {
    if (mode === 'discrete_eq') {
      const isoFrequencies = [
        31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
        1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000
      ].filter(f => f >= minHz && f <= maxHz);

      if (isoFrequencies.length > 0) {
        const randomIndex = Math.floor(Math.random() * isoFrequencies.length);
        return isoFrequencies[randomIndex];
      }
    }

    if (mode === 'musical') {
      const notes: number[] = [];
      for (let midi = 21; midi <= 108; midi++) {
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        if (freq >= minHz && freq <= maxHz) {
          notes.push(Math.round(freq * 10) / 10);
        }
      }
      if (notes.length > 0) {
        return notes[Math.floor(Math.random() * notes.length)];
      }
    }

    // Continuous logarithmic random distribution
    const logMin = Math.log10(minHz);
    const logMax = Math.log10(maxHz);
    const randomLog = logMin + Math.random() * (logMax - logMin);
    const hz = Math.pow(10, randomLog);

    return Math.round(hz);
  }

  /**
   * Generates an adaptive target frequency weighted 80% to vulnerable/focused bands and 20% to other spectrum bands
   */
  static generateAdaptiveFrequency(params: {
    minHz: number;
    maxHz: number;
    mode?: 'continuous' | 'discrete_eq' | 'musical';
    focusMode?: FocusRemediationMode;
    vulnerabilityProfile?: VulnerabilityAnalysisResult;
  }): GeneratedAdaptiveTarget {
    return AcousticVulnerabilityEngine.generateAdaptiveFrequency(params);
  }
}

