/**
 * Domain Entity: DifficultyProfile (20-Level DDA Engine)
 * Implements full 20 progressive difficulty levels, narrowing bandwidths,
 * decreasing tolerance thresholds, reducing tone durations, and disabling
 * slider preview at hardcore levels 15+.
 */

export type DifficultyLevel = 
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export interface DifficultyConfig {
  level: DifficultyLevel;
  title: string;
  name: string;
  minHz: number;
  maxHz: number;
  sliderStepHz: number;
  toleranceHz: number; // For exact/close score classification
  toleranceCents: number;
  playbackDurationMs: number;
  previewEnabled: boolean;
  description: string;
}

// Generate the 20 level configs mathematically and with domain accuracy
export const DIFFICULTY_CONFIGS_20: Record<DifficultyLevel, DifficultyConfig> = {
  1: {
    level: 1,
    title: 'Nivel 1: Iniciación Auditiva',
    name: 'Iniciación',
    minHz: 100,
    maxHz: 5000,
    sliderStepHz: 5,
    toleranceHz: 50,
    toleranceCents: 150,
    playbackDurationMs: 5000,
    previewEnabled: true,
    description: 'Rango amplio de frecuencias vocales y melódicas con tolerancia permisiva.'
  },
  2: {
    level: 2,
    title: 'Nivel 2: Explorador de Espectro',
    name: 'Explorador',
    minHz: 100,
    maxHz: 4800,
    sliderStepHz: 4,
    toleranceHz: 45,
    toleranceCents: 130,
    playbackDurationMs: 4800,
    previewEnabled: true,
    description: 'Ajuste inicial de percepción tonal en medios y agudos.'
  },
  3: {
    level: 3,
    title: 'Nivel 3: Fundamentos de EQ',
    name: 'Fundamentos',
    minHz: 120,
    maxHz: 4500,
    sliderStepHz: 4,
    toleranceHz: 40,
    toleranceCents: 115,
    playbackDurationMs: 4500,
    previewEnabled: true,
    description: 'Entrenamiento de oído en cuerpo tímbrico e inteligibilidad vocal.'
  },
  4: {
    level: 4,
    title: 'Nivel 4: Calibración Media',
    name: 'Calibración',
    minHz: 150,
    maxHz: 4200,
    sliderStepHz: 3,
    toleranceHz: 36,
    toleranceCents: 100,
    playbackDurationMs: 4200,
    previewEnabled: true,
    description: 'Comienzo de refinamiento del rango dinámico medio.'
  },
  5: {
    level: 5,
    title: 'Nivel 5: Discriminación Armónica',
    name: 'Discriminación',
    minHz: 180,
    maxHz: 3800,
    sliderStepHz: 3,
    toleranceHz: 32,
    toleranceCents: 90,
    playbackDurationMs: 4000,
    previewEnabled: true,
    description: 'Tolerancia reducida a ±32 Hz para mayor precisión tímbrica.'
  },
  6: {
    level: 6,
    title: 'Nivel 6: Afinador de Instrumentos',
    name: 'Afinador',
    minHz: 200,
    maxHz: 3500,
    sliderStepHz: 2,
    toleranceHz: 28,
    toleranceCents: 80,
    playbackDurationMs: 3800,
    previewEnabled: true,
    description: 'Frecuencias fundamentales de cuerdas y viento metal.'
  },
  7: {
    level: 7,
    title: 'Nivel 7: Percepción de Medios',
    name: 'Medios',
    minHz: 220,
    maxHz: 3200,
    sliderStepHz: 2,
    toleranceHz: 25,
    toleranceCents: 70,
    playbackDurationMs: 3500,
    previewEnabled: true,
    description: 'Discriminación afinada en la zona crítica del espectro humano (1-3 kHz).'
  },
  8: {
    level: 8,
    title: 'Nivel 8: Diseñador de Sonido',
    name: 'Diseño Sonoro',
    minHz: 250,
    maxHz: 3000,
    sliderStepHz: 2,
    toleranceHz: 22,
    toleranceCents: 60,
    playbackDurationMs: 3200,
    previewEnabled: true,
    description: 'Refuerzo de transitorios y respuesta auditiva rápida.'
  },
  9: {
    level: 9,
    title: 'Nivel 9: Asistente de Mezcla',
    name: 'Asistente Mezcla',
    minHz: 280,
    maxHz: 2800,
    sliderStepHz: 1,
    toleranceHz: 20,
    toleranceCents: 55,
    playbackDurationMs: 3000,
    previewEnabled: true,
    description: 'Resolución de 1 Hz en el slider y tolerancia estándar de estudio.'
  },
  10: {
    level: 10,
    title: 'Nivel 10: Ingeniero de Audio Junior',
    name: 'Ingeniero Junior',
    minHz: 300,
    maxHz: 2500,
    sliderStepHz: 1,
    toleranceHz: 18,
    toleranceCents: 50,
    playbackDurationMs: 2800,
    previewEnabled: true,
    description: 'Precisión equivalente a un semitono exacto o menos.'
  },
  11: {
    level: 11,
    title: 'Nivel 11: Resonancias Quirúrgicas',
    name: 'Quirúrgico',
    minHz: 320,
    maxHz: 2200,
    sliderStepHz: 1,
    toleranceHz: 16,
    toleranceCents: 45,
    playbackDurationMs: 2500,
    previewEnabled: true,
    description: 'Identificación de nodos resonantes y filtrado notch.'
  },
  12: {
    level: 12,
    title: 'Nivel 12: Ingeniero de Mezcla Senior',
    name: 'Ingeniero Senior',
    minHz: 350,
    maxHz: 2000,
    sliderStepHz: 1,
    toleranceHz: 14,
    toleranceCents: 40,
    playbackDurationMs: 2300,
    previewEnabled: true,
    description: 'Sensibilidad auditiva avanzada con duración de escucha corta.'
  },
  13: {
    level: 13,
    title: 'Nivel 13: Especialista de Mastering',
    name: 'Mastering',
    minHz: 380,
    maxHz: 1800,
    sliderStepHz: 1,
    toleranceHz: 12,
    toleranceCents: 35,
    playbackDurationMs: 2000,
    previewEnabled: true,
    description: 'Control quirúrgico del balance espectral en bandas estrechas.'
  },
  14: {
    level: 14,
    title: 'Nivel 14: Micro-Discriminación',
    name: 'Microtonal',
    minHz: 400,
    maxHz: 1600,
    sliderStepHz: 1,
    toleranceHz: 10,
    toleranceCents: 30,
    playbackDurationMs: 1800,
    previewEnabled: true,
    description: 'Último nivel con preview auditivo interactivo activado.'
  },
  15: {
    level: 15,
    title: 'Nivel 15: Oído Crítico (Ciego)',
    name: 'Oído Crítico',
    minHz: 400,
    maxHz: 1500,
    sliderStepHz: 1,
    toleranceHz: 8,
    toleranceCents: 25,
    playbackDurationMs: 1600,
    previewEnabled: false,
    description: '¡Sin preview interactivo en slider! Audición a ciegas y memoria auditiva pura.'
  },
  16: {
    level: 16,
    title: 'Nivel 16: Oído Absoluto',
    name: 'Oído Absoluto',
    minHz: 420,
    maxHz: 1400,
    sliderStepHz: 1,
    toleranceHz: 6,
    toleranceCents: 20,
    playbackDurationMs: 1500,
    previewEnabled: false,
    description: 'Tolerancia de apenas ±6 Hz y duración de audio de 1.5s.'
  },
  17: {
    level: 17,
    title: 'Nivel 17: Maestro Acústico',
    name: 'Maestro Acústico',
    minHz: 420,
    maxHz: 1200,
    sliderStepHz: 1,
    toleranceHz: 5,
    toleranceCents: 15,
    playbackDurationMs: 1300,
    previewEnabled: false,
    description: 'Identificación ultra-rápida de frecuencias fundamentales.'
  },
  18: {
    level: 18,
    title: 'Nivel 18: Francotirador Espectral',
    name: 'Francotirador',
    minHz: 430,
    maxHz: 1100,
    sliderStepHz: 1,
    toleranceHz: 4,
    toleranceCents: 12,
    playbackDurationMs: 1200,
    previewEnabled: false,
    description: 'Tolerancia quirúrgica de ±4 Hz a ciegas.'
  },
  19: {
    level: 19,
    title: 'Nivel 19: Oído de Diamante',
    name: 'Oído de Diamante',
    minHz: 435,
    maxHz: 980,
    sliderStepHz: 1,
    toleranceHz: 3,
    toleranceCents: 10,
    playbackDurationMs: 1100,
    previewEnabled: false,
    description: 'Detección micro-centésima sin feedback en tiempo real.'
  },
  20: {
    level: 20,
    title: 'Nivel 20: Leyenda del Espectro',
    name: 'Leyenda',
    minHz: 440,
    maxHz: 880,
    sliderStepHz: 1,
    toleranceHz: 2,
    toleranceCents: 8,
    playbackDurationMs: 1000,
    previewEnabled: false,
    description: 'Máxima exigencia: 1 segundo de escucha, rango 440-880Hz y tolerancia de solo ±2 Hz.'
  }
};

