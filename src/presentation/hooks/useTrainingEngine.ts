/**
 * Presentation Hook: useTrainingEngine
 * Acts as the Primary Adapter in Hexagonal Architecture, orchestrating
 * the TrainingService use case and reacting to state changes in React components.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TrainingService } from '../../application/usecases/TrainingService';
import { WebAudioSynthesizerAdapter } from '../../infrastructure/audio/WebAudioSynthesizerAdapter';
import { LocalStorageAdapter } from '../../infrastructure/storage/LocalStorageAdapter';
import { TrainingSession, ProgressReport } from '../../core/entities/TrainingSession';
import { ExerciseRound } from '../../core/entities/ExerciseRound';
import { DifficultyLevel, DifficultyConfig, DIFFICULTY_CONFIGS_20 } from '../../core/entities/DifficultyProfile';
import { DeviationAnalysis } from '../../core/services/DeviationCalculator';
import {
  AcousticVulnerabilityEngine,
  FocusRemediationMode,
  VulnerabilityAnalysisResult
} from '../../core/services/AcousticVulnerabilityEngine';
import { logSliderValueToHz, hzToLogSliderValue } from '../../shared/utils/audioMath';
import { useAudioProfile } from '../context/AudioProfileContext';

export type TrainingPhase = 'IDLE' | 'SAMPLE_PLAYING' | 'RETENTION_WAIT' | 'TUNING_READY' | 'EVALUATING';


export interface TrainingEngineState {
  session: TrainingSession | null;
  currentRound: ExerciseRound | null;
  roundIndex: number;
  totalRounds: number;
  trainingPhase: TrainingPhase;
  sampleDurationSec: number;
  retentionWaitSec: number;
  sampleRemainingSec: number;
  retentionRemainingSec: number;
  isPlayingTarget: boolean;
  isPlayingPreview: boolean;
  userSliderHz: number;
  userSliderPos: number; // 0 to 1
  isMutedPreview: boolean;
  difficultyLevel: DifficultyLevel;
  rangeMode: 'continuous' | 'discrete_eq' | 'musical';
  toneDurationMs: number;
  lastResult: {
    round: ExerciseRound;
    analysis: DeviationAnalysis;
    adaptiveMessage: string | null;
    isSessionFinished: boolean;
    progressReport?: ProgressReport;
  } | null;
  showRoundModal: boolean;
  showSessionSummaryModal: boolean;
  completedProgressReport: ProgressReport | null;
  historySessions: TrainingSession[];
  audioVisualizerData: Uint8Array | null;
  roundStartedAt: number;
}

// Singletons for infrastructure adapters
const audioAdapter = new WebAudioSynthesizerAdapter();
const storageAdapter = new LocalStorageAdapter();
const trainingService = new TrainingService(audioAdapter, storageAdapter);

export function useTrainingEngine() {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [currentRound, setCurrentRound] = useState<ExerciseRound | null>(null);
  const [roundIndex, setRoundIndex] = useState<number>(0);
  
  // 1. RONDAS POR SESIÓN
  const [totalRounds, setTotalRoundsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_reps');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1 && val <= 50) return val;
      }
    } catch {}
    return 5;
  });

  // 2. NIVEL DE DIFICULTAD INICIAL (1-20 DDA)
  const [difficultyLevel, setDifficultyLevelState] = useState<DifficultyLevel>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_difficulty');
      if (saved) {
        const val = parseInt(saved, 10) as DifficultyLevel;
        if (!isNaN(val) && val >= 1 && val <= 20) return val;
      }
    } catch {}
    return 1;
  });

  // 5. MODO DE ESPECTRO
  const [rangeMode, setRangeModeState] = useState<'continuous' | 'discrete_eq' | 'musical'>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_selected_mode');
      if (saved === 'continuous' || saved === 'discrete_eq' || saved === 'musical') {
        return saved;
      }
    } catch {}
    return 'continuous';
  });
  
  // 3. DURACIÓN DEL TONO DE MUESTRA
  const [sampleDurationSec, setSampleDurationSecState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_sample_duration');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 1 && val <= 30) return val;
      }
    } catch {}
    return 4;
  });

  // 4. TIEMPO DE RETENCIÓN EN SILENCIO
  const [retentionWaitSec, setRetentionWaitSecState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_retention_wait');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0 && val <= 30) return val;
      }
    } catch {}
    return 5;
  });

  // 6. Modo de Envío y Botón "Comparar"
  const [submitOnRelease, setSubmitOnReleaseState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_submit_on_release');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {}
    return false; // Default: Manual Free Tuning mode with "Comparar" button
  });

  const setTotalRounds = useCallback((reps: number) => {
    const clamped = Math.max(1, Math.min(50, reps));
    setTotalRoundsState(clamped);
    try {
      localStorage.setItem('pitch_training_selected_reps', clamped.toString());
    } catch {}
  }, []);

  const setDifficultyLevel = useCallback((lvl: DifficultyLevel) => {
    const clamped = Math.max(1, Math.min(20, lvl)) as DifficultyLevel;
    setDifficultyLevelState(clamped);
    try {
      localStorage.setItem('pitch_training_selected_difficulty', clamped.toString());
    } catch {}
  }, []);

  const setRangeMode = useCallback((mode: 'continuous' | 'discrete_eq' | 'musical') => {
    setRangeModeState(mode);
    try {
      localStorage.setItem('pitch_training_selected_mode', mode);
    } catch {}
  }, []);

  const setSampleDurationSec = useCallback((sec: number) => {
    const clamped = Math.max(1, Math.min(30, sec));
    setSampleDurationSecState(clamped);
    try {
      localStorage.setItem('pitch_training_sample_duration', clamped.toString());
    } catch {}
  }, []);

  const setRetentionWaitSec = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(30, sec));
    setRetentionWaitSecState(clamped);
    try {
      localStorage.setItem('pitch_training_retention_wait', clamped.toString());
    } catch {}
  }, []);

  // 7. MODO DE ENFOQUE INTELIGENTE / REMEDIACIÓN DE VULNERABILIDADES (80/20)
  const [focusMode, setFocusModeState] = useState<FocusRemediationMode>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_focus_mode');
      if (saved === 'auto' || saved === 'graves' || saved === 'medios' || saved === 'agudos' || saved === 'balanced') {
        return saved;
      }
    } catch {}
    return 'auto'; // Default: Smart auto-detection (80% weakest band, 20% others)
  });

  const [enableAdaptiveRemediation, setEnableAdaptiveRemediationState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pitch_training_adaptive_remediation');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {}
    return true; // Default: ON
  });

  const setFocusMode = useCallback((mode: FocusRemediationMode) => {
    setFocusModeState(mode);
    trainingService.setFocusMode(mode);
    try {
      localStorage.setItem('pitch_training_focus_mode', mode);
    } catch {}
  }, []);

  const setEnableAdaptiveRemediation = useCallback((enabled: boolean) => {
    setEnableAdaptiveRemediationState(enabled);
    trainingService.setAdaptiveRemediation(enabled);
    try {
      localStorage.setItem('pitch_training_adaptive_remediation', enabled.toString());
    } catch {}
  }, []);

  const setSubmitOnRelease = useCallback((enabled: boolean) => {
    setSubmitOnReleaseState(enabled);
    try {
      localStorage.setItem('pitch_training_submit_on_release', enabled.toString());
    } catch {}
  }, []);
  
  // Phase state machine
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>('IDLE');
  const [sampleRemainingSec, setSampleRemainingSec] = useState<number>(4);
  const [retentionRemainingSec, setRetentionRemainingSec] = useState<number>(5);

  const [isPlayingTarget, setIsPlayingTarget] = useState<boolean>(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [userSliderHz, setUserSliderHz] = useState<number>(440);
  const [userSliderPos, setUserSliderPos] = useState<number>(0.5);
  const [isMutedPreview, setIsMutedPreview] = useState<boolean>(false);

  const [lastResult, setLastResult] = useState<any>(null);
  const [showRoundModal, setShowRoundModal] = useState<boolean>(false);
  const [showSessionSummaryModal, setShowSessionSummaryModal] = useState<boolean>(false);
  const [completedProgressReport, setCompletedProgressReport] = useState<ProgressReport | null>(null);
  const [historySessions, setHistorySessions] = useState<TrainingSession[]>([]);

  const [visualizerData, setVisualizerData] = useState<Uint8Array | null>(null);
  const [timeDomainData, setTimeDomainData] = useState<Uint8Array | null>(null);
  
  const roundStartTimeRef = useRef<number>(Date.now());
  const animFrameRef = useRef<number | null>(null);
  const sessionRef = useRef<TrainingSession | null>(null);
  const currentRoundRef = useRef<ExerciseRound | null>(null);
  
  // Active sequence timers
  const sequenceTimersRef = useRef<{
    countdownInterval?: any;
    waitTimeout?: any;
    sampleTimeout?: any;
  }>({});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  // Load history, saved reports, and active in-progress session on mount
  useEffect(() => {
    // 8. SESIONES GUARDADAS EN ESTE NAVEGADOR
    storageAdapter.getSessions().then(sessions => {
      setHistorySessions(sessions);
    });

    // 11. INFORME DE CALIBRACIÓN & DIAGNÓSTICO AUDITIVO
    storageAdapter.getLastReport().then(report => {
      if (report) {
        setCompletedProgressReport(report);
      }
    });

    // 9. SESIÓN EN CURSO Y 10. DESGLOSE DE RONDAS
    storageAdapter.getActiveSession().then(active => {
      if (active && active.session && !active.session.isCompleted) {
        trainingService.restoreSession(active.session, active.rangeMode);
        setSession(active.session);
        sessionRef.current = active.session;
        setTotalRounds(active.session.totalRounds);
        setDifficultyLevel(active.session.difficultyLevel);
        setRangeMode(active.rangeMode);
        setSampleDurationSec(active.sampleDurationSec);
        setRetentionWaitSec(active.retentionWaitSec);
        setSubmitOnRelease(active.submitOnRelease);

        const current = active.session.currentRound || active.session.rounds[active.session.rounds.length - 1];
        if (current) {
          currentRoundRef.current = current;
          setCurrentRound(current);
          setRoundIndex(active.roundIndex || active.session.completedRoundsCount + 1);
          setTrainingPhase('TUNING_READY');
        }
      }
    });
  }, [setTotalRounds, setDifficultyLevel, setRangeMode, setSampleDurationSec, setRetentionWaitSec, setSubmitOnRelease]);

  // Animation loop for audio visualizer
  useEffect(() => {
    const updateVisualizer = () => {
      const data = audioAdapter.getAnalyserData();
      if (data) {
        setVisualizerData(new Uint8Array(data));
      }
      const timeData = audioAdapter.getTimeDomainData();
      if (timeData) {
        setTimeDomainData(new Uint8Array(timeData));
      }
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    };

    animFrameRef.current = requestAnimationFrame(updateVisualizer);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const { profileId, profile: audioProfile, getEffectiveBounds } = useAudioProfile();

  useEffect(() => {
    trainingService.setOutputProfile(profileId);
  }, [profileId]);

  const ddaState = trainingService.getAdaptiveEngine().currentState;
  const { minHz: activeMinHz, maxHz: activeMaxHz } = getEffectiveBounds(ddaState.minHz, ddaState.maxHz);

  // Clear all pending timeouts / intervals in sequence

  const clearSequenceTimers = useCallback(() => {
    if (sequenceTimersRef.current.countdownInterval) {
      clearInterval(sequenceTimersRef.current.countdownInterval);
      sequenceTimersRef.current.countdownInterval = null;
    }
    if (sequenceTimersRef.current.waitTimeout) {
      clearTimeout(sequenceTimersRef.current.waitTimeout);
      sequenceTimersRef.current.waitTimeout = null;
    }
    if (sequenceTimersRef.current.sampleTimeout) {
      clearTimeout(sequenceTimersRef.current.sampleTimeout);
      sequenceTimersRef.current.sampleTimeout = null;
    }
  }, []);

  /**
   * Orchestrates the exact sequential workflow:
   * 1. Reproduce frecuencia de muestra (sampleDurationSec, ej 4s) -> audio del slider estrictamente bloqueado.
   * 2. Espera de memoria auditiva (retentionWaitSec, ej 5s con cuenta regresiva en pantalla) -> slider bloqueado.
   * 3. Habilita audio del slider para sintonizar en vivo al oído.
   */
  const startPhaseSequence = useCallback(async (
    targetDurationSec?: number,
    targetRetentionSec?: number
  ) => {
    const activeSession = sessionRef.current;
    const activeRound = currentRoundRef.current;
    if (!activeSession || !activeRound) return;

    clearSequenceTimers();
    audioAdapter.stopAll();
    setIsPlayingPreview(false);

    const sDuration = targetDurationSec ?? sampleDurationSec;
    const rWait = targetRetentionSec ?? retentionWaitSec;

    try {
      await audioAdapter.initialize();
      
      // Step 1: SAMPLE_PLAYING
      setTrainingPhase('SAMPLE_PLAYING');
      setIsPlayingTarget(true);
      setSampleRemainingSec(sDuration);
      setRetentionRemainingSec(rWait);

      // Smooth countdown for sample tone
      const sampleStartTime = Date.now();
      const sampleTotalMs = sDuration * 1000;
      
      const sampleInterval = setInterval(() => {
        const elapsedMs = Date.now() - sampleStartTime;
        const leftSec = Math.max(0, (sampleTotalMs - elapsedMs) / 1000);
        setSampleRemainingSec(leftSec);
        if (leftSec <= 0) {
          clearInterval(sampleInterval);
        }
      }, 50);
      sequenceTimersRef.current.countdownInterval = sampleInterval;

      // Set custom duration on training service and play tone
      trainingService.setCustomDuration(sampleTotalMs);
      await trainingService.playTargetTone();

      // Refresh currentRound state to trigger React re-render of targetPlayCount
      const current = sessionRef.current?.currentRound;
      if (current) {
        setCurrentRound(Object.assign(
          Object.create(Object.getPrototypeOf(current)),
          current
        ));
      }

      clearInterval(sampleInterval);
      setSampleRemainingSec(0);
      setIsPlayingTarget(false);
      audioAdapter.stopAll();

      // Step 2: RETENTION_WAIT (Cuenta regresiva configurable en pantalla)
      if (rWait > 0) {
        setTrainingPhase('RETENTION_WAIT');
        setRetentionRemainingSec(rWait);

        const waitStartTime = Date.now();
        const waitTotalMs = rWait * 1000;

        await new Promise<void>((resolve) => {
          const waitInterval = setInterval(() => {
            const elapsed = Date.now() - waitStartTime;
            const remaining = Math.max(0, (waitTotalMs - elapsed) / 1000);
            setRetentionRemainingSec(remaining);

            if (remaining <= 0) {
              clearInterval(waitInterval);
              resolve();
            }
          }, 50);
          sequenceTimersRef.current.countdownInterval = waitInterval;
        });
      }

      // Step 3: TUNING_READY (Habilitar audio del slider)
      setRetentionRemainingSec(0);
      setTrainingPhase('TUNING_READY');
      roundStartTimeRef.current = Date.now();

    } catch (e) {
      console.error('Error during phase sequence:', e);
      setIsPlayingTarget(false);
      setTrainingPhase('TUNING_READY');
    }
  }, [sampleDurationSec, retentionWaitSec, clearSequenceTimers]);

  const vulnerabilityProfile = useMemo(() => {
    return AcousticVulnerabilityEngine.analyzeVulnerabilities(historySessions);
  }, [historySessions]);

  /**
   * Starts a brand new ear training session
   */
  const startSession = useCallback(async (
    roundsCount: number = 5,
    level: DifficultyLevel = 1,
    mode: 'continuous' | 'discrete_eq' | 'musical' = 'continuous',
    customSampleSec: number = 4,
    customRetentionSec: number = 5,
    customFocusMode?: FocusRemediationMode,
    customEnableAdaptiveRemediation?: boolean
  ) => {
    clearSequenceTimers();
    audioAdapter.stopAll();
    setIsPlayingPreview(false);
    setIsPlayingTarget(false);

    try {
      await audioAdapter.initialize();
    } catch (e) {
      console.warn('AudioContext initialize gesture wait:', e);
    }
    
    setTotalRounds(roundsCount);
    setDifficultyLevel(level);
    setRangeMode(mode);
    setSampleDurationSec(customSampleSec);
    setRetentionWaitSec(customRetentionSec);
    if (customFocusMode !== undefined) setFocusMode(customFocusMode);
    if (customEnableAdaptiveRemediation !== undefined) setEnableAdaptiveRemediation(customEnableAdaptiveRemediation);
    
    setShowRoundModal(false);
    setShowSessionSummaryModal(false);
    setLastResult(null);

    const activeFocus = customFocusMode ?? focusMode;
    const activeRemediation = customEnableAdaptiveRemediation ?? enableAdaptiveRemediation;

    const newSession = await trainingService.startSession({
      totalRounds: roundsCount,
      difficultyLevel: level,
      rangeMode: mode,
      focusMode: activeFocus,
      enableAdaptiveRemediation: activeRemediation,
      outputProfile: profileId
    });

    const firstRound = newSession.currentRound;
    sessionRef.current = newSession;
    currentRoundRef.current = firstRound;
    setSession(newSession);
    setCurrentRound(firstRound);
    setRoundIndex(1);

    // Set initial slider position (440 Hz standard pitch clamped to bounds)
    const initialHz = Math.max(activeMinHz, Math.min(activeMaxHz, 440));
    const initialPos = hzToLogSliderValue(initialHz, activeMinHz, activeMaxHz);
    setUserSliderHz(initialHz);
    setUserSliderPos(initialPos);

    // Persist active session immediately
    await storageAdapter.saveActiveSession({
      session: newSession,
      sampleDurationSec: customSampleSec,
      retentionWaitSec: customRetentionSec,
      submitOnRelease,
      rangeMode: mode,
      roundIndex: 1
    });

    // Start Phase Sequence (Sample -> Retention Wait -> Enable Slider)
    setTimeout(() => {
      startPhaseSequence(customSampleSec, customRetentionSec);
    }, 200);
  }, [clearSequenceTimers, startPhaseSequence, setTotalRounds, setDifficultyLevel, setRangeMode, setSampleDurationSec, setRetentionWaitSec, submitOnRelease, profileId, activeMinHz, activeMaxHz]);

  /**
   * Adjusts slider position and plays preview frequency continuously ONLY if in TUNING_READY phase
   */
  const setSliderPosition = useCallback((normalizedPos: number) => {
    const clampedPos = Math.max(0, Math.min(1, normalizedPos));
    const hz = logSliderValueToHz(clampedPos, activeMinHz, activeMaxHz);

    setUserSliderPos(clampedPos);
    setUserSliderHz(hz);

    // STRICT AUDIO LOCK: Never play slider preview unless trainingPhase is TUNING_READY
    if (trainingPhase === 'TUNING_READY' && !isMutedPreview) {
      trainingService.startPreviewTone(hz);
      setIsPlayingPreview(true);
    }
  }, [trainingPhase, isMutedPreview, activeMinHz, activeMaxHz]);

  /**
   * Adjusts slider directly by Hz offset (for fine tuning buttons)
   */
  const adjustHzBy = useCallback((deltaHz: number) => {
    const newHz = Math.max(activeMinHz, Math.min(activeMaxHz, userSliderHz + deltaHz));
    const newPos = hzToLogSliderValue(newHz, activeMinHz, activeMaxHz);
    setUserSliderHz(newHz);
    setUserSliderPos(newPos);

    if (trainingPhase === 'TUNING_READY' && !isMutedPreview) {
      trainingService.startPreviewTone(newHz);
      setIsPlayingPreview(true);
    }
  }, [trainingPhase, userSliderHz, isMutedPreview, activeMinHz, activeMaxHz]);


  /**
   * Stops continuous preview tone immediately when user releases click/touch
   */
  const stopSliderPreview = useCallback(() => {
    trainingService.stopPreviewTone();
    audioAdapter.stopContinuousTone();
    setIsPlayingPreview(false);
  }, []);

  /**
   * Submits user's guessed frequency and opens similarity result modal
   */
  const submitGuess = useCallback(async () => {
    if (!session || !currentRound) return;

    // Immediately kill all active sounds
    trainingService.stopPreviewTone();
    audioAdapter.stopAll();
    setIsPlayingPreview(false);
    setIsPlayingTarget(false);
    setTrainingPhase('EVALUATING');

    const responseTimeMs = Date.now() - roundStartTimeRef.current;
    const result = await trainingService.submitGuess(userSliderHz, responseTimeMs);
    setLastResult(result);
    setShowRoundModal(true);

    if (result.isSessionFinished && result.progressReport) {
      setCompletedProgressReport(result.progressReport);
      // Persist completed report and clean up active session
      await storageAdapter.saveLastReport(result.progressReport);
      await storageAdapter.clearActiveSession();
      const updated = await storageAdapter.getSessions();
      setHistorySessions(updated);
    } else {
      // Save updated active session with completed round
      await storageAdapter.saveActiveSession({
        session,
        sampleDurationSec,
        retentionWaitSec,
        submitOnRelease,
        rangeMode,
        roundIndex: session.completedRoundsCount
      });
    }
  }, [session, currentRound, userSliderHz, sampleDurationSec, retentionWaitSec, submitOnRelease, rangeMode]);

  /**
   * Advances to next round and starts sequential phases for the new round
   */
  const advanceNextRound = useCallback(() => {
    setShowRoundModal(false);

    if (lastResult?.isSessionFinished) {
      setShowSessionSummaryModal(true);
      return;
    }

    const next = trainingService.nextRound();
    if (next && session) {
      currentRoundRef.current = next;
      setCurrentRound(next);
      const nextIdx = session.completedRoundsCount + 1;
      setRoundIndex(nextIdx);

      // Persist updated active session state
      storageAdapter.saveActiveSession({
        session,
        sampleDurationSec,
        retentionWaitSec,
        submitOnRelease,
        rangeMode,
        roundIndex: nextIdx
      });

      // Reset slider position
      const initialHz = 440;
      setUserSliderHz(initialHz);
      setUserSliderPos(hzToLogSliderValue(initialHz, 20, 20000));

      // Auto start sequential phase for the new round
      setTimeout(() => {
        startPhaseSequence(sampleDurationSec, retentionWaitSec);
      }, 300);
    } else {
      setShowSessionSummaryModal(true);
    }
  }, [lastResult, session, sampleDurationSec, retentionWaitSec, submitOnRelease, rangeMode, startPhaseSequence]);

  const cancelSession = useCallback(() => {
    clearSequenceTimers();
    audioAdapter.stopAll();
    trainingService.cancelSession();
    storageAdapter.clearActiveSession();
    setSession(null);
    setCurrentRound(null);
    setTrainingPhase('IDLE');
    setShowRoundModal(false);
    setShowSessionSummaryModal(false);
    setLastResult(null);
    setIsPlayingPreview(false);
    setIsPlayingTarget(false);
  }, [clearSequenceTimers]);

  const clearHistory = useCallback(async () => {
    await storageAdapter.clearHistory();
    setHistorySessions([]);
  }, []);

  return {
    session,
    currentRound,
    roundIndex,
    totalRounds,
    setTotalRounds,
    difficultyLevel,
    setDifficultyLevel,
    rangeMode,
    setRangeMode,
    sampleDurationSec,
    setSampleDurationSec,
    retentionWaitSec,
    setRetentionWaitSec,
    submitOnRelease,
    setSubmitOnRelease,
    trainingPhase,
    sampleRemainingSec,
    retentionRemainingSec,
    toneDurationMs: sampleDurationSec * 1000,
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
    visualizerData,
    timeDomainData,
    startSession,
    playTargetTone: () => startPhaseSequence(),
    startPhaseSequence,
    setSliderPosition,
    adjustHzBy,
    stopSliderPreview,
    submitGuess,
    advanceNextRound,
    activeMinHz,
    activeMaxHz,
    outputProfileId: profileId,
    audioOutputProfile: audioProfile,
    cancelSession,
    clearHistory
  };
}

