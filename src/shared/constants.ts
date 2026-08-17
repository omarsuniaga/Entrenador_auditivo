/**
 * Application Constants
 */

export const REPETITION_OPTIONS = [3, 5, 10, 15, 20, 25];

export const WAVEFORM_OPTIONS = [
  { id: 'sine', label: 'Sinusoidal Pura', description: 'Tono fundamental puro sin armónicos' },
  { id: 'triangle', label: 'Triangular Suave', description: 'Armónicos impares tenues (ideal oído musical)' },
  { id: 'sawtooth', label: 'Diente de Sierra', description: 'Rico en armónicos (típico sintetizador)' },
  { id: 'square', label: 'Cuadrada / Pulso', description: 'Timbre hueco de armónicos impares marcados' }
] as const;

export const STANDARD_EQ_FREQUENCIES = [
  31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
];

export const REFERENCE_NOTES = [
  { note: 'C2', hz: 65.41 },
  { note: 'A2', hz: 110.00 },
  { note: 'C3', hz: 130.81 },
  { note: 'A3', hz: 220.00 },
  { note: 'C4', hz: 261.63 },
  { note: 'A4', hz: 440.00 },
  { note: 'C5', hz: 523.25 },
  { note: 'A5', hz: 880.00 },
  { note: 'C6', hz: 1046.50 },
  { note: 'A6', hz: 1760.00 },
  { note: 'C7', hz: 2093.00 },
  { note: 'A7', hz: 3520.00 }
];