export class DifficultyProfile {
  private _level: DifficultyLevel;
  private _recentAccuracies: number[] = [];
  private _streakSuccess: number = 0;
  private _streakStruggle: number = 0;
  private _lastAdjustmentMessage: string | null = null;

  constructor(initialLevel: DifficultyLevel = 1) {
    this._level = Math.max(1, Math.min(20, initialLevel)) as DifficultyLevel;
  }

  get level(): DifficultyLevel {
    return this._level;
  }

  get config(): DifficultyConfig {
    return DIFFICULTY_CONFIGS_20[this._level] || DIFFICULTY_CONFIGS_20[1];
  }

  get minHz(): number {
    return this.config.minHz;
  }

  get maxHz(): number {
    return this.config.maxHz;
  }

  get previewEnabled(): boolean {
    return this.config.previewEnabled;
  }

  get streakSuccess(): number {
    return this._streakSuccess;
  }

  get streakStruggle(): number {
    return this._streakStruggle;
  }

  get lastAdjustmentMessage(): string | null {
    return this._lastAdjustmentMessage;
  }

  /**
   * Evaluates recent attempts according to DDA specification:
   * - If accuracy >= 80% in last 5 exercises -> level up (+1)
   * - If accuracy <= 40% in last 5 exercises -> level down (-1)
   * - If between 40% and 80% -> maintain level
   */
  registerAttempt(accuracyPercentage: number, deviationHz: number): string | null {
    this._recentAccuracies.push(accuracyPercentage);
    if (this._recentAccuracies.length > 5) {
      this._recentAccuracies.shift();
    }

    if (accuracyPercentage >= 85) {
      this._streakSuccess += 1;
      this._streakStruggle = 0;
    } else if (accuracyPercentage < 50 || deviationHz > this.config.toleranceHz * 2) {
      this._streakStruggle += 1;
      this._streakSuccess = 0;
    }

    // Check 5-round window when we have enough data or strong streaks
    if (this._recentAccuracies.length >= 5) {
      const avgRecent = this._recentAccuracies.reduce((a, b) => a + b, 0) / this._recentAccuracies.length;

      if (avgRecent >= 80 && this._level < 20) {
        this._level = (this._level + 1) as DifficultyLevel;
        this._recentAccuracies = [];
        this._streakSuccess = 0;
        this._lastAdjustmentMessage = `¡Subiste a ${this.config.title}! Precisión media reciente: ${avgRecent.toFixed(0)}% ≥ 80%. Rango ajustado a ${this.config.minHz}-${this.config.maxHz} Hz con tolerancia ±${this.config.toleranceHz} Hz.`;
        return this._lastAdjustmentMessage;
      } else if (avgRecent <= 40 && this._level > 1) {
        this._level = (this._level - 1) as DifficultyLevel;
        this._recentAccuracies = [];
        this._streakStruggle = 0;
        this._lastAdjustmentMessage = `Dificultad adaptada a ${this.config.title} para consolidar percepción. Rango: ${this.config.minHz}-${this.config.maxHz} Hz.`;
        return this._lastAdjustmentMessage;
      }
    } else if (this._streakSuccess >= 3 && this._level < 20) {
      // Fast track promotion on 3 consecutive stellar rounds
      this._level = (this._level + 1) as DifficultyLevel;
      this._streakSuccess = 0;
      this._lastAdjustmentMessage = `¡Racha excelente! Dificultad aumentada a ${this.config.title}.`;
      return this._lastAdjustmentMessage;
    }

    this._lastAdjustmentMessage = null;
    return null;
  }

  setLevel(level: DifficultyLevel | number) {
    this._level = Math.max(1, Math.min(20, Math.round(level))) as DifficultyLevel;
    this._recentAccuracies = [];
    this._streakSuccess = 0;
    this._streakStruggle = 0;
    this._lastAdjustmentMessage = null;
  }
}
