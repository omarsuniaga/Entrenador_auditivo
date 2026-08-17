export interface SoloResult {
  score: number;
  accuracy: number;
}

const MIN_FREQUENCY_HZ = 20;
const MAX_FREQUENCY_HZ = 20_000;

function isValidFrequency(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_FREQUENCY_HZ
    && value <= MAX_FREQUENCY_HZ;
}

/**
 * Computes the only score accepted by the leaderboard. The client submits
 * guesses exclusively; it never submits a score or an accuracy percentage.
 */
export function calculateSoloResult(targets: readonly number[], answers: readonly unknown[], toleranceHz: number): SoloResult {
  if (targets.length === 0 || targets.length !== answers.length) {
    throw new Error('Las respuestas deben coincidir exactamente con las rondas de la sesión.');
  }
  if (!Number.isFinite(toleranceHz) || toleranceHz <= 0) {
    throw new Error('La tolerancia de la sesión no es válida.');
  }

  let score = 0;
  let accuracyTotal = 0;

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    const answer = answers[index];
    if (!isValidFrequency(target) || !isValidFrequency(answer)) {
      throw new Error('Cada frecuencia debe estar entre 20 y 20000 Hz.');
    }

    const deviation = Math.abs(answer - target);
    if (deviation <= toleranceHz) score += 100;
    else if (deviation <= toleranceHz * 2) score += 50;

    accuracyTotal += deviation <= 0.2
      ? 100
      : Math.max(0, 100 - (deviation / target * 100));
  }

  return {
    score,
    accuracy: Math.round((accuracyTotal / targets.length) * 10) / 10
  };
}
