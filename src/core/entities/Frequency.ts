/**
 * Domain Entity: Frequency
 * Represents an acoustic frequency with musical, perceptual, and band metadata.
 */

export type FrequencyBand = 
  | 'sub_bass'     // 20Hz - 60Hz
  | 'bass'         // 60Hz - 250Hz
  | 'low_mid'      // 250Hz - 500Hz
  | 'mid'          // 500Hz - 2000Hz
  | 'high_mid'     // 2000Hz - 4000Hz
  | 'presence'     // 4000Hz - 6000Hz
  | 'brilliance';  // 6000Hz - 20000Hz

export interface FrequencyBandInfo {
  id: FrequencyBand;
  name: string;
  nameEs: string;
  minHz: number;
  maxHz: number;
  description: string;
  color: string;
}

export const FREQUENCY_BANDS: FrequencyBandInfo[] = [
  {
    id: 'sub_bass',
    name: 'Sub-Bass',
    nameEs: 'Sub-Graves',
    minHz: 20,
    maxHz: 60,
    description: 'Frecuencias sentidas más que escuchadas (bombos profundos, sub-synths).',
    color: '#6366f1' // Indigo
  },
  {
    id: 'bass',
    name: 'Bass',
    nameEs: 'Graves',
    minHz: 60,
    maxHz: 250,
    description: 'Cuerpo y calidez de bajos, toms y fundamentales de instrumentos graves.',
    color: '#3b82f6' // Blue
  },
  {
    id: 'low_mid',
    name: 'Low-Mid',
    nameEs: 'Medios-Bajos',
    minHz: 250,
    maxHz: 500,
    description: 'Zona de resonancia y grosor armónico (guitarras, voces masculinas).',
    color: '#06b6d4' // Cyan
  },
  {
    id: 'mid',
    name: 'Midrange',
    nameEs: 'Medios',
    minHz: 500,
    maxHz: 2000,
    description: 'Claridad vocal, cajas de batería y presencia principal de instrumentos.',
    color: '#10b981' // Emerald
  },
  {
    id: 'high_mid',
    name: 'High-Mid',
    nameEs: 'Medios-Altos',
    minHz: 2000,
    maxHz: 4000,
    description: 'Ataque de percusión, inteligibilidad vocal y mordida de guitarras.',
    color: '#f59e0b' // Amber
  },
  {
    id: 'presence',
    name: 'Presence',
    nameEs: 'Presencia',
    minHz: 4000,
    maxHz: 6000,
    description: 'Definición de voz e instrumentos acústicos, cercanía sonora.',
    color: '#f97316' // Orange
  },
  {
    id: 'brilliance',
    name: 'Brilliance / Air',
    nameEs: 'Brillo y Aire',
    minHz: 6000,
    maxHz: 20000,
    description: 'Detalle de platillos, brillo de reverberación y sensación de aire.',
    color: '#ec4899' // Pink
  }
];

export class Frequency {
  private readonly _hz: number;

  constructor(hz: number) {
    if (hz < 20 || hz > 20000) {
      // Clamp to audible range
      this._hz = Math.max(20, Math.min(20000, Math.round(hz * 100) / 100));
    } else {
      this._hz = Math.round(hz * 100) / 100;
    }
  }

  get hz(): number {
    return this._hz;
  }

  get band(): FrequencyBandInfo {
    const found = FREQUENCY_BANDS.find(b => this._hz >= b.minHz && this._hz < b.maxHz);
    return found || FREQUENCY_BANDS[FREQUENCY_BANDS.length - 1];
  }

  /**
   * Convert frequency in Hz to nearest musical note (e.g. A4, C5)
   */
  get musicalNote(): { note: string; octave: number; centOffset: number; noteWithOctave: string } {
    // A4 = 440 Hz (MIDI 69)
    const semitonesFromA4 = 12 * Math.log2(this._hz / 440);
    const midiNumber = Math.round(69 + semitonesFromA4);
    const exactMidi = 69 + semitonesFromA4;
    const centOffset = Math.round((exactMidi - midiNumber) * 100);

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = ((midiNumber % 12) + 12) % 12;
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = noteNames[noteIndex];

    return {
      note,
      octave,
      centOffset,
      noteWithOctave: `${note}${octave}`
    };
  }

  /**
   * Formatted string e.g. "440 Hz" or "2.5 kHz"
   */
  format(): string {
    if (this._hz >= 1000) {
      const khz = this._hz / 1000;
      return `${khz.toFixed(khz < 10 ? 2 : 1)} kHz`;
    }
    return `${Math.round(this._hz)} Hz`;
  }
}
