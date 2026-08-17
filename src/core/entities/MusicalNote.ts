/**
 * Domain Entity: MusicalNote
 * Encapsulates musical pitch theory, temperament systems (12-TET, Pythagorean Tuning, Just Intonation),
 * comma mathematics (Pythagorean comma, Syntonic comma), and sample frequency approximations.
 */

export type TuningSystem = '12tet' | 'pythagorean' | 'just';
export type NoteScaleType = 'chromatic' | 'diatonic';

export interface NoteInfo {
  index: number;          // 0 to 11 (C = 0, C# = 1, etc.)
  name: string;           // 'C', 'C#', 'D', 'Eb', etc.
  solfege: string;        // 'Do', 'Do#', 'Re', 'Mi♭', etc.
  isAccidental: boolean;  // True for chromatic alterations (# / b)
  enharmonicName?: string;// 'Db' for 'C#', 'Bb' for 'A#', etc.
  enharmonicSolfege?: string; // 'Re♭', 'Si♭', etc.
}

export const CHROMATIC_NOTES: NoteInfo[] = [
  { index: 0,  name: 'C',  solfege: 'Do',   isAccidental: false },
  { index: 1,  name: 'C#', solfege: 'Do#',  isAccidental: true,  enharmonicName: 'Db', enharmonicSolfege: 'Re♭' },
  { index: 2,  name: 'D',  solfege: 'Re',   isAccidental: false },
  { index: 3,  name: 'D#', solfege: 'Re#',  isAccidental: true,  enharmonicName: 'Eb', enharmonicSolfege: 'Mi♭' },
  { index: 4,  name: 'E',  solfege: 'Mi',   isAccidental: false },
  { index: 5,  name: 'F',  solfege: 'Fa',   isAccidental: false },
  { index: 6,  name: 'F#', solfege: 'Fa#',  isAccidental: true,  enharmonicName: 'Gb', enharmonicSolfege: 'Sol♭' },
  { index: 7,  name: 'G',  solfege: 'Sol',  isAccidental: false },
  { index: 8,  name: 'G#', solfege: 'Sol#', isAccidental: true,  enharmonicName: 'Ab', enharmonicSolfege: 'La♭' },
  { index: 9,  name: 'A',  solfege: 'La',   isAccidental: false },
  { index: 10, name: 'A#', solfege: 'La#',  isAccidental: true,  enharmonicName: 'Bb', enharmonicSolfege: 'Si♭' },
  { index: 11, name: 'B',  solfege: 'Si',   isAccidental: false }
];

export const DIATONIC_NOTES: NoteInfo[] = CHROMATIC_NOTES.filter(n => !n.isAccidental);

export interface PythagoreanCommaInfo {
  cents: number;        // ~23.46 cents
  ratioStr: string;     // '531441:524288'
  description: string;
  exampleHzGap: number; // 4.76 Hz at A#4 vs Bb4
}

export const PYTHAGOREAN_COMMA_INFO: PythagoreanCommaInfo = {
  cents: 23.46,
  ratioStr: '531441 : 524288',
  description: 'Diferencia acumulada al dar la vuelta al círculo de 12 quintas puras (3:2)¹² frente a 7 octavas perfectas (2:1)⁷.',
  exampleHzGap: 4.76
};

export const SYNTONIC_COMMA_INFO = {
  cents: 21.51,
  ratioStr: '81 : 80',
  description: 'Diferencia entre 4 quintas pitagóricas y una tercera mayor pura (5:4).'
};

export interface NoteApproximationAnalysis {
  sampleHz: number;
  closestNote: {
    note: string;
    solfege: string;
    octave: number;
    fullName: string;          // e.g. "A4" or "La4"
    fullSolfege: string;       // e.g. "La₄"
    isAccidental: boolean;
    midiNumber: number;
    enharmonicName?: string;
  };
  theoreticalHz: number;       // Exact standard pitch (e.g. 440.00 Hz)
  deviationHz: number;         // sampleHz - theoreticalHz
  deviationCents: number;      // In musical cents
  direction: 'exact' | 'sharp' | 'flat';
  isExactNote: boolean;        // True if within microtonal proximity threshold
  tuningSystem: TuningSystem;
  pythagoreanEnharmonics?: {
    sharpNote: { name: string; hz: number };
    flatNote: { name: string; hz: number };
    commaGapHz: number;
    commaCents: number;
  };
  acousticExplanation: string;
}

