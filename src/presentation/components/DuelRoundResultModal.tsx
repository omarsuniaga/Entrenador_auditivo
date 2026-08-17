/**
 * Presentation Component: DuelRoundResultModal
 * Modal shown once every player has answered (or the round timed out). Reveals the
 * target, both players' metrics side by side, and who won the round. Only the host
 * gets the advance control — the rest see a waiting state, which keeps every device
 * entering the next round at the same moment.
 */

import React from 'react';
import { motion } from 'motion/react';
import { Trophy, ArrowRight, Hourglass } from 'lucide-react';
import { formatHertz, formatDeviationHz } from '../../shared/utils/audioMath';
import { useTheme } from '../context/ThemeContext';
import { useScrollLock } from '../hooks/useScrollLock';

interface DuelPlayer {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  currentRoundSubmission?: {
    userHz?: number;
    deviationHz?: number;
    accuracyPercentage?: number;
    responseTimeMs?: number;
    pointsEarned?: number;
    isRoundWinner?: boolean;
    guessedFullName?: string;
    isExactNoteMatch?: boolean;
    isCorrectPitchClass?: boolean;
  };
}

interface DuelRoundResultModalProps {
  isOpen: boolean;
  players: DuelPlayer[];
  playerId: string;
  gameMode: 'frequency' | 'notes';
  roundNumber: number;
  totalRounds: number;
  targetHz?: number;
  noteAnalysis?: { solfegeName: string; noteName: string; octave: number; theoreticalHz: number };
  isHost: boolean;
  isLastRound: boolean;
  onNextRound: () => void;
}

export const DuelRoundResultModal: React.FC<DuelRoundResultModalProps> = ({
  isOpen,
  players,
  playerId,
  gameMode,
  roundNumber,
  totalRounds,
  targetHz,
  noteAnalysis,
  isHost,
  isLastRound,
  onNextRound
}) => {
  const { isDark } = useTheme();
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const winner = players.find(p => p.currentRoundSubmission?.isRoundWinner);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-label={`Resultado de la ronda ${roundNumber}`}
        className={`w-full max-w-2xl my-auto rounded-3xl border border-cyan-500/40 p-6 sm:p-8 space-y-6 shadow-2xl font-mono ${
          isDark ? 'bg-[#0A0D14]' : 'bg-white'
        }`}
      >
        {/* Target reveal */}
        <div className="text-center space-y-2 pb-4 border-b border-slate-200 dark:border-white/10">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
            EVALUACIÓN // RONDA {roundNumber} DE {totalRounds}
          </span>
          <h3 className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {gameMode === 'notes' && noteAnalysis ? (
              <>
                NOTA OBJETIVO:{' '}
                <span className="text-cyan-600 dark:text-cyan-400">
                  {noteAnalysis.solfegeName}{noteAnalysis.octave} ({noteAnalysis.noteName}{noteAnalysis.octave})
                </span>
                <span className="block text-xs text-slate-400 font-normal mt-1">
                  Muestra real: {formatHertz(targetHz || 0)} • Ref. teórica: {formatHertz(noteAnalysis.theoreticalHz)}
                </span>
              </>
            ) : (
              <>
                FRECUENCIA OBJETIVO:{' '}
                <span className="text-cyan-600 dark:text-cyan-400">{formatHertz(targetHz || 0)}</span>
              </>
            )}
          </h3>

          {winner && (
            <div className="inline-flex items-center gap-2 mt-1 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
                Gana la ronda: {winner.name}{winner.id === playerId ? ' (TÚ)' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Side-by-side metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {players.map(p => {
            const sub = p.currentRoundSubmission;
            const isRoundWinner = sub?.isRoundWinner;
            const didNotAnswer = !sub;

            return (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border space-y-3 relative overflow-hidden ${
                  isRoundWinner
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-400/40'
                    : p.id === playerId
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : isDark
                    ? 'bg-black/60 border-white/10'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {isRoundWinner && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[9px] px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    <span>GANADOR</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.avatar || '🎧'}</span>
                    <span className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {p.name} {p.id === playerId && '(TÚ)'}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-500">+{sub?.pointsEarned || 0} pts</span>
                </div>

                <div
                  className={`text-xs space-y-1.5 p-3 rounded-xl border ${
                    isDark ? 'bg-black/40 text-slate-300 border-white/5' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {didNotAnswer ? (
                    <div className="text-center py-2 text-rose-500 font-bold">Sin respuesta en el tiempo</div>
                  ) : gameMode === 'notes' ? (
                    <>
                      <div className="flex justify-between">
                        <span>Nota elegida:</span>
                        <strong className={isDark ? 'text-white' : 'text-slate-900'}>{sub?.guessedFullName || '—'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Resultado:</span>
                        <strong
                          className={
                            sub?.isExactNoteMatch
                              ? 'text-emerald-500'
                              : sub?.isCorrectPitchClass
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }
                        >
                          {sub?.isExactNoteMatch
                            ? '¡Nota Exacta!'
                            : sub?.isCorrectPitchClass
                            ? 'Misma Nota (Otra Octava)'
                            : 'Incorrecta'}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Frecuencia elegida:</span>
                        <strong className={isDark ? 'text-white' : 'text-slate-900'}>{formatHertz(sub?.userHz || 0)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Desviación absoluta:</span>
                        <strong className={isRoundWinner ? 'text-amber-500' : 'text-purple-400'}>
                          {formatDeviationHz(sub?.deviationHz || 0)}
                        </strong>
                      </div>
                    </>
                  )}

                  {!didNotAnswer && (
                    <>
                      <div className="flex justify-between">
                        <span>Precisión:</span>
                        <strong className="text-emerald-500">{sub?.accuracyPercentage || 0}%</strong>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Tiempo de respuesta:</span>
                        <span>{((sub?.responseTimeMs || 0) / 1000).toFixed(2)}s</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-200 dark:border-white/10">
                    <span>Puntaje acumulado:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400">{p.score} pts</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Advance control — host only, so both devices re-sync on the next round */}
        <div className="flex justify-end pt-2">
          {isHost ? (
            <button
              id="duel-next-round-btn"
              onClick={onNextRound}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30 active:scale-95 transition-all cursor-pointer"
            >
              <span>{isLastRound ? 'VER RESULTADO FINAL' : 'SIGUIENTE RONDA DEL DUELO'}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Hourglass className="w-4 h-4 animate-pulse" />
              <span>Esperando al anfitrión…</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
