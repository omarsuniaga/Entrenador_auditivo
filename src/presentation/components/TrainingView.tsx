/**
 * Presentation Component: TrainingView
 * Main ear training interface with repetition configuration (1-50),
 * 20 progressive difficulty levels, configurable tone playback duration,
 * interactive frequency matching slider, metric radar, and feedback modals.
 */

import React, { useState, useEffect } from 'react';
import { Volume2, Play, Sparkles, Sliders, Shield, Zap, RotateCcw, Award, Clock, Lock, Settings2, Gauge, BarChart3, ChevronDown, ChevronUp, X, Radio, ShieldAlert, Target } from 'lucide-react';
import { useTrainingEngine } from '../hooks/useTrainingEngine';
import { TonePlayer } from './TonePlayer';
import { RadialFrequencyDial } from './RadialFrequencyDial';
import { MetricRadar } from './MetricRadar';
import { MetricsModal } from './MetricsModal';
import { RoundResultModal } from './RoundResultModal';
import { SessionSummaryModal } from './SessionSummaryModal';
import { TrainingSettingsModal } from './TrainingSettingsModal';
import { VulnerabilityDetectorCard } from './VulnerabilityDetectorCard';
import { DifficultyLevel, DIFFICULTY_CONFIGS_20 } from '../../core/entities/DifficultyProfile';
import { FocusRemediationMode } from '../../core/services/AcousticVulnerabilityEngine';
import { REPETITION_OPTIONS } from '../../shared/constants';
import { formatHertz } from '../../shared/utils/audioMath';
import { useTheme } from '../context/ThemeContext';