export class MusicalNoteCalculator {
  /**
   * Calculate exact frequency for a MIDI note in 12-TET
   * f = A4 * 2^((midi - 69) / 12)
   */
  static get12TETHertz(midiNumber: number, a4Reference: number = 440): number {
    return a4Reference * Math.pow(2, (midiNumber - 69) / 12);
  }

  /**
   * Calculate frequency in Pythagorean tuning based on stacked 3:2 fifths from A4
   */
  static getPythagoreanHertz(noteIndex: number, octave: number, isFlatVariant: boolean = false, a4Reference: number = 440): number {
    // Pythagorean fifths offsets from D4 (or A4)
    // Fifths from A: D(-1), G(-2), C(-3), F(-4), Bb(-5), Eb(-6), E(+1), B(+2), F#(+3), C#(+4), G#(+5), D#(+6), A#(+7)
    const fifthsFromA: Record<number, number> = {
      9: 0,   // A
      4: 1,   // E
      11: 2,  // B
      6: 3,   // F#
      1: 4,   // C#
      8: 5,   // G#
      3: 6,   // D#
      10: isFlatVariant ? -5 : 7, // A# (+7) vs Bb (-5) -> Difference is the Pythagorean comma!
      2: -1,  // D
      7: -2,  // G
      0: -3,  // C
      5: -4   // F
    };

    const fifths = fifthsFromA[noteIndex] ?? 0;
    // Frequency ratio = (3/2)^fifths, then normalized to octave 4
    let ratio = Math.pow(1.5, fifths);
    while (ratio >= 2) ratio /= 2;
    while (ratio < 1) ratio *= 2;

    const baseA4 = a4Reference;
    const a4NoteHz = baseA4 * ratio;
    // Shift by octave relative to octave 4
    const octaveMultiplier = Math.pow(2, octave - 4);
    return Math.round(a4NoteHz * octaveMultiplier * 100) / 100;
  }

  /**
   * Calculate frequency in Just Intonation (A4 = 440 Hz standard Ptolemaic diatonic scale)
   */
  static getJustHertz(noteIndex: number, octave: number, a4Reference: number = 440): number {
    // Ratios from C: C(1/1), C#(16/15), D(9/8), D#(6/5), E(5/4), F(4/3), F#(45/32), G(3/2), G#(8/5), A(5/3), A#(9/5), B(15/8)
    const ratiosFromC = [
      1,          // C (1/1)
      16 / 15,    // C# (16/15)
      9 / 8,      // D (9/8)
      6 / 5,      // D# (6/5)
      5 / 4,      // E (5/4)
      4 / 3,      // F (4/3)
      45 / 32,    // F# (45/32)
      3 / 2,      // G (3/2)
      8 / 5,      // G# (8/5)
      5 / 3,      // A (5/3)
      9 / 5,      // A# (9/5)
      15 / 8      // B (15/8)
    ];

    const c4Hz = (a4Reference / (5 / 3)); // C4 based on A4 = 440
    const ratio = ratiosFromC[noteIndex] ?? 1;
    const noteHz = c4Hz * ratio * Math.pow(2, octave - 4);
    return Math.round(noteHz * 100) / 100;
  }

