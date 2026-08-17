/**
 * Presentation Component: MetricsModal
 * Dedicated, persistent modal dashboard for real-time and historical training metrics.
 * Frees up screen space during active training and persists across reloads via LocalStorage.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Gauge,
  Target,
  Activity,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  Zap,
  X,
  Sparkles,
  BarChart2,
  Calendar,
  Trash2,
  History
} from 'lucide-react';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { TrainingSession } from '../../core/entities/TrainingSession';
import { formatDeviationHz, formatHertz } from '../../shared/utils/audioMath';
import { useTheme } from '../context/ThemeContext';
import { useScrollLock } from '../hooks/useScrollLock';

interface MetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rounds: ExerciseRound[];
  currentRoundIndex: number;
  totalRounds: number;
  averageAccuracy: number;
  averageDeviationHz: number;
  historySessions?: TrainingSession[];
  onClearHistory?: () => void;
}

export const MetricsModal: React.FC<MetricsModalProps> = ({
  isOpen,
  onClose,
  rounds,
  currentRoundIndex,
  totalRounds,
  averageAccuracy,
  averageDeviationHz,
  historySessions = [],
  onClearHistory
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Lock background scroll while modal is active
  useScrollLock(isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const completedRounds = rounds.filter(r => r.completed);

  return (
    <div
      id="metrics-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className={`w-full max-w-4xl rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden my-auto max-h-[90vh] overflow-y-auto font-mono transition-colors border ${
          isDark
            ? 'bg-[#0A0D14] border-cyan-500/30 text-white shadow-[0_0_50px_rgba(0,0,0,0.9)]'
            : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.2)]'
        }`}
      >
        {/* Ambient Top Glow */}
        {isDark && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        )}

        {/* Modal Header */}
        <div className={`flex items-center justify-between border-b pb-4 relative z-10 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isDark ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'bg-cyan-100 border border-cyan-300 text-cyan-800'
            }`}>
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className={`text-lg sm:text-xl font-black uppercase tracking-wider ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  PANEL DE MÉTRICAS AUDITIVAS
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30' : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                }`}>
                  PERSISTENTE
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Seguimiento de calibración, desviación en Hz y registro histórico guardado en almacenamiento local
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="close-metrics-modal-btn"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs: Sesión Actual vs Histórico Persistente */}
        <div className={`flex items-center space-x-2 relative z-10 border-b pb-2 ${
          isDark ? 'border-white/5' : 'border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'current'
                ? isDark
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-cyan-100 text-cyan-950 border border-cyan-500 font-black shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Sesión en Curso ({completedRounds.length}/{totalRounds})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? isDark
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                  : 'bg-purple-100 text-purple-950 border border-purple-500 font-black shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico Guardado ({historySessions.length} sesiones)</span>
          </button>
        </div>

        {/* Tab 1: Current Session Live Metrics */}
        {activeTab === 'current' && (
          <div className="space-y-6 relative z-10">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Overall Accuracy */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-black/60 border-cyan-500/30 shadow-inner' : 'bg-cyan-50/70 border-cyan-200 shadow-sm'
              }`}>
                <div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold block ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    PRECISIÓN GLOBAL
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400">
                    {averageAccuracy > 0 ? `${averageAccuracy}%` : '--'}
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300' : 'bg-cyan-100 border border-cyan-300 text-cyan-800'
                }`}>
                  <Target className="w-5 h-5" />
                </div>
              </div>

              {/* Average Deviation */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-black/60 border-purple-500/30 shadow-inner' : 'bg-purple-50/70 border-purple-200 shadow-sm'
              }`}>
                <div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold block ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    DESVIACIÓN MEDIA
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
                    {completedRounds.length > 0 ? `±${averageDeviationHz} Hz` : '--'}
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300' : 'bg-purple-100 border border-purple-300 text-purple-800'
                }`}>
                  <Activity className="w-5 h-5" />
                </div>
              </div>

              {/* Progress Count */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-black/60 border-emerald-500/30 shadow-inner' : 'bg-emerald-50/70 border-emerald-200 shadow-sm'
              }`}>
                <div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold block ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    RONDAS COMPLETADAS
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    {completedRounds.length} <span className={isDark ? 'text-sm text-slate-500 font-normal' : 'text-sm text-slate-600 font-normal'}>/ {totalRounds}</span>
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' : 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Detailed Round By Round Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase flex items-center space-x-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-800'
                }`}>
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  <span>DESGLOSE DE TODAS LAS RONDAS:</span>
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {completedRounds.length} evaluadas
                </span>
              </div>

              {rounds.length === 0 ? (
                <div className={`rounded-2xl p-6 text-center text-xs border ${
                  isDark ? 'bg-black/40 border-white/5 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  Aún no se han generado rondas en esta sesión.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  {rounds.map((round) => {
                    const isCurrent = round.roundNumber === currentRoundIndex;
                    const isDone = round.completed;

                    return (
                      <div
                        key={round.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCurrent
                            ? isDark
                              ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50'
                              : 'bg-cyan-50 border-cyan-500 shadow-sm ring-1 ring-cyan-400'
                            : isDone
                            ? isDark
                              ? 'bg-black/50 border-white/10 hover:border-cyan-500/30'
                              : 'bg-slate-50 border-slate-300 hover:border-cyan-400'
                            : isDark
                              ? 'bg-black/30 border-white/5 opacity-50'
                              : 'bg-slate-100 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Ronda {round.roundNumber}
                          </span>
                          {isDone ? (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-950 border border-cyan-300'
                            }`}>
                              {round.accuracyPercentage}%
                            </span>
                          ) : isCurrent ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 dark:text-amber-300 text-[10px] font-bold animate-pulse">
                              En Curso
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                              isDark ? 'bg-white/5 text-slate-500' : 'bg-slate-200 text-slate-600'
                            }`}>
                              Pendiente
                            </span>
                          )}
                        </div>

                        {isDone && round.userFrequency !== undefined ? (
                          <div className={`mt-2 space-y-1 text-[11px] border-t pt-2 ${
                            isDark ? 'text-slate-400 border-white/5' : 'text-slate-700 border-slate-200'
                          }`}>
                            <div className="flex justify-between">
                              <span>Objetivo:</span>
                              <strong className={isDark ? 'text-slate-200' : 'text-slate-900'}>{formatHertz(round.targetFrequency.hz)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Tu Respuesta:</span>
                              <strong className="text-cyan-600 dark:text-cyan-300">{formatHertz(round.userFrequency.hz)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Desviación:</span>
                              <strong className="text-purple-600 dark:text-purple-300">{formatDeviationHz(round.deviationHz || 0)}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className={`mt-3 text-[10px] italic ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                            {isCurrent ? 'Afinando sintonizador...' : 'Esperando turno...'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Persistent History from LocalStorage */}
        {activeTab === 'history' && (
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase flex items-center space-x-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-800'
              }`}>
                <History className="w-4 h-4 text-purple-500" />
                <span>SESIONES GUARDADAS EN ESTE NAVEGADOR:</span>
              </span>

              {historySessions.length > 0 && onClearHistory && (
                <button
                  onClick={onClearHistory}
                  className="px-3 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpiar Historial</span>
                </button>
              )}
            </div>

            {historySessions.length === 0 ? (
              <div className={`border rounded-2xl p-8 text-center space-y-2 ${
                isDark ? 'bg-black/40 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <Award className="w-8 h-8 text-slate-400 mx-auto" />
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  Aún no hay sesiones guardadas en el historial local.
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
                  Completa una sesión de entrenamiento para almacenar automáticamente tus métricas.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {historySessions.map((hist, idx) => {
                  const dateStr = hist.createdAt ? new Date(hist.createdAt).toLocaleDateString() + ' ' + new Date(hist.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente';
                  return (
                    <div
                      key={hist.id || idx}
                      className={`p-4 rounded-2xl transition-all space-y-2 border ${
                        isDark ? 'bg-black/60 border-white/10 hover:border-purple-500/40' : 'bg-slate-50 border-slate-200 hover:border-purple-400 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-900 border-purple-300'
                          }`}>
                            Nivel {hist.difficultyLevel}
                          </span>
                          <span className={`text-xs flex items-center space-x-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{dateStr}</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                            Precisión: {hist.averageAccuracy}%
                          </span>
                          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                            Desv: ±{hist.averageDeviationHz} Hz
                          </span>
                        </div>
                      </div>

                      <div className={`flex items-center space-x-2 text-[11px] ${
                        isDark ? 'text-slate-500' : 'text-slate-600'
                      }`}>
                        <span>{hist.rounds.filter(r => r.completed).length} de {hist.totalRounds} rondas completadas</span>
                        <span>•</span>
                        <span>{hist.isCompleted ? 'Sesión Finalizada' : 'Sesión Parcial'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className={`flex justify-end pt-3 border-t relative z-10 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
          >
            VOLVER AL ENTRENAMIENTO
          </button>
        </div>
      </motion.div>
    </div>
  );
};
