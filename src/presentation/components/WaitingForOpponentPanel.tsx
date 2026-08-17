/**
 * Presentation Component: WaitingForOpponentPanel
 * Shown to a duel player who has already submitted their guess while the rest of the
 * room is still tuning. Occupies the same central stage slot as TonePlayer and
 * RadialFrequencyDial so the circle never shifts position between phases.
 */

import React from 'react';
import { Check, Hourglass } from 'lucide-react';

interface WaitingPlayer {
  id: string;
  name: string;
  avatar?: string;
  hasSubmitted?: boolean;
  connected?: boolean;
}

interface WaitingForOpponentPanelProps {
  players: WaitingPlayer[];
  playerId: string;
  isDark: boolean;
  tuningRemainingSec: number;
}

export const WaitingForOpponentPanel: React.FC<WaitingForOpponentPanelProps> = ({
  players,
  playerId,
  isDark,
  tuningRemainingSec
}) => {
  const pending = players.filter(p => p.connected && !p.hasSubmitted);

  return (
    <div
      className={`w-full rounded-3xl p-6 sm:p-10 border shadow-2xl relative overflow-hidden flex flex-col justify-between items-center transition-colors min-h-[460px] sm:min-h-[520px] ${
        isDark
          ? 'bg-[#0A0D14] border-white/10 text-slate-200 shadow-[0_0_60px_rgba(0,0,0,0.8)]'
          : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
      }`}
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_50%,#10b981,transparent_70%)] pointer-events-none" />

      {/* Top header */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center space-x-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className={`text-xs font-mono font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            RESPUESTA ENVIADA
          </span>
        </div>

        <div
          className={`text-xs font-mono font-bold px-3 py-1 rounded-full border flex items-center space-x-1.5 ${
            isDark
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <Hourglass className="w-3 h-3 animate-spin" />
          <span>ESPERANDO AL OPONENTE</span>
        </div>
      </div>


      {/* Central circle — same footprint as the tone player / dial */}
      <div className="flex flex-col items-center justify-center my-auto py-4 z-10 w-full">
        <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full border-4 border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_50px_rgba(16,185,129,0.3)] flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin pointer-events-none" />

          <div className="w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-emerald-950/60 border-2 border-emerald-400/60 flex flex-col items-center justify-center text-center p-4">
            <Check className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-400 mb-2" />
            <span className="text-sm sm:text-base font-mono font-black text-emerald-100 uppercase tracking-wide">
              Tu respuesta
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-emerald-300/80 mt-1">
              quedó registrada
            </span>
          </div>
        </div>

        {/* Who we are still waiting on */}
        <div className="mt-7 w-full max-w-md space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Hourglass className="w-3.5 h-3.5 animate-pulse" />
            <span>
              {pending.length === 0
                ? 'Evaluando la ronda…'
                : `Esperando a ${pending.length === 1 ? 'tu contrincante' : `${pending.length} jugadores`}`}
            </span>
          </div>

          {players.filter(p => p.connected).map(p => (
            <div
              key={p.id}
              className={`p-3 rounded-2xl border flex items-center justify-between font-mono ${
                p.hasSubmitted
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : isDark
                  ? 'bg-black/50 border-white/10'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{p.avatar || '🎧'}</span>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {p.name}
                  {p.id === playerId && ' (TÚ)'}
                </span>
              </div>

              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  p.hasSubmitted
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 animate-pulse'
                }`}
              >
                {p.hasSubmitted ? '✓ Respondió' : 'Afinando…'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`text-center text-[11px] font-mono z-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        La ronda se evaluará y comparará automáticamente en cuanto ambos competidores confirmen su frecuencia.
      </div>
    </div>
  );

};