  /**
   * Approximates any sample frequency (e.g. 450 Hz) to the nearest musical note
   * and calculates the microtonal, comma, and cent deviations.
   */
  static analyzeSamplePitch(
    sampleHz: number,
    tuningSystem: TuningSystem = '12tet',
    a4Reference: number = 440
  ): NoteApproximationAnalysis {
    // Standard semitones from A4
    const semitonesFromA4 = 12 * Math.log2(sampleHz / a4Reference);
    const exactMidi = 69 + semitonesFromA4;
    const midiNumber = Math.round(exactMidi);
    
    // Note details
    const noteIndex = ((midiNumber % 12) + 12) % 12;
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteInfo = CHROMATIC_NOTES[noteIndex];

    let theoreticalHz = 0;
    if (tuningSystem === 'pythagorean') {
      theoreticalHz = this.getPythagoreanHertz(noteIndex, octave, false, a4Reference);
    } else if (tuningSystem === 'just') {
      theoreticalHz = this.getJustHertz(noteIndex, octave, a4Reference);
    } else {
      theoreticalHz = this.get12TETHertz(midiNumber, a4Reference);
    }

    const deviationHz = Math.round((sampleHz - theoreticalHz) * 100) / 100;
    const deviationCents = Math.round((1200 * Math.log2(sampleHz / theoreticalHz)) * 10) / 10;
    
    let direction: 'exact' | 'sharp' | 'flat' = 'exact';
    if (deviationCents > 1.5) direction = 'sharp';
    else if (deviationCents < -1.5) direction = 'flat';

    // Pythagorean enharmonic comparison if near A#/Bb (or other accidentals)
    let pythagoreanEnharmonics: NoteApproximationAnalysis['pythagoreanEnharmonics'] | undefined = undefined;
    if (noteIndex === 10) { // A# / Bb
      const sharpHz = this.getPythagoreanHertz(10, octave, false, a4Reference); // A#
      const flatHz = this.getPythagoreanHertz(10, octave, true, a4Reference);   // Bb
      const gapHz = Math.round(Math.abs(flatHz - sharpHz) * 100) / 100;
      pythagoreanEnharmonics = {
        sharpNote: { name: `A#${octave} (La#${octave})`, hz: sharpHz },
        flatNote: { name: `Bb${octave} (Si♭${octave})`, hz: flatHz },
        commaGapHz: gapHz,
        commaCents: 23.46
      };
    }

    // Acoustic explanation
    let acousticExplanation = `Muestra en ${sampleHz} Hz aproximada a ${noteInfo.name}${octave} (${noteInfo.solfege}${octave} - ${theoreticalHz.toFixed(1)} Hz). `;
    if (Math.abs(deviationCents) <= 3) {
      acousticExplanation += 'Afinación prácticamente exacta (error < 3 cents).';
    } else if (direction === 'sharp') {
      acousticExplanation += `Tono ligeramente alto (+${deviationCents.toFixed(1)} cents / +${deviationHz.toFixed(1)} Hz respecto a la frecuencia teórica).`;
    } else {
      acousticExplanation += `Tono ligeramente bajo (${deviationCents.toFixed(1)} cents / ${deviationHz.toFixed(1)} Hz respecto a la frecuencia teórica).`;
    }

    if (pythagoreanEnharmonics && tuningSystem === 'pythagorean') {
      acousticExplanation += ` Brecha de Coma Pitagórica detectada (${pythagoreanEnharmonics.commaGapHz} Hz entre enarmónicos).`;
    }

    return {
      sampleHz,
      closestNote: {
        note: noteInfo.name,
        solfege: noteInfo.solfege,
        octave,
        fullName: `${noteInfo.name}${octave}`,
        fullSolfege: `${noteInfo.solfege}${octave}`,
        isAccidental: noteInfo.isAccidental,
        midiNumber,
        enharmonicName: noteInfo.enharmonicName ? `${noteInfo.enharmonicName}${octave}` : undefined
      },
      theoreticalHz: Math.round(theoreticalHz * 100) / 100,
      deviationHz,
      deviationCents,
      direction,
      isExactNote: Math.abs(deviationCents) <= 45, // Within same half-semitone window
      tuningSystem,
      pythagoreanEnharmonics,
      acousticExplanation
    };
  }

  /**
   * Generates a random sample frequency for ear training.
   * Can generate exact notes or microtonally detuned / comma-offset frequencies
   * (e.g. 450 Hz for A4, 469.86 Hz for A#4, 474.62 Hz for Bb4).
   */
  static generateTrainingPitch(options: {
    scaleType?: NoteScaleType;
    minOctave?: number;
    maxOctave?: number;
    tuningSystem?: TuningSystem;
    allowMicrotonalDetuning?: boolean;
    a4Reference?: number;
  } = {}): {
    targetHz: number;
    theoreticalHz: number;
    noteName: string;
    solfege: string;
    octave: number;
    analysis: NoteApproximationAnalysis;
  } {
    const {
      scaleType = 'chromatic',
      minOctave = 3,
      maxOctave = 5,
      tuningSystem = '12tet',
      allowMicrotonalDetuning = true,
      a4Reference = 440
    } = options;

    const availableNotes = scaleType === 'diatonic' ? DIATONIC_NOTES : CHROMATIC_NOTES;
    const randomNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];
    const octave = Math.floor(Math.random() * (maxOctave - minOctave + 1)) + minOctave;
    const midiNumber = (octave + 1) * 12 + randomNote.index;

