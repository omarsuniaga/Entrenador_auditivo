/**
 * Presentation Component: MetricRadar
 * Live metrics and round-by-round performance dashboard.
 * Layout structured as requested: prominent horizontal cards for each round (% Ronda 1 | % Ronda 2 | % Ronda 3...)
 * with global accuracy, average deviation, and live progress indicators.
 */

import React from 'react';
import { Gauge, Target, TrendingUp, Award, CheckCircle2, Clock, Activity } from 'lucide-react';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { formatDeviationHz } from '../../shared/utils/audioMath';

interface MetricRadarProps {
  rounds: ExerciseRound[];
  currentRoundIndex: number;
  totalRounds: number;
  averageAccuracy: number;
  averageDeviationHz: number;
}

export const MetricRadar: React.FC<MetricRadarProps> = ({
  rounds,
  currentRoundIndex,
  totalRounds,
  averageAccuracy,
  averageDeviationHz
}) => {
  const completedRounds = rounds.filter(r => r.completed);
  const lastCompleted = completedRounds.length > 0 ? completedRounds[completedRounds.length - 1] : null;

  return (
    <div className="w-full bg-[#0A0D14] border border-white/5 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-5 sm:space-y-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,#0e7490_0%,transparent_60%)] opacity-20 pointer-events-none" />

      {/* Top Header: Metric Bar Title & Overall KPIs */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0">
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black font-mono uppercase tracking-wider text-white text-sm sm:text-base md:text-lg">
                MÉTRICAS DE SESIÓN
              </h3>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase">
                EN VIVO
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-mono text-slate-400 mt-0.5">
              Progreso: <strong className="text-cyan-300">{completedRounds.length}</strong> de <strong className="text-slate-200">{totalRounds}</strong> Rondas Completadas
            </p>
          </div>
        </div>

        {/* Global Key Metric Badges */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 w-full md:w-auto">
          {/* Average Accuracy */}
          <div className="flex items-center justify-between sm:justify-start space-x-2 sm:space-x-3 bg-black/60 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/5 shadow-inner">
            <div className="text-left sm:text-right">
              <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-slate-500 block font-bold">
                PRECISIÓN
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                {averageAccuracy > 0 ? `${averageAccuracy}%` : '--'}
              </span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Average Deviation */}
          <div className="flex items-center justify-between sm:justify-start space-x-2 sm:space-x-3 bg-black/60 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/5 shadow-inner">
            <div className="text-left sm:text-right">
              <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-slate-500 block font-bold">
                DESVIACIÓN
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                {completedRounds.length > 0 ? `±${averageDeviationHz} Hz` : '--'}
              </span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Requested Section: Large Round-by-Round Metrics Strip */}
      <div className="relative z-10 space-y-2.5 sm:space-y-3">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
          <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5 sm:space-x-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span>RESULTADOS POR RONDA:</span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">
            {completedRounds.length}/{totalRounds} finalizadas
          </span>
        </div>

        {/* Dynamic Responsive Grid for the Rounds (e.g. 5 columns for 5 reps, scrollable if many) */}
        <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-2 sm:gap-3.5">
          {Array.from({ length: totalRounds }).map((_, idx) => {
            const r = rounds[idx];
            const isCompleted = r && r.completed;
            const isCurrent = idx === completedRounds.length && !isCompleted;
            const acc = r?.accuracyPercentage || 0;

            let cardStyles = 'bg-black/40 border-white/5 text-slate-600';
            let badgeBg = 'bg-white/5 text-slate-500';
            let glow = '';

            if (isCompleted) {
              if (acc >= 90) {
                cardStyles = 'bg-gradient-to-b from-emerald-950/40 to-black/80 border-emerald-500/60 text-emerald-300';
                badgeBg = 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300';
                glow = 'shadow-[0_0_20px_rgba(16,185,129,0.25)]';
              } else if (acc >= 70) {
                cardStyles = 'bg-gradient-to-b from-cyan-950/40 to-black/80 border-cyan-500/60 text-cyan-300';
                badgeBg = 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300';
                glow = 'shadow-[0_0_20px_rgba(6,182,212,0.25)]';
              } else if (acc >= 50) {
                cardStyles = 'bg-gradient-to-b from-amber-950/40 to-black/80 border-amber-500/60 text-amber-300';
                badgeBg = 'bg-amber-500/20 border border-amber-500/40 text-amber-300';
                glow = 'shadow-[0_0_20px_rgba(245,158,11,0.2)]';
              } else {
                cardStyles = 'bg-gradient-to-b from-rose-950/40 to-black/80 border-rose-500/60 text-rose-300';
                badgeBg = 'bg-rose-500/20 border border-rose-500/40 text-rose-300';
                glow = 'shadow-[0_0_20px_rgba(244,63,94,0.2)]';
              }
            } else if (isCurrent) {
              cardStyles = 'bg-gradient-to-b from-cyan-950/60 to-black/90 border-cyan-400 text-cyan-300 ring-2 ring-cyan-500/40 animate-pulse';
              badgeBg = 'bg-cyan-500 text-black font-black';
              glow = 'shadow-[0_0_25px_rgba(6,182,212,0.35)]';
            }

            return (
              <div
                key={idx}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[95px] sm:min-h-[110px] font-mono relative overflow-hidden ${cardStyles} ${glow}`}
              >
                {/* Header: Round label & Status Icon */}
                <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-white/5">
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase opacity-80">
                    R{idx + 1}
                  </span>
                  <span className={`text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase ${badgeBg}`}>
                    {isCompleted ? 'LISTO' : isCurrent ? 'ACTIVA' : 'PEND'}
                  </span>
                </div>

                {/* Center: Large Percentage Display */}
                <div className="py-1.5 sm:py-2.5 text-center">
                  {isCompleted ? (
                    <div>
                      <span className="text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tight drop-shadow-md">
                        {acc}%
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono block opacity-80 mt-0.5 truncate">
                        {formatDeviationHz(r.deviationHz || 0)}
                      </span>
                    </div>
                  ) : isCurrent ? (
                    <div className="flex flex-col items-center justify-center py-1">
                      <span className="text-[11px] sm:text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        EN CURSO...
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5 hidden xs:inline">
                        Ajusta fader
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-1 opacity-40">
                      <span className="text-lg sm:text-xl font-black font-mono">--%</span>
                      <span className="text-[9px] font-mono">En espera</span>
                    </div>
                  )}
                </div>

                {/* Footer Progress Mini Line */}
                <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted
                        ? acc >= 90
                          ? 'bg-emerald-400'
                          : acc >= 70
                          ? 'bg-cyan-400'
                          : acc >= 50
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                        : isCurrent
                        ? 'bg-cyan-400 animate-pulse w-full'
                        : 'bg-transparent'
                    }`}
                    style={{ width: isCompleted ? `${acc}%` : undefined }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
