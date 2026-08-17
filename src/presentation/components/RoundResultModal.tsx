/**
 * Presentation Component: RoundResultModal
 * Modal that reveals the hidden target frequency, user guessed frequency,
 * exact percentage closeness, deviation in Hertz and cents, score points (+100/+50/0),
 * and dynamic difficulty adjustments.
 */

import React from 'react';
import { motion } from 'motion/react';
import { Award, ArrowRight, Sparkles, Volume2, Target } from 'lucide-react';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { DeviationAnalysis } from '../../core/services/DeviationCalculator';
import { formatHertz, formatDeviationHz, formatCents } from '../../shared/utils/audioMath';
import { useTheme } from '../context/ThemeContext';
import { useScrollLock } from '../hooks/useScrollLock';

interface RoundResultModalProps {
  isOpen: boolean;
  round: ExerciseRound | null;
  analysis: DeviationAnalysis | null;
  adaptiveMessage: string | null;
  isSessionFinished: boolean;
  onNextRound: () => void;
  onClose?: () => void;
  onPlayTargetAudio?: () => void;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen,
  round,
  analysis,
  adaptiveMessage,
  isSessionFinished,
  onNextRound,
  onClose,
  onPlayTargetAudio
}) => {
  const { isDark } = useTheme();
  const [isMinimized, setIsMinimized] = React.useState<boolean>(false);

  // Lock background scrolling while full modal is active and not minimized
  useScrollLock(isOpen && !isMinimized);

  // Reset minimization when a new round result opens
  React.useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen, round?.roundNumber]);

  // ESC key handler to advance/close
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) onClose();
        else onNextRound();
      } else if (e.key === 'Enter') {
        onNextRound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNextRound, onClose]);

  // Strict guard: only appear after user submitted their guess and data is fully computed
  if (!isOpen || !round || !analysis) return null;

  const accuracy = round.accuracyPercentage ?? analysis.accuracyPercentage;
  const tier = round.performanceTier;
  const scoreClass = analysis.scoreClassification;

  // Determine modal theme color
  let scoreColorClass = isDark ? 'text-emerald-400' : 'text-emerald-600';
  let badgeBg = isDark
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
  if (accuracy < 60) {
    scoreColorClass = isDark ? 'text-rose-400' : 'text-rose-600';
    badgeBg = isDark
      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      : 'bg-rose-100 border-rose-400 text-rose-950 font-bold';
  } else if (accuracy < 80) {
    scoreColorClass = isDark ? 'text-amber-400' : 'text-amber-600';
    badgeBg = isDark
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-amber-100 border-amber-400 text-amber-950 font-bold';
  } else if (accuracy < 92) {
    scoreColorClass = isDark ? 'text-cyan-400' : 'text-cyan-600';
    badgeBg = isDark
      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
      : 'bg-cyan-100 border-cyan-400 text-cyan-950 font-bold';
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (onClose) onClose();
      else onNextRound();
    }
  };

  // If minimized by the user, show a floating compact bar at the bottom
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
        <div className={`rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center space-x-4 border ${
          isDark
            ? 'bg-[#111622]/95 border-cyan-500/40 text-white shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
            : 'bg-white/95 border-slate-300 text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.2)]'
        }`}>
          <div className="flex items-center space-x-2 font-mono">
            <span className={`text-xl font-black ${scoreColorClass}`}>
              {accuracy}%
            </span>
            <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
              (Obj: {formatHertz(analysis.targetHz)} | Tu: {formatHertz(analysis.userHz)})
            </span>
          </div>

          <button
            onClick={() => setIsMinimized(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer border ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            Detalles
          </button>

          <button
            onClick={onNextRound}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs cursor-pointer shadow-md"
          >
            {isSessionFinished ? 'Ver Resumen' : 'Siguiente'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden relative my-auto font-mono transition-colors border ${
          isDark
            ? 'bg-[#111622] border-cyan-500/40 text-white shadow-[0_25px_80px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
            : 'bg-white border-slate-300 text-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.25)]'
        }`}
      >
        {/* Top Controls: Minimize and Close */}
        <div className="absolute top-3.5 right-3.5 z-20 flex items-center space-x-1.5">
          <button
            onClick={() => setIsMinimized(true)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border transition-all cursor-pointer shadow-md ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border-white/15' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Minimizar modal para ver panel de entrenamiento"
          >
            _
          </button>
          <button
            onClick={onClose || onNextRound}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border transition-all cursor-pointer shadow-md ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border-white/15' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Cerrar modal [ESC]"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* Header telemetry & circular score */}
          <div className={`p-5 sm:p-6 text-center relative border-b flex flex-col items-center ${
            isDark
              ? 'border-white/5 bg-gradient-to-b from-[#161c2c] to-[#111622]'
              : 'border-slate-200 bg-gradient-to-b from-slate-50 to-white'
          }`}>
            <div className={`inline-flex items-center space-x-2 px-3 py-0.5 rounded-full border text-[11px] font-semibold mb-3 ${
              isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}>
              <span>TELEMETRÍA // RONDA {round.roundNumber} FINALIZADA</span>
            </div>

            {/* Circular Score Badge with Glowing Ring */}
            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex items-center justify-center mb-2 relative shadow-md ${
              isDark
                ? 'border-cyan-500/20 bg-black/50 shadow-[0_0_25px_rgba(6,182,212,0.25)]'
                : 'border-cyan-400 bg-cyan-50/50 shadow-sm'
            }`}>
              <div className="absolute inset-0 border-4 border-cyan-400 border-r-transparent rounded-full animate-spin" />
              <div className="flex flex-col items-center justify-center">
                <span className={`text-3xl sm:text-4xl font-black tracking-tight ${scoreColorClass}`}>
                  {accuracy}%
                </span>
                <span className={`text-[9px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  PRECISIÓN
                </span>
              </div>
            </div>

            {/* Performance Tier & Score Points Badge */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <div className={`inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full border text-xs font-bold ${badgeBg}`}>
                <Award className="w-3.5 h-3.5" />
                <span>{tier.title}</span>
              </div>

              <div className={`inline-flex items-center space-x-1 px-3 py-0.5 rounded-full border text-xs font-bold ${
                isDark ? scoreClass.badgeColor : 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
              }`}>
                <Target className="w-3.5 h-3.5" />
                <span>{scoreClass.label} (+{scoreClass.points} PTS)</span>
              </div>
            </div>
          </div>

          {/* Comparison Body: Target Hz vs User Hz */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Target Frequency Card */}
              <div className={`rounded-2xl p-3 sm:p-4 border ${
                isDark ? 'bg-[#0A0D14] border-cyan-500/30 shadow-inner' : 'bg-cyan-50/70 border-cyan-300 shadow-sm'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 block mb-0.5">
                  OBJETIVO REAL (HZ)
                </span>
                <span className={`text-xl sm:text-2xl font-black block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatHertz(analysis.targetHz)}
                </span>
                <span className={`text-[10px] sm:text-[11px] mt-0.5 block truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {round.targetFrequency.band.nameEs}
                </span>
              </div>

              {/* User Frequency Card */}
              <div className={`rounded-2xl p-3 sm:p-4 border ${
                isDark ? 'bg-[#0A0D14] border-purple-500/30 shadow-inner' : 'bg-purple-50/70 border-purple-300 shadow-sm'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-0.5">
                  TU SELECCIÓN (HZ)
                </span>
                <span className={`text-xl sm:text-2xl font-black block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatHertz(analysis.userHz)}
                </span>
                <span className={`text-[10px] sm:text-[11px] mt-0.5 block truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Posición sintonizada
                </span>
              </div>
            </div>

            {/* Exact Deviation Breakdown */}
            <div className={`rounded-2xl p-3 sm:p-4 border space-y-2 text-xs ${
              isDark ? 'bg-[#0A0D14] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className={`flex justify-between items-center pb-2 border-b ${
                isDark ? 'border-white/5' : 'border-slate-200'
              }`}>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>DESVIACIÓN EN HERTZ:</span>
                <span className={`font-bold text-sm ${analysis.absDeviationHz <= 3 ? 'text-emerald-500 font-black' : isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {formatDeviationHz(analysis.deviationHz)}
                </span>
              </div>

              <div className={`flex justify-between items-center pb-2 border-b ${
                isDark ? 'border-white/5' : 'border-slate-200'
              }`}>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>DESVIACIÓN EN CENTS:</span>
                <span className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {formatCents(analysis.deviationCents)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>DIRECCIÓN TONAL:</span>
                <span className={`font-semibold text-[11px] sm:text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  {analysis.direction === 'exact' ? '🎯 Unísono Exacto' : analysis.direction === 'sharp' ? '📈 Por encima (Agudo)' : '📉 Por debajo (Grave)'}
                  {' '}({analysis.musicalIntervalDescription})
                </span>
              </div>
            </div>

            {/* Dynamic Adaptive Difficulty Feedback (if triggered) */}
            {adaptiveMessage && (
              <div className={`flex items-start space-x-2.5 p-3 rounded-2xl border text-xs ${
                isDark ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200' : 'bg-cyan-50 border-cyan-300 text-cyan-900'
              }`}>
                <Sparkles className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-[11px]">CALIBRACIÓN ADAPTATIVA AUTOMÁTICA:</span>
                  <span className="text-[11px]">{adaptiveMessage}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer - Always visible and accessible */}
        <div className={`p-3.5 sm:p-4 border-t flex items-center space-x-3 shrink-0 ${
          isDark ? 'bg-[#0c101a] border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            onClick={onClose || onNextRound}
            type="button"
            className={`px-4 py-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10' : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            Cerrar [ESC]
          </button>

          <button
            id="modal-next-round-btn"
            type="button"
            onClick={onNextRound}
            className="flex-1 flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs sm:text-sm shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-95"
          >
            <span>{isSessionFinished ? 'VER INFORME COMPLETO' : 'SIGUIENTE RONDA'} [ENTER]</span>
            <ArrowRight className="w-4 h-4 text-black stroke-[3]" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
