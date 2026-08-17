/**
 * Presentation Component: SessionSummaryModal
 * Comprehensive session completion report showing global accuracy, band mastery,
 * score points, and automated ear training recommendations with one-click PDF export.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, RotateCcw, BarChart2, Star, ShieldAlert, Sparkles, FileText, CheckCircle } from 'lucide-react';
import { ProgressReport } from '../../core/entities/TrainingSession';
import { PDFReportAdapter } from '../../infrastructure/storage/PDFReportAdapter';
import { useTheme } from '../context/ThemeContext';
import { useScrollLock } from '../hooks/useScrollLock';

interface SessionSummaryModalProps {
  isOpen: boolean;
  report: ProgressReport | null;
  onRestart: () => void;
  onViewReports: () => void;
  onClose: () => void;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  isOpen,
  report,
  onRestart,
  onViewReports,
  onClose
}) => {
  const { isDark } = useTheme();
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Lock background scroll when modal is active and not minimized
  useScrollLock(isOpen && !isMinimized);

  // Reset minimization when report opens
  React.useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
    }
  }, [isOpen, report?.sessionId]);

  // ESC key handler to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Strict guard: only appear when session report is complete
  if (!isOpen || !report) return null;

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      await PDFReportAdapter.exportToPDF(report);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // If minimized by the user, show compact floating summary card
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
        <div className={`rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center space-x-4 border font-mono ${
          isDark
            ? 'bg-[#111622]/95 border-cyan-500/40 text-white shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
            : 'bg-white/95 border-slate-300 text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.2)]'
        }`}>
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400">
              {report.overallAccuracy}%
            </span>
            <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
              ({report.totalScore} pts)
            </span>
          </div>

          <button
            onClick={() => setIsMinimized(false)}
            className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border ${
              isDark ? 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            Ver Informe
          </button>

          <button
            onClick={onRestart}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer shadow-md"
          >
            Nueva Sesión
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
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden my-auto relative font-mono transition-colors border ${
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
            title="Minimizar resumen"
          >
            _
          </button>
          <button
            onClick={onClose}
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
          {/* Header Hero */}
          <div className={`p-5 sm:p-6 text-center relative border-b flex flex-col items-center ${
            isDark
              ? 'border-white/5 bg-gradient-to-b from-[#161c2c] to-[#111622]'
              : 'border-slate-200 bg-gradient-to-b from-slate-50 to-white'
          }`}>
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md ${
              isDark
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                : 'bg-cyan-100 border border-cyan-300 text-cyan-800'
            }`}>
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <h2 className={`text-xl sm:text-2xl font-black tracking-tight uppercase ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Sesión de Entrenamiento Completada
            </h2>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
              TELEMETRÍA REGISTRADA: {report.completedRounds} RONDAS DE CALIBRACIÓN ESPECTRAL
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <div className={`inline-flex items-baseline space-x-2 px-4 py-1.5 rounded-xl border shadow-sm ${
                isDark ? 'bg-black/60 border-cyan-500/40' : 'bg-cyan-50 border-cyan-300'
              }`}>
                <span className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>PRECISIÓN:</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-600 dark:text-cyan-400">
                  {report.overallAccuracy}%
                </span>
              </div>

              <div className={`inline-flex items-baseline space-x-2 px-4 py-1.5 rounded-xl border shadow-sm ${
                isDark ? 'bg-black/60 border-emerald-500/40' : 'bg-emerald-50 border-emerald-300'
              }`}>
                <span className={`text-[10px] uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>PUNTOS:</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {report.totalScore} <span className={`text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>/ {report.maxPossibleScore}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className={`p-3 rounded-2xl border ${
                isDark ? 'bg-[#0A0D14] border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[10px] uppercase tracking-widest block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>DESVIACIÓN MEDIA</span>
                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  ±{report.overallAvgDeviationHz} Hz
                </span>
              </div>

              <div className={`p-3 rounded-2xl border ${
                isDark ? 'bg-[#0A0D14] border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[10px] uppercase tracking-widest block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>DESVIACIÓN ESTÁNDAR</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-300">
                  ±{report.standardDeviationHz} Hz
                </span>
              </div>

              <div className={`p-3 rounded-2xl border col-span-2 sm:col-span-1 ${
                isDark ? 'bg-[#0A0D14] border-white/5 shadow-inner' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-[10px] uppercase tracking-widest block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>BANDA DOMINANTE</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                  {report.strongestBand ? report.strongestBand.nameEs : 'Equilibrado'}
                </span>
              </div>
            </div>

            {/* Strongest vs Weakest Band Analysis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.strongestBand && (
                <div className={`p-3.5 rounded-2xl border flex items-start space-x-2.5 ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'
                }`}>
                  <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 block">FORTALEZA AUDITIVA</span>
                    <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{report.strongestBand.nameEs} ({report.strongestBand.minHz}-{report.strongestBand.maxHz} Hz)</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{report.strongestBand.description}</p>
                  </div>
                </div>
              )}

              {report.weakestBand && (
                <div className={`p-3.5 rounded-2xl border flex items-start space-x-2.5 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-300'
                }`}>
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 block">ÁREA A FORTALECER</span>
                    <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{report.weakestBand.nameEs} ({report.weakestBand.minHz}-{report.weakestBand.maxHz} Hz)</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{report.weakestBand.description}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Automated System Recommendations */}
            <div className={`p-4 rounded-2xl border space-y-2 ${
              isDark ? 'bg-[#0A0D14] border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                  DIAGNÓSTICO DEL ALGORITMO AUDITIVO
                </h4>
              </div>
              <ul className={`space-y-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-cyan-500 font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className={`p-3.5 sm:p-4 border-t flex flex-wrap items-center justify-between gap-2.5 shrink-0 ${
          isDark ? 'bg-[#0c101a] border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center space-x-2">
            <button
              id="summary-download-pdf-btn"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDark ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-900 border-cyan-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isExportingPDF ? 'GENERANDO...' : 'PDF'}</span>
            </button>

            <button
              id="summary-view-reports-btn"
              onClick={onViewReports}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:border-cyan-500/40' : 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-500" />
              <span>INFORMES</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10' : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              Cerrar [ESC]
            </button>

            <button
              id="summary-new-session-btn"
              onClick={onRestart}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider text-xs shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-black stroke-[3]" />
              <span>NUEVA SESIÓN</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
