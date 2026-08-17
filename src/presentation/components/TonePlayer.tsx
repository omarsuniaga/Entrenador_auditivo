/**
 * Presentation Component: TonePlayer (Frecuencia Secreta & Retención en Silencio)
 * Displays the secret target frequency stage with spectrum visualizer and
 * an integrated retention wait countdown overlay that animates to 0s.
 */

import React, { useEffect, useRef } from 'react';
import { Play, Volume2, RotateCcw, Hourglass, Radio, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TrainingPhase } from '../hooks/useTrainingEngine';
import { useTheme } from '../context/ThemeContext';

interface TonePlayerProps {
  isPlaying: boolean;
  onPlayTarget: () => void;
  targetPlayCount: number;
  disabled?: boolean;
  visualizerData?: Uint8Array | null;
  roundNumber: number;
  totalRounds: number;
  trainingPhase?: TrainingPhase;
  sampleRemainingSec?: number;
  retentionRemainingSec?: number;
  sampleTotalSec?: number;
  retentionTotalSec?: number;
}

export const TonePlayer: React.FC<TonePlayerProps> = ({
  isPlaying,
  onPlayTarget,
  targetPlayCount,
  disabled = false,
  visualizerData,
  roundNumber,
  totalRounds,
  trainingPhase = 'SAMPLE_PLAYING',
  sampleRemainingSec = 0,
  retentionRemainingSec = 0,
  sampleTotalSec = 4,
  retentionTotalSec = 5
}) => {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isRetentionPhase = trainingPhase === 'RETENTION_WAIT';
  const isSamplePhase = trainingPhase === 'SAMPLE_PLAYING' || isPlaying;

  // Render spectrum/wave animation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      if (isSamplePhase && visualizerData && visualizerData.length > 0) {
        // Draw frequency spectrum bars
        const barCount = 36;
        const barWidth = (width / barCount) - 2;
        const step = Math.floor(visualizerData.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const value = visualizerData[i * step] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * height * 0.88);
          const x = i * (barWidth + 2);
          const y = height - barHeight;

          const grad = ctx.createLinearGradient(0, y, 0, height);
          grad.addColorStop(0, '#06b6d4'); // cyan
          grad.addColorStop(1, '#6366f1'); // indigo

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 3);
          ctx.fill();
        }
      } else {
        // Idle gentle harmonic wave
        const now = Date.now() / 1000;
        ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let x = 0; x < width; x += 3) {
          const y = height / 2 + Math.sin(x * 0.05 + now * 2) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isSamplePhase, visualizerData, isDark]);

  // Retention progress calculation
  const retentionProgressPercent = retentionTotalSec > 0
    ? Math.max(0, Math.min(100, (retentionRemainingSec / retentionTotalSec) * 100))
    : 0;

  return (
    <div className={`w-full rounded-3xl p-6 sm:p-10 border shadow-2xl relative overflow-hidden flex flex-col justify-between items-center transition-colors min-h-[460px] sm:min-h-[520px] ${
      isDark
        ? 'bg-[#0A0D14] border-white/10 text-slate-200 shadow-[0_0_60px_rgba(0,0,0,0.8)]'
        : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
    }`}>
      {/* Background ambient radial glow */}
      <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
        isRetentionPhase
          ? 'opacity-35 bg-[radial-gradient(circle_at_50%_50%,#a855f7,transparent_70%)]'
          : isSamplePhase
          ? 'opacity-40 bg-[radial-gradient(circle_at_50%_50%,#06b6d4,transparent_70%)]'
          : 'opacity-15 bg-[radial-gradient(circle_at_50%_50%,#0ea5e9,transparent_70%)]'
      }`} />

      {/* Top Header */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isRetentionPhase ? 'bg-purple-400' : 'bg-cyan-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isRetentionPhase ? 'bg-purple-500' : 'bg-cyan-500'
            }`}></span>
          </span>
          <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            {isRetentionPhase ? 'RETENCIÓN AUDITIVA EN SILENCIO' : 'FRECUENCIA SECRETA'}
          </span>
        </div>

        <div className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
          isDark
            ? 'bg-white/5 border-white/10 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
            : 'bg-slate-100 border-slate-300 text-cyan-800'
        }`}>
          RONDA {roundNumber} / {totalRounds}
        </div>
      </div>

      {/* Central Interactive Circle Stage */}
      <div className="flex flex-col items-center justify-center my-auto py-4 z-10 w-full relative">
        <div className="relative flex items-center justify-center">
          {/* Outer Scope Ring */}
          <div className={`w-56 h-56 sm:w-72 sm:h-72 rounded-full border-4 flex items-center justify-center relative shadow-2xl transition-all duration-500 ${
            isRetentionPhase
              ? 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_50px_rgba(168,85,247,0.3)]'
              : isSamplePhase
              ? 'border-cyan-400/50 bg-cyan-950/20 shadow-[0_0_50px_rgba(6,182,212,0.4)]'
              : isDark
              ? 'border-white/10 bg-black/40 shadow-[0_0_40px_rgba(0,0,0,0.8)]'
              : 'border-slate-300 bg-slate-100 shadow-md'
          }`}>
            {/* Spinning ring during sample playback */}
            {isSamplePhase && (
              <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin pointer-events-none" />
            )}

            {/* Ripple pulse during sample playback */}
            <AnimatePresence>
              {isSamplePhase && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: [1, 1.4, 1.75], opacity: [0.8, 0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-cyan-500/20 pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* RETENTION WAIT OVERLAY OVER THE CENTER BUTTON */}
            {isRetentionPhase ? (
              <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-purple-950/80 border-2 border-purple-400 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(168,85,247,0.5)] animate-pulse p-4">
                <Hourglass className="w-8 h-8 sm:w-10 sm:h-10 text-purple-300 animate-bounce mb-2" />
                <span className="text-2xl sm:text-4xl font-mono font-black text-white tracking-tight">
                  {retentionRemainingSec.toFixed(1)}s
                </span>
                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-purple-200 mt-1 font-bold">
                  Memoriza en silencio
                </span>
              </div>
            ) : (
              /* Center Tone Button (Emitting or Reescuchar) */
              <button
                id="play-target-tone-btn"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTarget();
                }}
                disabled={disabled || isSamplePhase}
                className={`relative z-20 w-40 h-40 sm:w-52 sm:h-52 rounded-full flex flex-col items-center justify-center font-bold select-none transition-all touch-manipulation cursor-pointer ${
                  isSamplePhase
                    ? 'bg-cyan-500/25 border-2 border-cyan-400 text-cyan-200 shadow-[0_0_40px_rgba(6,182,212,0.6)] scale-105'
                    : isDark
                    ? 'bg-cyan-500/10 border-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-300 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.25)]'
                    : 'bg-cyan-50 border-2 border-cyan-500 text-cyan-800 hover:bg-cyan-100 hover:scale-105 active:scale-95 shadow-md'
                } ${disabled || isSamplePhase ? 'opacity-90' : ''}`}
                title={isSamplePhase ? 'Emitiendo tono...' : 'Escuchar frecuencia'}
              >
                {isSamplePhase ? (
                  <>
                    <Volume2 className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse mb-2 text-cyan-300 pointer-events-none" />
                    <span className="text-xl sm:text-2xl font-mono font-black text-cyan-200">
                      {sampleRemainingSec > 0 ? `${sampleRemainingSec.toFixed(1)}s` : 'EMITIENDO'}
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 mt-1 pointer-events-none">
                      Escuchando muestra...
                    </span>
                  </>
                ) : (
                  <>
                    {targetPlayCount > 0 ? (
                      <>
                        <RotateCcw className="w-9 h-9 sm:w-11 sm:h-11 mb-2 text-cyan-500 pointer-events-none" />
                        <span className="text-xs sm:text-sm font-mono font-bold tracking-wider uppercase pointer-events-none">
                          REESCUCHAR
                        </span>
                      </>
                    ) : (
                      <>
                        <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-1 mb-2 text-cyan-500 pointer-events-none" />
                        <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider pointer-events-none">
                          ESCUCHAR TONO
                        </span>
                      </>
                    )}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Retention Countdown Progress Bar (draining to 0) */}
        {isRetentionPhase && (
          <div className="w-full max-w-md mt-6 space-y-2">
            <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden border border-purple-500/30">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-75 rounded-full"
                style={{ width: `${retentionProgressPercent}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-center text-purple-300 font-semibold">
              El sintonizador se habilitará automáticamente al terminar la cuenta regresiva.
            </p>
          </div>
        )}

        {/* Visualizer Canvas (when playing or idle) */}
        {!isRetentionPhase && (
          <div className={`w-full max-w-md h-12 rounded-2xl border px-4 flex items-center justify-center overflow-hidden shadow-inner mt-6 ${
            isDark ? 'bg-black/60 border-white/5' : 'bg-slate-100 border-slate-300'
          }`}>
            <canvas ref={canvasRef} width={380} height={48} className="w-full h-full" />
          </div>
        )}
      </div>

      {/* Bottom status */}
      <div className={`flex items-center justify-center space-x-2 text-xs font-mono z-10 ${
        isDark ? 'text-slate-400' : 'text-slate-600'
      }`}>
        <Radio className="w-3.5 h-3.5 text-cyan-400" />
        <span>Reproducido: <strong>{targetPlayCount}</strong> {targetPlayCount === 1 ? 'vez' : 'veces'}</span>
      </div>
    </div>
  );
};