    let theoreticalHz = 0;
    if (tuningSystem === 'pythagorean') {
      const isFlat = randomNote.isAccidental && Math.random() > 0.5;
      theoreticalHz = this.getPythagoreanHertz(randomNote.index, octave, isFlat, a4Reference);
    } else if (tuningSystem === 'just') {
      theoreticalHz = this.getJustHertz(randomNote.index, octave, a4Reference);
    } else {
      theoreticalHz = this.get12TETHertz(midiNumber, a4Reference);
    }

    let targetHz = theoreticalHz;
    if (allowMicrotonalDetuning) {
      // Apply slight realistic acoustic detuning between -35 and +35 cents (or comma shifts)
      const centsShift = (Math.random() * 70) - 35;
      targetHz = theoreticalHz * Math.pow(2, centsShift / 1200);
      targetHz = Math.round(targetHz * 10) / 10;
    }

    const analysis = this.analyzeSamplePitch(targetHz, tuningSystem, a4Reference);

    return {
      targetHz,
      theoreticalHz,
      noteName: `${randomNote.name}${octave}`,
      solfege: `${randomNote.solfege}${octave}`,
      octave,
      analysis
    };
  }

  /**
   * Evaluate a user's guessed note against the target sample pitch
   */
  static evaluateGuess(
    targetSampleHz: number,
    guessedNoteIndex: number,
    guessedOctave: number,
    responseTimeMs: number,
    tuningSystem: TuningSystem = '12tet',
    a4Reference: number = 440
  ): {
    isExactNoteMatch: boolean;
    isOctaveMatch: boolean;
    isCorrectPitchClass: boolean;
    scorePoints: number;
    accuracyPercentage: number;
    analysis: NoteApproximationAnalysis;
    feedbackMessage: string;
  } {
    const analysis = this.analyzeSamplePitch(targetSampleHz, tuningSystem, a4Reference);
    const targetNoteIndex = CHROMATIC_NOTES.findIndex(n => n.name === analysis.closestNote.note);
    const isCorrectPitchClass = targetNoteIndex === guessedNoteIndex;
    const isOctaveMatch = analysis.closestNote.octave === guessedOctave;
    const isExactNoteMatch = isCorrectPitchClass && isOctaveMatch;

    // Distance in semitones on pitch wheel
    let semitoneDist = Math.abs(guessedNoteIndex - targetNoteIndex);
    if (semitoneDist > 6) semitoneDist = 12 - semitoneDist;

    let accuracyPercentage = 0;
    let scorePoints = 0;

    if (isExactNoteMatch) {
      // Direct hit!
      accuracyPercentage = 100;
      scorePoints = 1000;
      // Speed bonus
      const speedBonus = Math.max(0, Math.round(250 * (1 - responseTimeMs / 10000)));
      scorePoints += speedBonus;
    } else if (isCorrectPitchClass) {
      // Right note class, different octave
      accuracyPercentage = 75;
      scorePoints = 650;
    } else if (semitoneDist === 1) {
      // 1 semitone off (neighboring accidental or natural)
      accuracyPercentage = 50;
      scorePoints = 400;
    } else if (semitoneDist === 2) {
      accuracyPercentage = 25;
      scorePoints = 150;
    } else {
      accuracyPercentage = 0;
      scorePoints = 0;
    }

    let feedbackMessage = '';
    const guessedInfo = CHROMATIC_NOTES[guessedNoteIndex];
    const guessedFullName = `${guessedInfo.name}${guessedOctave} (${guessedInfo.solfege}${guessedOctave})`;
    const targetFullName = `${analysis.closestNote.fullName} (${analysis.closestNote.fullSolfege})`;

    if (isExactNoteMatch) {
      feedbackMessage = `¡Identificación perfecta! La muestra de ${targetSampleHz} Hz corresponde a ${targetFullName}.`;
    } else if (isCorrectPitchClass) {
      feedbackMessage = `¡Nota correcta (${guessedInfo.solfege}), pero octava diferente! La muestra correspondía a la octava ${analysis.closestNote.octave}.`;
    } else if (semitoneDist === 1) {
      feedbackMessage = `¡Casi! Seleccionaste ${guessedFullName}, a solo 1 semitono de ${targetFullName}.`;
    } else {
      feedbackMessage = `Seleccionaste ${guessedFullName}. La frecuencia de ${targetSampleHz} Hz aproxima a ${targetFullName}.`;
    }

    return {
      isExactNoteMatch,
      isOctaveMatch,
      isCorrectPitchClass,
      scorePoints,
      accuracyPercentage,
      analysis,
      feedbackMessage
    };
  }
}
