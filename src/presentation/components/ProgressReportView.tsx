/**
 * Presentation Component: ProgressReportView
 * Full analytical progress reports, historical charts, frequency band mastery radar,
 * regression trendline, frequency heat map, and exportable PDF calibration logs.
 */

import React, { useMemo, useState, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Trash2, 
  Download, 
  FileText, 
  Music2, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle,
  Flame,
  Info
} from 'lucide-react';
import { TrainingSession, ProgressReport } from '../../core/entities/TrainingSession';
import { ProgressReportGenerator } from '../../core/services/ProgressReportGenerator';
import { FREQUENCY_BANDS } from '../../core/entities/Frequency';
import { formatHertz } from '../../shared/utils/audioMath';
import { PDFReportAdapter } from '../../infrastructure/storage/PDFReportAdapter';
import { DIFFICULTY_CONFIGS_20, DifficultyLevel } from '../../core/entities/DifficultyProfile';

interface ProgressReportViewProps {
  sessions: TrainingSession[];
  onClearHistory: () => void;
  onStartSession: () => void;
}

export const ProgressReportView: React.FC<ProgressReportViewProps> = ({
  sessions,
  onClearHistory,
  onStartSession
}) => {
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<TrainingSession | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // ESC key listener to close drill-down modal
  React.useEffect(() => {
    if (!selectedSessionForModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSessionForModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSessionForModal]);

  const globalAnalytics = useMemo(() => {
    return ProgressReportGenerator.compileGlobalAnalytics(sessions);
  }, [sessions]);

  // Aggregate band data across all sessions
  const bandChartData = useMemo(() => {
    const bandMap: Record<string, { name: string; totalAcc: number; count: number; color: string; avgDevHz: number }> = {};
    
    FREQUENCY_BANDS.forEach(b => {
      bandMap[b.id] = { name: b.nameEs, totalAcc: 0, count: 0, color: b.color, avgDevHz: 0 };
    });

    sessions.forEach(s => {
      s.rounds.filter(r => r.completed).forEach(r => {
        const bandId = r.targetFrequency.band.id;
        if (bandMap[bandId]) {
          bandMap[bandId].totalAcc += r.accuracyPercentage || 0;
          bandMap[bandId].avgDevHz += Math.abs(r.deviationHz || 0);
          bandMap[bandId].count += 1;
        }
      });
    });

    return Object.values(bandMap).map(b => ({
      name: b.name,
      accuracy: b.count > 0 ? Math.round((b.totalAcc / b.count) * 10) / 10 : 0,
      attempts: b.count,
      avgDevHz: b.count > 0 ? Math.round((b.avgDevHz / b.count) * 10) / 10 : 0,
      color: b.color
    }));
  }, [sessions]);

  // Identify problematic vs master frequencies (Heat Map)
  const frequencyHeatmap = useMemo(() => {
    const rounds = sessions.flatMap(s => s.rounds.filter(r => r.completed));
    if (rounds.length === 0) return [];

    // Group into 8 octaval bins
    const bins = [
      { name: '20-100 Hz', min: 20, max: 100, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '100-250 Hz', min: 100, max: 250, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '250-500 Hz', min: 250, max: 500, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '500-1k Hz', min: 500, max: 1000, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '1k-2k Hz', min: 1000, max: 2000, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '2k-4k Hz', min: 2000, max: 4000, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '4k-8k Hz', min: 4000, max: 8000, attempts: 0, sumDev: 0, sumAcc: 0 },
      { name: '8k-20k Hz', min: 8000, max: 20000, attempts: 0, sumDev: 0, sumAcc: 0 }
    ];

    rounds.forEach(r => {
      const hz = r.targetFrequency.hz;
      const bin = bins.find(b => hz >= b.min && hz < b.max);
      if (bin) {
        bin.attempts += 1;
        bin.sumDev += Math.abs(r.deviationHz || 0);
        bin.sumAcc += (r.accuracyPercentage || 0);
      }
    });

    return bins.map(b => ({
      ...b,
      avgAcc: b.attempts > 0 ? Math.round((b.sumAcc / b.attempts) * 10) / 10 : null,
      avgDev: b.attempts > 0 ? Math.round((b.sumDev / b.attempts) * 10) / 10 : null
    }));
  }, [sessions]);

  // Export report to PDF
  const handleExportPDF = async (targetSession?: TrainingSession) => {
    try {
      setIsExportingPDF(true);
      const sessionToExport = targetSession || (sessions.length > 0 ? sessions[0] : null);
      if (!sessionToExport) return;

      const report = sessionToExport.generateProgressReport();
      await PDFReportAdapter.exportToPDF(report, reportContainerRef.current);
    } catch (e) {
      console.error('Error exporting PDF:', e);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export report to JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions.map(s => s.generateProgressReport()), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audiofit_progress_report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div ref={reportContainerRef} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-black font-mono uppercase text-white tracking-tight">
              INFORME DE CALIBRACIÓN & DIAGNÓSTICO AUDITIVO
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Motor analítico psicoacústico: precisión en Hertz, dominancia por bandas, regresión temporal y exportación técnica.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {sessions.length > 0 && (
            <>
              <button
                id="export-pdf-report-btn"
                onClick={() => handleExportPDF()}
                disabled={isExportingPDF}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 transition-all cursor-pointer"
                title="Generar y descargar informe profesional en PDF"
              >
                <FileText className="w-4 h-4 text-black" />
                <span>{isExportingPDF ? 'GENERANDO PDF...' : 'DESCARGAR PDF'}</span>
              </button>

              <button
                id="export-json-report-btn"
                onClick={handleExportJSON}
                className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-[#0A0D14] hover:bg-white/10 text-slate-300 text-xs font-mono font-semibold border border-white/10 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>JSON</span>
              </button>

              <button
                id="clear-training-history-btn"
                onClick={() => {
                  if (confirm('¿Estás seguro de que deseas reiniciar todo el historial de calibración?')) {
                    onClearHistory();
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono font-semibold border border-rose-500/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>LIMPIAR</span>
              </button>
            </>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-[#0A0D14] rounded-3xl border border-white/5 p-12 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center mx-auto text-cyan-400">
            <Music2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold font-mono text-white">SIN REGISTROS DE ENTRENAMIENTO</h3>
          <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
            Completa tu primera sesión de entrenamiento auditivo para calibrar tu oído, desbloquear los 20 niveles y generar diagnósticos automáticos.
          </p>
          <button
            onClick={onStartSession}
            className="px-7 py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black font-mono uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 transition-all cursor-pointer"
          >
            Comenzar Entrenamiento
          </button>
        </div>
      ) : (
        <>
          {/* Global KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#0A0D14] rounded-2xl p-5 border border-white/5 shadow-xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block mb-1">
                PRECISIÓN GLOBAL
              </span>
              <span className="text-3xl font-black text-cyan-400 font-mono drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                {globalAnalytics.overallAverageAccuracy}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {globalAnalytics.totalRoundsPlayed} ejercicios evaluados
              </span>
            </div>

            <div className="bg-[#0A0D14] rounded-2xl p-5 border border-white/5 shadow-xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block mb-1">
                DESVIACIÓN MEDIA
              </span>
              <span className="text-3xl font-black text-purple-400 font-mono drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                ±{globalAnalytics.overallAverageDeviationHz} Hz
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">
                {globalAnalytics.totalSessionsCompleted} sesiones finalizadas
              </span>
            </div>

            <div className="bg-[#0A0D14] rounded-2xl p-5 border border-white/5 shadow-xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block mb-1">
                BANDA DOMINANTE
              </span>
              <span className="text-lg font-bold font-mono text-white block truncate">
                {globalAnalytics.mostAccurateBand}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 block mt-1">Máxima agudeza auditiva</span>
            </div>

            <div className="bg-[#0A0D14] rounded-2xl p-5 border border-white/5 shadow-xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block mb-1">
                PUNTUACIÓN RÉCORD
              </span>
              <span className="text-3xl font-black text-amber-400 font-mono drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                {globalAnalytics.bestSessionAccuracy}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-1">Precisión récord</span>
            </div>
          </div>

          {/* Problematic Frequencies Heat Map */}
          <div className="bg-[#0A0D14] rounded-2xl p-6 border border-white/5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold font-mono text-white text-sm uppercase">MAPA TÉRMICO DE RESOLUCIÓN ESPECTRAL</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">Desglose por octavas</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {frequencyHeatmap.map((bin) => {
                const hasData = bin.attempts > 0;
                let bgColor = 'bg-black/40 border-white/5 text-slate-500';
                let tag = 'Sin datos';

                if (hasData && bin.avgAcc !== null) {
                  if (bin.avgAcc >= 85) {
                    bgColor = 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300';
                    tag = 'Dominado';
                  } else if (bin.avgAcc >= 65) {
                    bgColor = 'bg-amber-950/40 border-amber-500/40 text-amber-300';
                    tag = 'En Calibración';
                  } else {
                    bgColor = 'bg-rose-950/40 border-rose-500/40 text-rose-300';
                    tag = 'Crítico';
                  }
                }

                return (
                  <div key={bin.name} className={`p-3 rounded-xl border flex flex-col justify-between font-mono ${bgColor}`}>
                    <div>
                      <span className="text-[10px] font-bold block">{bin.name}</span>
                      <span className="text-sm font-black mt-1 block">
                        {bin.avgAcc !== null ? `${bin.avgAcc}%` : '—'}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-400">
                      <span>{bin.attempts} intentos</span>
                      {bin.avgDev !== null && <span className="block text-slate-300">±{bin.avgDev} Hz</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Timeline Line Chart */}
            <div className="bg-[#0A0D14] rounded-2xl p-6 border border-white/5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold font-mono text-white text-sm uppercase">EVOLUCIÓN TEMPORAL DE PRECISIÓN</h3>
                </div>
                <span className="text-xs font-mono text-cyan-400">Regresión de Aprendizaje</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={globalAnalytics.historyTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161c2c" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#05070a', borderColor: 'rgba(6,182,212,0.3)', borderRadius: '0.75rem', fontFamily: 'monospace' }}
                      formatter={(val: any) => [`${val}%`, 'Precisión']}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      dot={{ fill: '#06b6d4', r: 4 }}
                      activeDot={{ r: 7, fill: '#38bdf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Band Mastery Bar Chart */}
            <div className="bg-[#0A0D14] rounded-2xl p-6 border border-white/5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold font-mono text-white text-sm uppercase">DISCRIMINACIÓN ESPECTRAL POR BANDAS</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Banda Crítica (Hz)</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161c2c" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#05070a', borderColor: 'rgba(6,182,212,0.3)', borderRadius: '0.75rem', fontFamily: 'monospace' }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val}% (${item.payload.attempts} intentos, error: ±${item.payload.avgDevHz}Hz)`,
                        'Precisión'
                      ]}
                    />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                      {bandChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Session History Table with Drill-down & Individual PDF Export */}
          <div className="bg-[#0A0D14] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between font-mono">
              <h3 className="font-bold text-white text-sm uppercase">HISTORIAL DETALLADO DE SESIONES</h3>
              <span className="text-xs text-slate-400">{sessions.length} sesiones archivadas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead className="bg-black/60 text-slate-400 uppercase font-semibold text-[10px] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">FECHA</th>
                    <th className="px-4 py-3">RONDAS</th>
                    <th className="px-4 py-3">NIVEL DDA</th>
                    <th className="px-4 py-3">PRECISIÓN</th>
                    <th className="px-4 py-3">DESVIACIÓN MEDIA</th>
                    <th className="px-4 py-3">DESV. ESTÁNDAR</th>
                    <th className="px-4 py-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sessions.map((s) => {
                    const diffConfig = DIFFICULTY_CONFIGS_20[s.difficultyLevel as DifficultyLevel] || DIFFICULTY_CONFIGS_20[1];
                    return (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{s.completedRoundsCount} / {s.totalRounds}</td>
                        <td className="px-4 py-3 text-cyan-300">
                          <span className="bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded text-[10px] font-bold">
                            L{s.difficultyLevel}: {diffConfig.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                          {s.averageAccuracy}%
                        </td>
                        <td className="px-4 py-3 text-purple-300">±{s.averageDeviationHz} Hz</td>
                        <td className="px-4 py-3 text-amber-300">±{s.standardDeviationHz} Hz</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => setSelectedSessionForModal(s)}
                            className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                          >
                            Ver Detalles
                          </button>
                          <button
                            onClick={() => handleExportPDF(s)}
                            className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
                            title="Exportar esta sesión a PDF"
                          >
                            PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Session Drill-Down Modal */}
      {selectedSessionForModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSessionForModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
        >
          <div className="bg-[#0A0D14] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto relative my-8">
            <button
              onClick={() => setSelectedSessionForModal(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center text-xs font-mono border border-white/10 transition-colors cursor-pointer"
              title="Cerrar modal [ESC]"
            >
              ✕
            </button>

            <div className="flex items-center justify-between pb-4 border-b border-white/10 pr-8">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 block">DESGLOSE DE SESIÓN</span>
                <h3 className="text-xl font-bold font-mono text-white">ID: {selectedSessionForModal.id}</h3>
              </div>
            </div>

            {/* Rounds List */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase text-slate-400">RONDAS INDIVIDUALES</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedSessionForModal.rounds.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="text-slate-400">Ronda #{r.roundNumber}:</span>{' '}
                      <span className="text-white font-bold">{formatHertz(r.targetFrequency.hz)}</span>{' '}
                      <span className="text-slate-500">vs</span>{' '}
                      <span className="text-cyan-400">{r.userFrequency ? formatHertz(r.userFrequency.hz) : '—'}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-purple-300">Desv: {r.deviationHz !== undefined ? `${r.deviationHz > 0 ? '+' : ''}${r.deviationHz} Hz` : '—'}</span>
                      <span className="font-bold text-emerald-400">{r.accuracyPercentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
              <button
                onClick={() => handleExportPDF(selectedSessionForModal)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-black" />
                <span>DESCARGAR ESTE REPORTE EN PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
