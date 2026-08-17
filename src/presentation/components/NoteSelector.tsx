/**
 * Presentation Component: NoteSelector
 * Interactive Chromatic & Diatonic Musical Note Selector.
 * Features:
 * - Piano-inspired pitch pad with Solfège (Do, Re, Mi...) & Anglo-Saxon (C, D, E...)
 * - Enharmonic notation support (# and ♭)
 * - Octave picker (Octaves 2 to 6)
 * - Pure reference pitch audio test button
 * - Pythagorean comma & tuning system indicator
 */

import React from 'react';
import { Volume2, Sparkles, HelpCircle, Music } from 'lucide-react';
import {
  CHROMATIC_NOTES,
  DIATONIC_NOTES,
  NoteInfo,
  TuningSystem,
  NoteScaleType,
  MusicalNoteCalculator,
  PYTHAGOREAN_COMMA_INFO
} from '../../core/entities/MusicalNote';
import { useTheme } from '../context/ThemeContext';
import { useAudioProfile } from '../context/AudioProfileContext';

interface NoteSelectorProps {
  selectedNoteIndex: number;
  selectedOctave: number;
  onSelectNote: (noteIndex: number) => void;
  onSelectOctave: (octave: number) => void;
  scaleType?: NoteScaleType;
  tuningSystem?: TuningSystem;
  a4Reference?: number;
  onPlayReferenceTone?: (noteIndex: number, octave: number) => void;
  isPlayingReference?: boolean;
  disabled?: boolean;
  showEnharmonics?: boolean;
}

export const NoteSelector: React.FC<NoteSelectorProps> = ({
  selectedNoteIndex,
  selectedOctave,
  onSelectNote,
  onSelectOctave,
  scaleType = 'chromatic',
  tuningSystem = '12tet',
  a4Reference = 440,
  onPlayReferenceTone,
  isPlayingReference = false,
  disabled = false,
  showEnharmonics = true
}) => {
  const { isDark } = useTheme();
  const { isMobileSpeakerMode } = useAudioProfile();
  const availableNotes = scaleType === 'diatonic' ? DIATONIC_NOTES : CHROMATIC_NOTES;


  const currentNoteInfo = CHROMATIC_NOTES[selectedNoteIndex] || CHROMATIC_NOTES[0];
  
  // Calculate theoretical Hz for current selection
  const currentTheoreticalHz = React.useMemo(() => {
    if (tuningSystem === 'pythagorean') {
      return MusicalNoteCalculator.getPythagoreanHertz(selectedNoteIndex, selectedOctave, false, a4Reference);
    } else if (tuningSystem === 'just') {
      return MusicalNoteCalculator.getJustHertz(selectedNoteIndex, selectedOctave, a4Reference);
    } else {
      const midi = (selectedOctave + 1) * 12 + selectedNoteIndex;
      return Math.round(MusicalNoteCalculator.get12TETHertz(midi, a4Reference) * 100) / 100;
    }
  }, [selectedNoteIndex, selectedOctave, tuningSystem, a4Reference]);

  return (
    <div id="note-selector-root" className="space-y-4">
      {/* Octave selector tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
          Seleccionar Octava:
        </span>
        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
          {[2, 3, 4, 5, 6].map(oct => {
            const isSelected = selectedOctave === oct;
            const isSubBassOnMobile = isMobileSpeakerMode && oct === 2;
            return (
              <button
                key={oct}
                type="button"
                id={`octave-btn-${oct}`}
                disabled={disabled}
                onClick={() => onSelectOctave(oct)}
                title={isSubBassOnMobile ? 'Octava 2 (65-123 Hz): Se recomienda usar auriculares en móvil' : `Octava ${oct}`}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black scale-105'
                    : isSubBassOnMobile
                      ? 'text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10'
                      : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-300/50 dark:hover:bg-slate-800/60'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>Oct {oct}</span>
                {isSubBassOnMobile && <span className="text-[10px] opacity-75">🎧</span>}
              </button>
            );
          })}
        </div>
      </div>


      {/* Note selection pads: Layout designed for intuitive pitch recognition */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {availableNotes.map(note => {
          const isSelected = selectedNoteIndex === note.index;
          const isAccidental = note.isAccidental;

          return (
            <button
              key={note.index}
              type="button"
              id={`note-pad-${note.name}`}
              disabled={disabled}
              onClick={() => onSelectNote(note.index)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-cyan-500 to-cyan-600 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-[1.03] z-10'
                  : isAccidental
                  ? 'bg-slate-800/90 dark:bg-slate-950 text-slate-200 border-slate-700 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800'
                  : 'bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-800 hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Note Solfège */}
              <span className={`text-base font-black tracking-tight ${isSelected ? 'text-slate-950 font-extrabold' : ''}`}>
                {note.solfege}
              </span>

              {/* Note Anglo-Saxon Name + Octave */}
              <div className="flex items-center space-x-1 mt-0.5">
                <span className={`text-xs font-mono font-bold ${
                  isSelected
                    ? 'text-slate-900'
                    : isAccidental
                    ? 'text-amber-400 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {note.name}{selectedOctave}
                </span>
              </div>

              {/* Enharmonic alternative */}
              {showEnharmonics && note.enharmonicSolfege && (
                <span className={`text-[10px] font-mono mt-0.5 ${
                  isSelected ? 'text-slate-900 font-semibold' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  ({note.enharmonicSolfege})
                </span>
              )}

              {/* Active selection dot */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Note Summary & Reference Tone Audio Playback */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {currentNoteInfo.solfege}{selectedOctave} ({currentNoteInfo.name}{selectedOctave})
              </span>
              <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {currentTheoreticalHz.toFixed(2)} Hz
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sistema: {tuningSystem === 'pythagorean' ? 'Afinación Pitagórica (3:2)' : tuningSystem === 'just' ? 'Afinación Justa (Ptolemaica)' : '12-TET (Temperamento Igual)'} • A4 = {a4Reference} Hz
            </p>
          </div>
        </div>

        {/* Audio Reference button */}
        {onPlayReferenceTone && (
          <button
            type="button"
            id="play-reference-tone-btn"
            disabled={disabled || isPlayingReference}
            onClick={() => onPlayReferenceTone(selectedNoteIndex, selectedOctave)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isPlayingReference
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 active:scale-95'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Volume2 className={`w-4 h-4 ${isPlayingReference ? 'animate-bounce' : ''}`} />
            <span>{isPlayingReference ? 'Reproduciendo...' : 'Escuchar Nota Pura'}</span>
          </button>
        )}
      </div>

      {/* Pythagorean Comma Notice if applicable */}
      {tuningSystem === 'pythagorean' && currentNoteInfo.isAccidental && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2">
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="space-y-0.5">
            <span className="font-bold block">Efecto de Coma Pitagórica (23.46 cents / 4.76 Hz gap)</span>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/80">
              En afinación pitagórica, los enarmónicos ({currentNoteInfo.name} frente a {currentNoteInfo.enharmonicName}) no tienen la misma frecuencia debido al residuo armónico del círculo de quintas puras.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
