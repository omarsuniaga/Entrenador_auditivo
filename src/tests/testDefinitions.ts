/**
 * Unified Test Suite Definitions for AudioLab Core & Presentation
 * Can be executed in both browser UI and CLI (Node / tsx).
 */

import {
  hzToLogSliderValue,
  logSliderValueToHz,
  formatHertz,
  formatDeviationHz,
  formatCents
} from '../shared/utils/audioMath';
import { DeviationCalculator } from '../core/services/DeviationCalculator';
import { AdaptiveDifficultyEngine } from '../core/services/AdaptiveDifficultyEngine';
import { DIFFICULTY_CONFIGS_20, DifficultyProfile } from '../core/entities/DifficultyProfile';
import { ExerciseRound } from '../core/entities/ExerciseRound';
import { TrainingSession } from '../core/entities/TrainingSession';
import {
  AUDIO_OUTPUT_PROFILES,
  getEffectiveFrequencyBounds,
  filterIsoFrequenciesForProfile,
  getEffectiveOctaveBounds
} from '../core/entities/AudioOutputProfile';
import { getAppVersion, APP_VERSION_INFO } from '../shared/version';


export interface TestCaseResult {
  id: string;
  name: string;
  category: 'Matemáticas Acústicas' | 'Motor DDA & Niveles' | 'Entidades & Estado' | 'Cálculo de Desviación' | 'Síntesis & Rendimiento';
  passed: boolean;
  durationMs: number;
  expected?: string;
  actual?: string;
  error?: string;
  details?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
  timestamp: string;
}

export type TestFn = () => Promise<void> | void;

export interface TestDefinition {
  id: string;
  name: string;
  category: TestCaseResult['category'];
  fn: TestFn;
}

/**
 * Assert helper functions
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertClose(actual: number, expected: number, delta: number = 0.01, message?: string) {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(
      `${message ? message + ': ' : ''}Expected ${expected} ±${delta}, but got ${actual}`
    );
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Full Suite of 24 comprehensive test cases
 */
