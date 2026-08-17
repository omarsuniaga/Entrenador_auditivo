import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trophy, WifiOff } from 'lucide-react';
import { CloudflareRankingApi, PublicRankingEntry } from '../../infrastructure/ranking/CloudflareRankingApi';
import { useTheme } from '../context/ThemeContext';

const rankingApi = new CloudflareRankingApi();

export const PublicRankingView: React.FC = () => {
  const { isDark } = useTheme();
  const [entries, setEntries] = useState<PublicRankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRanking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEntries(await rankingApi.getSoloRanking());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el ranking público.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadRanking(); }, [loadRanking]);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className={`rounded-3xl border p-6 sm:p-8 ${isDark ? 'bg-[#0A0D14]/80 border-cyan-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Ranking público</h1>
              <p className={isDark ? 'text-slate-400 text-sm' : 'text-slate-600 text-sm'}>Mejores resultados de entrenamiento de frecuencia.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadRanking()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {isLoading && <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Cargando clasificación…</p>}

        {error && (
          <div className={`rounded-2xl border p-5 flex gap-3 ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-950'}`}>
            <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Ranking aún no disponible</p>
              <p className="text-sm opacity-85 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Aún no hay partidas clasificadas. Sé la primera persona en aparecer aquí.</p>
        )}

        {!isLoading && !error && entries.length > 0 && (
          <ol className="space-y-2">
            {entries.map((entry) => (
              <li key={`${entry.rank}-${entry.display_name}`} className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-2xl px-4 py-3 border ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`font-black text-lg ${entry.rank <= 3 ? 'text-amber-400' : isDark ? 'text-slate-500' : 'text-slate-500'}`}>#{entry.rank}</span>
                <span className={`font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{entry.display_name}</span>
                <span className="text-right">
                  <strong className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>{entry.score}</strong>
                  <small className={isDark ? 'block text-slate-500' : 'block text-slate-500'}>{entry.accuracy.toFixed(1)}% precisión</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