interface TrainingViewProps {
  onViewReports: () => void;
  isExternalConfigOpen?: boolean;
  onCloseExternalConfig?: () => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  onViewReports,
  isExternalConfigOpen = false,
  onCloseExternalConfig
}) => {
  const { isDark } = useTheme();
  const {
    session,
    currentRound,
    roundIndex,
    totalRounds,
    difficultyLevel,
    rangeMode,
    ddaState,
    isPlayingTarget,
    isPlayingPreview,
    userSliderHz,
    userSliderPos,
    isMutedPreview,
    setIsMutedPreview,
    lastResult,
    showRoundModal,
    setShowRoundModal,
    showSessionSummaryModal,
    setShowSessionSummaryModal,
    completedProgressReport,
    historySessions,
    vulnerabilityProfile,
    focusMode,
    setFocusMode,
    enableAdaptiveRemediation,
    setEnableAdaptiveRemediation,
    clearHistory,
    visualizerData,
    timeDomainData,
    trainingPhase,
    sampleRemainingSec,
    retentionRemainingSec,
    sampleDurationSec,
    retentionWaitSec,
    setRetentionWaitSec,
    setSampleDurationSec,
    submitOnRelease,
    setSubmitOnRelease,
    activeMinHz,
    activeMaxHz,
    startSession,
    playTargetTone,
    setSliderPosition,
    adjustHzBy,
    stopSliderPreview,
    submitGuess,
    advanceNextRound,
    cancelSession
  } = useTrainingEngine();


  // Setup state with LocalStorage persistence
  const [selectedReps, setSelectedRepsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_reps');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      // Ignored
    }
    return 5;
  });

  const [selectedDifficulty, setSelectedDifficultyState] = useState<DifficultyLevel>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_difficulty');
      if (saved) {
        const val = parseInt(saved, 10) as DifficultyLevel;
        if (!isNaN(val) && val >= 1 && val <= 20) return val;
      }
    } catch {
      // Ignored
    }
    return 1;
  });

  const [selectedMode, setSelectedModeState] = useState<'continuous' | 'discrete_eq' | 'musical'>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_mode');
      if (saved === 'continuous' || saved === 'discrete_eq' || saved === 'musical') {
        return saved;
      }
    } catch {
      // Ignored
    }
    return 'continuous';
  });

  const setSelectedReps = (num: number) => {
    setSelectedRepsState(num);
    try {
      localStorage.setItem('pitch_training_selected_reps', num.toString());
    } catch { }
  };

  const setSelectedDifficulty = (lvl: DifficultyLevel) => {
    setSelectedDifficultyState(lvl);
    try {
      localStorage.setItem('pitch_training_selected_difficulty', lvl.toString());
    } catch { }
  };

  const setSelectedMode = (mode: 'continuous' | 'discrete_eq' | 'musical') => {
    setSelectedModeState(mode);
    try {
      localStorage.setItem('pitch_training_selected_mode', mode);
    } catch { }
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState<boolean>(false);
  const [isRepsOpen, setIsRepsOpen] = useState<boolean>(true);

  // Sync external config open trigger (from mobile footer)
  useEffect(() => {
    if (isExternalConfigOpen) {
      setIsSettingsOpen(true);
    }
  }, [isExternalConfigOpen]);

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (onCloseExternalConfig) {
      onCloseExternalConfig();
    }
  };

  const handleStart = () => {
    startSession(selectedReps, selectedDifficulty, selectedMode, sampleDurationSec, retentionWaitSec);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* If No Active Session: Setup Screen */}
      {!session ? (
        <div className={`max-w-2xl mx-auto rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8 relative overflow-hidden transition-colors ${isDark
            ? 'bg-[#0A0D14] border border-white/5 text-slate-200 shadow-[0_0_60px_rgba(0,0,0,0.8)]'
            : 'bg-white border border-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.08)]'
          }`}>
          {/* Subtle radial ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top-Right Gear Settings Icon (Clean minimal requirement) */}
          <button
            id="open-training-settings-setup-btn"
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`absolute top-5 right-5 sm:top-7 sm:right-7 w-11 h-11 rounded-2xl border flex items-center justify-center transition-all cursor-pointer shadow-md z-20 ${isDark
                ? 'bg-white/5 hover:bg-white/10 text-cyan-400 border-white/10 hover:border-cyan-500/40 hover:scale-105'
                : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-300 hover:scale-105'
              }`}
            title="Configurar parámetros de entrenamiento"
            aria-label="Ajustes de Entrenamiento"
          >
            <Settings2 className="w-5 h-5" />
          </button>

          <div className="text-center space-y-4 relative z-10 py-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center mx-auto text-black shadow-[0_0_30px_rgba(6,182,212,0.5)] mb-5">
              <Volume2 className="w-8 h-8 text-black" />
            </div>
            <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight uppercase leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              CALIBRACIÓN AUDITIVA DE FRECUENCIAS
            </h2>
            <p className={`text-sm sm:text-base font-mono max-w-lg mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Escucha frecuencias y sintoniza hasta sentir que estás en el mismo tono.
            </p>

            {/* Prominent INICIAR button */}
            <div className="pt-6 flex items-center justify-center">
              <button
                id="quick-start-training-btn"
                type="button"
                onClick={handleStart}
                className="inline-flex items-center space-x-3 px-12 py-4 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400 text-black font-black font-mono text-base uppercase tracking-wider shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-black" />
                <span>INICIAR</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Acoustic Vulnerability Detector (80/20 remedial focus) — shown on setup screen when enough history exists */}
      {!session && vulnerabilityProfile?.hasSufficientData && (
        <div className="max-w-2xl mx-auto">
          <VulnerabilityDetectorCard
            vulnerabilityProfile={vulnerabilityProfile}
            currentFocusMode={focusMode}
            enableAdaptiveRemediation={enableAdaptiveRemediation}
            onSelectFocusMode={setFocusMode}
            onToggleAdaptiveRemediation={setEnableAdaptiveRemediation}
            onStartFocusedSession={(mode) => {
              setFocusMode(mode);
              handleStart();
            }}
            isCompact
          />
        </div>
      )}

      {session && (
        /* ACTIVE TRAINING SESSION VIEW */
        <div className="space-y-5">
          {/* MAIN 80% CENTRAL UNIFIED STAGE (Placed at top for identical circle position across all phases) */}
          <div className="w-full max-w-4xl mx-auto">
            {trainingPhase === 'SAMPLE_PLAYING' || trainingPhase === 'RETENTION_WAIT' || trainingPhase === 'IDLE' ? (
              /* Phase 1 & Phase 2: Secret Frequency Tone Player & Retention Countdown */
              <TonePlayer
                isPlaying={isPlayingTarget}
                onPlayTarget={playTargetTone}
                targetPlayCount={currentRound?.targetPlayCount || 0}
                visualizerData={visualizerData}
                roundNumber={roundIndex}
                totalRounds={totalRounds}
                trainingPhase={trainingPhase}
                sampleRemainingSec={sampleRemainingSec}
                retentionRemainingSec={retentionRemainingSec}
                sampleTotalSec={sampleDurationSec}
                retentionTotalSec={retentionWaitSec}
              />
            ) : (
              /* Phase 3: "BUSCA LA FRECUENCIA" Rotary Dial in the exact same location */
              <RadialFrequencyDial
                currentHz={userSliderHz}
                sliderPos={userSliderPos}
                onSliderChange={setSliderPosition}
                onAdjustHz={adjustHzBy}
                onStopPreview={stopSliderPreview}
                onSubmit={submitGuess}
                onPlayTargetTone={playTargetTone}
                isMuted={isMutedPreview}
                onToggleMute={setIsMutedPreview}
                previewEnabled={ddaState.previewEnabled}
                activeMinHz={activeMinHz}
                activeMaxHz={activeMaxHz}
                disabled={trainingPhase !== 'TUNING_READY'}

                submitOnRelease={submitOnRelease}
                trainingPhase={trainingPhase}
                sampleRemainingSec={sampleRemainingSec}
                retentionRemainingSec={retentionRemainingSec}
                sampleDurationSec={sampleDurationSec}
                retentionWaitSec={retentionWaitSec}
                onSetRetentionWaitSec={setRetentionWaitSec}
                onSetSampleDurationSec={setSampleDurationSec}
                onSetSubmitOnRelease={setSubmitOnRelease}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
          </div>

          {/* Non-blocking Inline Round Result Banner (available if modal is dismissed) */}
          {lastResult && !showRoundModal && (
            <div className="w-full max-w-4xl mx-auto bg-[#111622] border border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-mono font-black text-cyan-400 text-lg shrink-0">
                  {lastResult.round.accuracyPercentage}%
                </div>
                <div>
                  <h4 className="font-mono font-bold text-white text-sm">
                    Ronda {lastResult.round.roundNumber} — {lastResult.round.performanceTier.title}
                  </h4>
                  <p className="font-mono text-xs text-slate-400">
                    Objetivo: <span className="text-cyan-400 font-bold">{formatHertz(lastResult.analysis.targetHz)}</span> | Tu Selección: <span className="text-purple-400 font-bold">{formatHertz(lastResult.analysis.userHz)}</span> (Desv: ±{Math.abs(lastResult.analysis.deviationHz)} Hz)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs font-bold border border-white/10 transition-colors cursor-pointer"
                >
                  Ver Detalles
                </button>

                <button
                  type="button"
                  onClick={advanceNextRound}
                  className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                >
                  {lastResult.isSessionFinished ? 'Ver Resumen Final' : 'Siguiente Ronda'}
                </button>
              </div>
            </div>
          )}

          {/* Session Info Bar with Icon Controls (Positioned cleanly underneath the main circular stage) */}
          <div className="w-full max-w-4xl mx-auto bg-[#0A0D14] border border-white/5 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between shadow-xl">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <div>
                <h3 className="font-bold font-mono text-white text-xs sm:text-sm">
                  RONDA {roundIndex} DE {totalRounds}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {ddaState.title} (Tol: ±{ddaState.toleranceHz} Hz) • {submitOnRelease ? 'Auto-envío al soltar' : 'Modo Comparar'}
                </span>
              </div>
            </div>

            {/* Icon-Only Action Buttons */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <button
                id="open-metrics-modal-btn"
                type="button"
                onClick={() => setIsMetricsModalOpen(true)}
                className="relative p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.15)] flex items-center justify-center"
                title={`Métricas y Rendimiento (${session.rounds.filter(r => r.completed).length}/${totalRounds} completadas)`}
                aria-label="Ver Métricas"
              >
                <BarChart3 className="w-4 h-4 text-purple-400" />
                {session.rounds.filter(r => r.completed).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white rounded-full text-[9px] font-bold font-mono flex items-center justify-center border border-black">
                    {session.rounds.filter(r => r.completed).length}
                  </span>
                )}
              </button>

              <button
                id="open-training-settings-session-btn"
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer flex items-center justify-center"
                title="Configuración de tiempos y modo de envío"
                aria-label="Ajustes de entrenamiento"
              >
                <Settings2 className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                type="button"
                onClick={cancelSession}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-all cursor-pointer flex items-center justify-center"
                title="Salir / Cancelar sesión de entrenamiento"
                aria-label="Cancelar Sesión"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Compact In-Session Performance Strip */}
          <div className="w-full max-w-4xl mx-auto bg-[#0A0D14] border border-white/5 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">
                  RENDIMIENTO EN CURSO
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Precisión: <strong className="text-cyan-300">{session.averageAccuracy > 0 ? `${session.averageAccuracy}%` : '--'}</strong> • Desviación: <strong className="text-purple-300">{session.rounds.filter(r => r.completed).length > 0 ? `±${session.averageDeviationHz} Hz` : '--'}</strong>
                </span>
              </div>
            </div>

            <button
              id="view-full-metrics-btn"
              type="button"
              onClick={() => setIsMetricsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/20 text-purple-300 border border-white/10 hover:border-purple-500/40 text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>VER MÉTRICAS</span>
            </button>
          </div>

          {/* Dedicated Persistent Metrics Dashboard Modal */}
          <MetricsModal
            isOpen={isMetricsModalOpen}
            onClose={() => setIsMetricsModalOpen(false)}
            rounds={session.rounds}
            currentRoundIndex={roundIndex}
            totalRounds={totalRounds}
            averageAccuracy={session.averageAccuracy}
            averageDeviationHz={session.averageDeviationHz}
            historySessions={historySessions}
            onClearHistory={clearHistory}
          />

          {/* Training Settings Modal */}
          <TrainingSettingsModal
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
            sampleDurationSec={sampleDurationSec}
            retentionWaitSec={retentionWaitSec}
            submitOnRelease={submitOnRelease}
            selectedReps={selectedReps}
            selectedDifficulty={selectedDifficulty}
            selectedMode={selectedMode}
            onSetSampleDurationSec={setSampleDurationSec}
            onSetRetentionWaitSec={setRetentionWaitSec}
            onSetSubmitOnRelease={setSubmitOnRelease}
            onSetSelectedReps={setSelectedReps}
            onSetSelectedDifficulty={(lvl) => setSelectedDifficulty(lvl as DifficultyLevel)}
            onSetSelectedMode={setSelectedMode}
          />

          {/* Round Result Modal (reveals closeness percentage and exact deviation) */}
          <RoundResultModal
            isOpen={showRoundModal}
            round={lastResult?.round || null}
            analysis={lastResult?.analysis || null}
            adaptiveMessage={lastResult?.adaptiveMessage || null}
            isSessionFinished={lastResult?.isSessionFinished || false}
            onNextRound={advanceNextRound}
            onClose={() => setShowRoundModal(false)}
          />

          {/* End of Session Summary Modal */}
          <SessionSummaryModal
            isOpen={showSessionSummaryModal}
            report={completedProgressReport}
            onRestart={handleStart}
            onViewReports={onViewReports}
            onClose={() => setShowSessionSummaryModal(false)}
          />
        </div>
      )}

      {/* Always render Settings and Metrics Modal in Setup Screen too */}
      {!session && (
        <>
          <TrainingSettingsModal
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
            sampleDurationSec={sampleDurationSec}
            retentionWaitSec={retentionWaitSec}
            submitOnRelease={submitOnRelease}
            selectedReps={selectedReps}
            selectedDifficulty={selectedDifficulty}
            selectedMode={selectedMode}
            onSetSampleDurationSec={setSampleDurationSec}
            onSetRetentionWaitSec={setRetentionWaitSec}
            onSetSubmitOnRelease={setSubmitOnRelease}
            onSetSelectedReps={setSelectedReps}
            onSetSelectedDifficulty={(lvl) => setSelectedDifficulty(lvl as DifficultyLevel)}
            onSetSelectedMode={setSelectedMode}
          />

          <MetricsModal
            isOpen={isMetricsModalOpen}
            onClose={() => setIsMetricsModalOpen(false)}
            rounds={[]}
            currentRoundIndex={0}
            totalRounds={selectedReps}
            averageAccuracy={0}
            averageDeviationHz={0}
            historySessions={historySessions}
            onClearHistory={clearHistory}
          />
        </>
      )}
    </div>
  );
};