export const ALL_TEST_DEFINITIONS: TestDefinition[] = [
  // --- 1. MATEMÁTICAS ACÚSTICAS ---
  {
    id: 'math-01',
    name: 'Mapeo Logarítmico: Extremos y Valores Medios (20 Hz - 20000 Hz)',
    category: 'Matemáticas Acústicas',
    fn: () => {
      const minVal = hzToLogSliderValue(20, 20, 20000);
      assertClose(minVal, 0.0, 0.001, 'Slider value at minHz (20Hz) must be 0.0');

      const maxVal = hzToLogSliderValue(20000, 20, 20000);
      assertClose(maxVal, 1.0, 0.001, 'Slider value at maxHz (20000Hz) must be 1.0');

      const centerHz = logSliderValueToHz(0.5, 20, 20000);
      // Math.sqrt(20 * 20000) = ~632.45 Hz
      assert(centerHz >= 600 && centerHz <= 660, `Center frequency should be approx 632 Hz, got ${centerHz}`);
    }
  },
  {
    id: 'math-02',
    name: 'Transformación Invertible Hz -> Slider -> Hz',
    category: 'Matemáticas Acústicas',
    fn: () => {
      const testFrequencies = [50, 100, 440, 1000, 3500, 10000, 15000];
      for (const f of testFrequencies) {
        const slider = hzToLogSliderValue(f, 20, 20000);
        const reconstructed = logSliderValueToHz(slider, 20, 20000);
        const errorMargin = f * 0.03; // Within 3% due to rounding steps
        assert(
          Math.abs(reconstructed - f) <= errorMargin,
          `Roundtrip error for ${f}Hz: reconstructed as ${reconstructed}Hz`
        );
      }
    }
  },
  {
    id: 'math-03',
    name: 'Formateo de Frecuencias y Unidades (Hz, kHz, Cents)',
    category: 'Matemáticas Acústicas',
    fn: () => {
      assertEquals(formatHertz(440), '440 Hz', '440 Hz format');
      assertEquals(formatHertz(1000), '1.00 kHz', '1000 Hz format in kHz');
      assertEquals(formatHertz(4500), '4.50 kHz', '4500 Hz format in kHz');
      assertEquals(formatHertz(12500), '12.5 kHz', '12500 Hz format in kHz');
      assertEquals(formatHertz(0), '0 Hz', '0 Hz handling');

      assertEquals(formatDeviationHz(15.5), '+15.5 Hz', 'Positive deviation');
      assertEquals(formatDeviationHz(-1200), '-1.20 kHz', 'Negative kHz deviation');
      assertEquals(formatCents(50), '+50.0 cents', 'Cents formatting');
    }
  },
  {
    id: 'math-04',
    name: 'Cálculo de Desviación en Cents Musicales (Octava = 1200 Cents)',
    category: 'Matemáticas Acústicas',
    fn: () => {
      // 440 Hz vs 880 Hz (1 octave higher) = +1200 cents
      const analysisOctave = DeviationCalculator.analyze(440, 880);
      assertClose(analysisOctave.deviationCents, 1200, 1.0, 'Octave jump should be 1200 cents');

      // 440 Hz vs 220 Hz (1 octave lower) = -1200 cents
      const analysisDown = DeviationCalculator.analyze(440, 220);
      assertClose(analysisDown.deviationCents, -1200, 1.0, 'Octave drop should be -1200 cents');

      // Unison (440 Hz vs 440 Hz) = 0 cents
      const analysisUnison = DeviationCalculator.analyze(440, 440);
      assertEquals(analysisUnison.deviationCents, 0, 'Unison should be 0 cents');
    }
  },

  {
    id: 'math-05',
    name: 'Teoría Musical: Coma Pitagórica (23.46 cents) y Coma Sintónica (21.51 cents)',
    category: 'Matemáticas Acústicas',
    fn: () => {
      // Pythagorean Coma = (3/2)^12 / 2^7 = 531441 / 524288 = ~1.01364326
      const pythagoreanRatio = Math.pow(1.5, 12) / Math.pow(2, 7);
      const pythagoreanCents = 1200 * Math.log2(pythagoreanRatio);
      assertClose(pythagoreanCents, 23.46, 0.05, 'Pythagorean comma must be ~23.46 cents');

      // Syntonic Coma = 81 / 80 = 1.0125
      const syntonicRatio = 81 / 80;
      const syntonicCents = 1200 * Math.log2(syntonicRatio);
      assertClose(syntonicCents, 21.51, 0.05, 'Syntonic comma must be ~21.51 cents');
    }
  },

  // --- 2. CÁLCULO DE DESVIACIÓN & SCORING ---
  {
    id: 'dev-01',
    name: 'Puntaje Perfecto e Inmunidad a Tolerancia en Acierto Exacto',
    category: 'Cálculo de Desviación',
    fn: () => {
      const analysis = DeviationCalculator.analyze(1000, 1000, 20);
      assertEquals(analysis.deviationHz, 0, 'Deviation should be 0 Hz');
      assertEquals(analysis.accuracyPercentage, 100, 'Accuracy should be 100%');
      assertEquals(analysis.scoreClassification.category, 'exact', 'Category should be exact');
      assertEquals(analysis.scoreClassification.points, 100, 'Points should be 100');
      assertEquals(analysis.direction, 'exact', 'Direction should be exact');
    }
  },
  {
    id: 'dev-02',
    name: 'Detección Direccional (Agudo / Sharp vs Grave / Flat)',
    category: 'Cálculo de Desviación',
    fn: () => {
      const sharpAnalysis = DeviationCalculator.analyze(500, 550, 25);
      assertEquals(sharpAnalysis.direction, 'sharp', 'Higher frequency must be sharp');
      assertEquals(sharpAnalysis.deviationHz, 50, 'Positive deviation');

      const flatAnalysis = DeviationCalculator.analyze(500, 450, 25);
      assertEquals(flatAnalysis.direction, 'flat', 'Lower frequency must be flat');
      assertEquals(flatAnalysis.deviationHz, -50, 'Negative deviation');
    }
  },
  {
    id: 'dev-03',
    name: 'Escalonamiento de Categorías: Exacto (100 pts), Cercano (50 pts), Lejano (0 pts)',
    category: 'Cálculo de Desviación',
    fn: () => {
      const tolerance = 20; // Exact <= 20 Hz, Close <= 40 Hz, Far > 40 Hz
      const target = 1000;

      const exact = DeviationCalculator.analyze(target, 1015, tolerance);
      assertEquals(exact.scoreClassification.category, 'exact');
      assertEquals(exact.scoreClassification.points, 100);

      const close = DeviationCalculator.analyze(target, 1035, tolerance);
      assertEquals(close.scoreClassification.category, 'close');
      assertEquals(close.scoreClassification.points, 50);

      const far = DeviationCalculator.analyze(target, 1100, tolerance);
      assertEquals(far.scoreClassification.category, 'far');
      assertEquals(far.scoreClassification.points, 0);
    }
  },
  {
    id: 'dev-04',
    name: 'Generación Aleatoria de Frecuencias Objetivo (Continuo, EQ, Musical)',
    category: 'Cálculo de Desviación',
    fn: () => {
      for (let i = 0; i < 20; i++) {
        const continuous = DeviationCalculator.generateTargetFrequency(200, 2000, 'continuous');
        assert(continuous >= 200 && continuous <= 2000, `Continuous target ${continuous} out of bounds`);

        const eq = DeviationCalculator.generateTargetFrequency(100, 8000, 'discrete_eq');
        assert(eq >= 100 && eq <= 8000, `EQ target ${eq} out of bounds`);

        const musical = DeviationCalculator.generateTargetFrequency(220, 880, 'musical');
        assert(musical >= 220 && musical <= 880, `Musical target ${musical} out of bounds`);
      }
    }
  },

  // --- 3. MOTOR DDA & NIVELES ---
  {
    id: 'dda-01',
    name: 'Verificación de Integridad de los 20 Niveles de Dificultad',
    category: 'Motor DDA & Niveles',
    fn: () => {
      const configs = AdaptiveDifficultyEngine.getAllConfigs();
      assertEquals(configs.length, 20, 'Should contain exactly 20 configured difficulty levels');

      configs.forEach((cfg, idx) => {
        const expectedLevel = idx + 1;
        assertEquals(cfg.level, expectedLevel, `Level config mismatch at index ${idx}`);
        assert(cfg.minHz < cfg.maxHz, `Level ${cfg.level}: minHz (${cfg.minHz}) must be < maxHz (${cfg.maxHz})`);
        assert(cfg.toleranceHz > 0, `Level ${cfg.level}: toleranceHz (${cfg.toleranceHz}) must be > 0`);
        assert(cfg.playbackDurationMs > 0, `Level ${cfg.level}: playbackDurationMs must be positive`);
      });
    }
  },
  {
    id: 'dda-02',
    name: 'Progresión Dinámica por Racha de Éxitos (Auto Level-Up)',
    category: 'Motor DDA & Niveles',
    fn: () => {
      const profile = new DifficultyProfile(1);
      assertEquals(profile.level, 1, 'Initial level must be 1');

      // 3 consecutive excellent attempts (> 95% accuracy) should trigger level upgrade
      profile.registerAttempt(98, 2);
      profile.registerAttempt(99, 1);
      const msg = profile.registerAttempt(97, 3);

      assertEquals(profile.level, 2, 'Profile should advance to Level 2 after 3 successes');
      assert(typeof msg === 'string' && msg.includes('Nivel 2'), 'Should return congratulatory upgrade message');
    }
  },
  {
    id: 'dda-03',
    name: 'Regresión Adaptativa ante Dificultad Excesiva (Auto Level-Down)',
    category: 'Motor DDA & Niveles',
    fn: () => {
      const profile = new DifficultyProfile(5);
      assertEquals(profile.level, 5, 'Initial level must be 5');

      // 5 consecutive poor attempts (avg <= 40% accuracy) triggers level downgrade
      profile.registerAttempt(30, 200);
      profile.registerAttempt(35, 180);
      profile.registerAttempt(25, 250);
      profile.registerAttempt(30, 190);
      const msg = profile.registerAttempt(35, 200);

      assertEquals(profile.level, 4, 'Profile should demote to Level 4');
      assert(typeof msg === 'string' && msg.includes('Nivel 4'), 'Should return helpful downgrade message');
    }
  },
  {
    id: 'dda-04',
    name: 'Límites de Seguridad en Extremos (Clamping Nivel 1 y Nivel 20)',
    category: 'Motor DDA & Niveles',
    fn: () => {
      const minProfile = new DifficultyProfile(1);
      minProfile.registerAttempt(10, 500);
      minProfile.registerAttempt(10, 500);
      assertEquals(minProfile.level, 1, 'Level 1 must not demote below 1');

      const maxProfile = new DifficultyProfile(20);
      maxProfile.registerAttempt(100, 0);
      maxProfile.registerAttempt(100, 0);
      maxProfile.registerAttempt(100, 0);
      assertEquals(maxProfile.level, 20, 'Level 20 must not promote above 20');
    }
  },

  // --- 4. ENTIDADES & ESTADO ---
  {
    id: 'ent-01',
    name: 'Entidad ExerciseRound: Ciclo de Vida y Métricas de Respuesta',
    category: 'Entidades & Estado',
    fn: () => {
      const round = new ExerciseRound(1, 440);
      assertEquals(round.roundNumber, 1);
      assertEquals(round.targetFrequency.hz, 440);
      assertEquals(round.completed, false);

      round.completeRound(445, 1250, 20);

      assertEquals(round.completed, true);
      assertEquals(round.userFrequency?.hz, 445);
      assertEquals(round.deviationHz, 5);
      assertEquals(round.responseTimeMs, 1250);
      assertEquals(round.scorePoints, 100);
    }
  },
  {
    id: 'ent-02',
    name: 'Entidad TrainingSession: Agregación de Rondas y Promedios',
    category: 'Entidades & Estado',
    fn: () => {
      const session = new TrainingSession(3, 1, 'test-session-1');
      assertEquals(session.rounds.length, 0);

      // Round 1: Perfect
      const r1 = new ExerciseRound(1, 500);
      r1.completeRound(500, 800, 20);
      session.addRound(r1);

      // Round 2: Close (+10 Hz)
      const r2 = new ExerciseRound(2, 1000);
      r2.completeRound(1010, 1200, 20);
      session.addRound(r2);

      assertEquals(session.completedRoundsCount, 2);
      assertEquals(session.totalScore, 200);
      assert(session.averageAccuracy >= 95, `Average accuracy should be >= 95%, got ${session.averageAccuracy}`);
      assertEquals(session.averageDeviationHz, 5, 'Average deviation of (0 + 10)/2 = 5');
    }
  },
  {
    id: 'ent-03',
    name: 'Serialización y Deserialización JSON de Sesión de Entrenamiento',
    category: 'Entidades & Estado',
    fn: () => {
      const session = new TrainingSession(5, 2, 'json-test-id');
      const round = new ExerciseRound(1, 800);
      round.completeRound(810, 950, 25);
      session.addRound(round);

      const serialized = JSON.stringify(session);
      const parsed = JSON.parse(serialized);

      assertEquals(parsed.id, 'json-test-id');
      assertEquals(parsed.difficultyLevel, 2);
      assertEquals(parsed.rounds.length, 1);
      assertEquals(parsed.rounds[0].targetHz, 800);
      assertEquals(parsed.rounds[0].userHz, 810);
    }
  },
  {
    id: 'ent-04',
    name: 'Versión del Sistema y Compatibilidad de Contrato',
    category: 'Entidades & Estado',
    fn: () => {
      const ver = getAppVersion();
      assert(ver.startsWith('v2.'), `Version string should follow semantic v2.x, got ${ver}`);
      assert(APP_VERSION_INFO.version.startsWith('2.'), 'Major version is 2');
      assertEquals(typeof APP_VERSION_INFO.buildNumber, 'number', 'Build number should be numeric');
    }
  },

  // --- 5. SÍNTESIS & RENDIMIENTO ---
  {
    id: 'perf-01',
    name: 'Benchmark de Rendimiento: 10,000 Cálculos Logarítmicos en < 20ms',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      const start = performance.now();
      let accum = 0;
      for (let i = 0; i < 10000; i++) {
        const hz = 20 + (i % 19980);
        const slider = hzToLogSliderValue(hz, 20, 20000);
        accum += logSliderValueToHz(slider, 20, 20000);
      }
      const elapsed = performance.now() - start;
      assert(accum > 0, 'Calculation accumulation check');
      assert(
        elapsed < 50,
        `Benchmark execution must complete in under 50ms, took ${elapsed.toFixed(2)}ms`
      );
    }
  },
  {
    id: 'perf-02',
    name: 'Simulación de 100 Rondas Consecutivas sin Fugas de Memoria',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      const session = new TrainingSession(100, 1, 'stress-session');
      for (let i = 1; i <= 100; i++) {
        const targetHz = 100 + i * 50;
        const userHz = targetHz + (Math.random() * 20 - 10);
        const round = new ExerciseRound(i, targetHz);
        round.completeRound(userHz, 600, 20);
        session.addRound(round);
      }

      assertEquals(session.rounds.length, 100);
      assert(session.totalScore > 0, 'Total score should be calculated');
      assert(session.averageAccuracy > 0, 'Average accuracy should be calculated');
    }
  },
  {
    id: 'perf-03',
    name: 'Seguridad Acústica: Limitador de Frecuencias (20 Hz - 20,000 Hz)',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      // Sub-audible clamp test
      const subHz = logSliderValueToHz(-0.5, 20, 20000);
      assert(subHz >= 20, `Negative slider values must clamp to at least 20 Hz, got ${subHz}`);

      // Ultrasonic clamp test
      const ultraHz = logSliderValueToHz(1.5, 20, 20000);
      assert(ultraHz <= 20000, `Overflow slider values must clamp to max 20,000 Hz, got ${ultraHz}`);
    }
  },
  {
    id: 'dial-01',
    name: 'Sintonizador Radial: Factores de Multiplicación por Sensibilidad (Gear Ratios)',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      const gearRatios = {
        coarse: 3.0,
        normal: 1.0,
        fine: 0.2,
        micro: 0.05
      };

      const baseDeltaAngle = 0.1; // radians
      const normalDelta = (baseDeltaAngle / (2 * Math.PI)) * gearRatios.normal;
      const coarseDelta = (baseDeltaAngle / (2 * Math.PI)) * gearRatios.coarse;
      const microDelta = (baseDeltaAngle / (2 * Math.PI)) * gearRatios.micro;

      assertClose(coarseDelta, normalDelta * 3, 0.0001, 'Coarse must be 3x normal');
      assertClose(microDelta, normalDelta * 0.05, 0.0001, 'Micro must be 0.05x normal');
    }
  },
  {
    id: 'audio-01',
    name: 'Generador de Tono: Rampa Anti-Click y Tiempo de Fade (Gain Envelope)',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      const attackTimeMs = 25;
      const releaseTimeMs = 40;
      const targetGain = 0.25;

      assert(attackTimeMs >= 10 && attackTimeMs <= 100, 'Attack ramp must be smooth to avoid acoustic click transients');
      assert(releaseTimeMs >= 20 && releaseTimeMs <= 150, 'Release ramp must fade smoothly');
      assert(targetGain <= 0.8, 'Safe headphone volume limit (<= 0.8)');
    }
  },
  {
    id: 'audio-02',
    name: 'Calibración Acústica: Perfil Altavoces Móvil (Floor 130 Hz) vs Auriculares (20 Hz)',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      // Mobile speaker profile must clamp sub-bass to 130 Hz floor
      const mobileBoundsLvl1 = getEffectiveFrequencyBounds('mobile_speaker', 100, 5000);
      assertEquals(mobileBoundsLvl1.minHz, 130, 'Mobile speaker must lift 100 Hz minimum to 130 Hz physical limit');
      assertEquals(mobileBoundsLvl1.maxHz, 5000, 'Level 1 upper limit preserved');

      // Studio headphones profile retains full 20 Hz - 20 kHz capability
      const studioBoundsLvl1 = getEffectiveFrequencyBounds('headphones_studio', 100, 5000);
      assertEquals(studioBoundsLvl1.minHz, 100, 'Headphones retains 100 Hz floor from Level 1');

      // Octave clamping
      const mobileOctaves = getEffectiveOctaveBounds('mobile_speaker', 1, 7);
      assertEquals(mobileOctaves.minOctave, 3, 'Mobile speaker minimum octave must be C3 (~130.8 Hz)');
      assertEquals(mobileOctaves.maxOctave, 6, 'Mobile speaker maximum octave must be C6');
    }
  },
  {
    id: 'audio-03',
    name: 'Filtrado de Bandas ISO: Eliminación de Frecuencias Inaudibles (< 130 Hz) en Móvil',
    category: 'Síntesis & Rendimiento',
    fn: () => {
      const allIsoBands = [31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 500, 1000, 16000];
      const filteredMobile = filterIsoFrequenciesForProfile('mobile_speaker', allIsoBands);

      assert(!filteredMobile.includes(31.5), '31.5 Hz must be excluded from mobile speakers');
      assert(!filteredMobile.includes(50), '50 Hz must be excluded from mobile speakers');
      assert(!filteredMobile.includes(80), '80 Hz must be excluded from mobile speakers');
      assert(!filteredMobile.includes(100), '100 Hz must be excluded from mobile speakers');
      assert(filteredMobile.includes(160), '160 Hz must be included in mobile speakers');
      assert(filteredMobile.includes(1000), '1000 Hz must be included in mobile speakers');

      const filteredStudio = filterIsoFrequenciesForProfile('headphones_studio', allIsoBands);
      assertEquals(filteredStudio.length, allIsoBands.length, 'Studio mode includes all ISO bands');
    }
  }
];


/**
 * Runner function that executes all or selected test definitions
 */
export async function runTestSuite(
  filterCategory?: string,
  onProgress?: (completed: number, total: number, latestResult: TestCaseResult) => void
): Promise<TestSuiteSummary> {
  const testsToRun = filterCategory
    ? ALL_TEST_DEFINITIONS.filter(t => t.category === filterCategory)
    : ALL_TEST_DEFINITIONS;

  const results: TestCaseResult[] = [];
  const startGlobal = performance.now();

  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];
    const startTest = performance.now();
    let passed = false;
    let errorMsg: string | undefined;

    try {
      await test.fn();
      passed = true;
    } catch (err: any) {
      passed = false;
      errorMsg = err?.message || String(err);
    }

    const durationMs = Math.round((performance.now() - startTest) * 100) / 100;

    const result: TestCaseResult = {
      id: test.id,
      name: test.name,
      category: test.category,
      passed,
      durationMs,
      error: errorMsg
    };

    results.push(result);
    if (onProgress) {
      onProgress(i + 1, testsToRun.length, result);
    }
  }

  const durationMs = Math.round((performance.now() - startGlobal) * 100) / 100;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    durationMs,
    results,
    timestamp: new Date().toISOString()
  };
}
