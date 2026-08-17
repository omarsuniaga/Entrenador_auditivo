/**
 * Utility: Audio & Frequency Math
 * Logarithmic mapping for human perception of frequencies (Weber-Fechner scale).
 */

export function hzToLogSliderValue(hz: number, minHz: number = 20, maxHz: number = 20000): number {
  const minLog = Math.log10(Math.max(1, minHz));
  const maxLog = Math.log10(maxHz);
  const currentLog = Math.log10(Math.max(minHz, Math.min(maxHz, hz)));
  return (currentLog - minLog) / (maxLog - minLog);
}

export function logSliderValueToHz(val: number, minHz: number = 20, maxHz: number = 20000): number {
  const clamped = Math.max(0, Math.min(1, val));
  const minLog = Math.log10(Math.max(1, minHz));
  const maxLog = Math.log10(maxHz);
  const logVal = minLog + clamped * (maxLog - minLog);
  const hz = Math.pow(10, logVal);

  if (hz < 100) return Math.round(hz * 10) / 10;
  if (hz < 1000) return Math.round(hz);
  if (hz < 10000) return Math.round(hz);
  return Math.round(hz / 10) * 10;
}

export function formatHertz(hz: number): string {
  if (isNaN(hz) || hz <= 0) return '0 Hz';
  if (hz >= 1000) {
    const khz = hz / 1000;
    return `${khz < 10 ? khz.toFixed(2) : khz.toFixed(1)} kHz`;
  }
  return `${Math.round(hz * 10) / 10} Hz`;
}

export function formatDeviationHz(devHz: number): string {
  const sign = devHz > 0 ? '+' : '';
  if (Math.abs(devHz) >= 1000) {
    return `${sign}${(devHz / 1000).toFixed(2)} kHz`;
  }
  return `${sign}${devHz.toFixed(1)} Hz`;
}

export function formatCents(cents: number): string {
  const sign = cents > 0 ? '+' : '';
  return `${sign}${cents.toFixed(1)} cents`;
}
