/**
 * Presentation Hook: useMultiplayerEngine
 * Connects React UI to the real-time WebSocket adapter for live multiplayer pitch duels.
 * Features:
 * - Real-time room matchmaking via 5-character code
 * - Sub-millisecond synchronized target frequency playback across paired devices
 * - Precise slider adjustments with continuous audio feedback and wheel support
 * - Authoritative lowest-deviation round winner scoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeNetworkAdapter } from '../../infrastructure/realtime/WebSocketClientAdapter';
import { WebAudioSynthesizerAdapter } from '../../infrastructure/audio/WebAudioSynthesizerAdapter';
import { logSliderValueToHz, hzToLogSliderValue } from '../../shared/utils/audioMath';
import { decodeTargetHz } from '../../shared/utils/frequencyObfuscation';
import { MusicalNoteCalculator, CHROMATIC_NOTES, TuningSystem, NoteScaleType } from '../../core/entities/MusicalNote';

const audioAdapter = new WebAudioSynthesizerAdapter();

/**
 * Duel phase machine, mirroring the solo trainer's TrainingPhase but derived from
 * server timestamps instead of local timers, so every device advances together:
 *   SYNCING          -> devices align clocks, tone is scheduled but hasn't fired
 *   SAMPLE_PLAYING   -> target tone sounds; tuning is locked
 *   RETENTION_WAIT   -> silence + draining countdown bar; tuning still locked
 *   TUNING_READY     -> dial unlocked, live preview audio allowed
 *   WAITING_OPPONENT -> this player answered, waiting on the rest of the room
 */
export type MultiplayerPhase =
  | 'IDLE'
  | 'SYNCING'
  | 'SAMPLE_PLAYING'
  | 'RETENTION_WAIT'
  | 'TUNING_READY'
  | 'WAITING_OPPONENT';

export function useMultiplayerEngine() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string>('');
  // sessionStorage (not localStorage) so this device's name doesn't collide with another
  // tab of the same browser on the same origin — playerId already uses sessionStorage for
  // the same reason. With localStorage, two tabs testing/playing locally would silently
  // share one name (confirmed: both players showed up as the same name in the abandon-duel
  // leaderboard test).
  const [playerName, setPlayerNameState] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('audiofit_player_name');
      if (saved && saved.trim().length > 0) return saved;
    } catch {}
    return 'Ingeniero de Audio';
  });

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    try {
      sessionStorage.setItem('audiofit_player_name', name);
    } catch {}
  }, []);
  const [sliderHz, setSliderHz] = useState<number>(440);
  const [sliderPos, setSliderPos] = useState<number>(0.5);
  
  // Note mode selections
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number>(9); // Default 'A' / 'La'
  const [selectedOctave, setSelectedOctave] = useState<number>(4);      // Default 4
  const [isPlayingReferenceNote, setIsPlayingReferenceNote] = useState<boolean>(false);

  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState<boolean>(false);
  const [isPlayingTargetAudio, setIsPlayingTargetAudio] = useState<boolean>(false);
  const [isPlayingPreviewAudio, setIsPlayingPreviewAudio] = useState<boolean>(false);
  const [isMutedPreview, setIsMutedPreview] = useState<boolean>(false);
  const [visualizerData, setVisualizerData] = useState<Uint8Array | null>(null);
  const [targetPlayCount, setTargetPlayCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server-derived phase machine
  const [duelPhase, setDuelPhase] = useState<MultiplayerPhase>('IDLE');
  const [syncRemainingSec, setSyncRemainingSec] = useState<number>(0);
  const [sampleRemainingSec, setSampleRemainingSec] = useState<number>(0);
  const [retentionRemainingSec, setRetentionRemainingSec] = useState<number>(0);
  const [tuningRemainingSec, setTuningRemainingSec] = useState<number>(0);

  const roundStartRef = useRef<number>(Date.now());
  const prevRoundNumberRef = useRef<number>(0);
  const currentRoomIdRef = useRef<string>('');
  const clockOffsetRef = useRef<number>(0);
  const scheduledAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMutedPreviewRef = useRef<boolean>(false);
  isMutedPreviewRef.current = isMutedPreview;
  // Tuning-gate: preview audio and guess submission are only legal in TUNING_READY.
  const duelPhaseRef = useRef<MultiplayerPhase>('IDLE');
  duelPhaseRef.current = duelPhase;

  // Synchronized playback helper function
  const triggerScheduledTone = useCallback((targetHz: number, durationMs: number, scheduledPlayTime?: number) => {
    if (scheduledAudioTimeoutRef.current) {
      clearTimeout(scheduledAudioTimeoutRef.current);
      scheduledAudioTimeoutRef.current = null;
    }

    const estimatedServerNow = Date.now() + clockOffsetRef.current;
    const targetPlayTime = scheduledPlayTime || estimatedServerNow;
    const delayMs = Math.max(0, targetPlayTime - estimatedServerNow);

    scheduledAudioTimeoutRef.current = setTimeout(() => {
      audioAdapter.initialize().then(() => {
        setIsPlayingTargetAudio(true);
        setTargetPlayCount(count => count + 1);
        audioAdapter.playTone({
          frequencyHz: targetHz,
          durationMs: durationMs || 2500,
          volume: 0.55
        }).finally(() => {
          setIsPlayingTargetAudio(false);
        });
      });
    }, delayMs);
  }, []);

  /**
   * Phase ticker. Recomputes the current phase and every countdown from the server's
   * absolute timestamps corrected by our measured clock offset. Because all devices run
   * this same computation against the same timestamps, they transition in lockstep.
   */
  useEffect(() => {
    const round = roomState?.currentRound;
    if (!roomState || roomState.status !== 'playing' || !round?.tuningStartTime) {
      setDuelPhase('IDLE');
      setSyncRemainingSec(0);
      setSampleRemainingSec(0);
      setRetentionRemainingSec(0);
      setTuningRemainingSec(0);
      return;
    }

    const sampleEndsAt = round.scheduledPlayTime + (round.audioDurationMs || 2500);

    const tick = () => {
      const serverNow = Date.now() + clockOffsetRef.current;

      setSyncRemainingSec(Math.max(0, (round.scheduledPlayTime - serverNow) / 1000));
      setSampleRemainingSec(Math.max(0, (sampleEndsAt - serverNow) / 1000));
      setRetentionRemainingSec(Math.max(0, (round.tuningStartTime - serverNow) / 1000));
      setTuningRemainingSec(Math.max(0, (round.tuningDeadline - serverNow) / 1000));

      if (hasSubmittedThisRound) {
        setDuelPhase('WAITING_OPPONENT');
      } else if (serverNow < round.scheduledPlayTime) {
        setDuelPhase('SYNCING');
      } else if (serverNow < sampleEndsAt) {
        setDuelPhase('SAMPLE_PLAYING');
      } else if (serverNow < round.tuningStartTime) {
        setDuelPhase('RETENTION_WAIT');
      } else {
        setDuelPhase('TUNING_READY');
      }
    };

    tick();
    const intervalId = setInterval(tick, 50);
    return () => clearInterval(intervalId);
  }, [
    roomState?.status,
    roomState?.currentRound?.roundNumber,
    roomState?.currentRound?.tuningStartTime,
    roomState?.currentRound?.scheduledPlayTime,
    roomState?.currentRound?.tuningDeadline,
    roomState?.currentRound?.audioDurationMs,
    hasSubmittedThisRound
  ]);

  // Animation loop for the shared audio visualizer (TonePlayer spectrum bars)
  useEffect(() => {
    let animFrameId: number;
    const updateVisualizer = () => {
      const data = audioAdapter.getAnalyserData();
      if (data) {
        setVisualizerData(new Uint8Array(data));
      }
      animFrameId = requestAnimationFrame(updateVisualizer);
    };
    animFrameId = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // Initialize connection and clock sync
  useEffect(() => {
    let pid = sessionStorage.getItem('audiofit_player_id');
    if (!pid) {
      pid = `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      sessionStorage.setItem('audiofit_player_id', pid);
    }
    setPlayerId(pid);

    realtimeNetworkAdapter.connect().then(() => {
      setIsConnected(true);
      // Run initial clock sync ping
      realtimeNetworkAdapter.sendPing(Date.now());
    }).catch(err => {
      console.warn('WS connection failed initially:', err);
    });

    const onRoomState = (data: any) => {
      setRoomState(data);

      if (data.id) {
        currentRoomIdRef.current = data.id;
      }

      // Calibrate clock if serverTime provided
      if (data.serverTime) {
        clockOffsetRef.current = data.serverTime - Date.now();
      }

      // Detect round transition
      if (data.currentRound && data.currentRound.roundNumber !== prevRoundNumberRef.current) {
        prevRoundNumberRef.current = data.currentRound.roundNumber;
        setHasSubmittedThisRound(false);
        setTargetPlayCount(0);
        roundStartRef.current = Date.now();

        // Reset inputs
        setSliderHz(440);
        setSliderPos(hzToLogSliderValue(440, 20, 20000));
        setSelectedNoteIndex(9); // A / La
        setSelectedOctave(4);

        // If an encoded target is provided (during playing status), decode and schedule tone playback
        if (data.currentRound.encodedTargetHz && data.status === 'playing') {
          const decodedHz = decodeTargetHz(data.currentRound.encodedTargetHz, data.id, data.currentRound.roundNumber);
          triggerScheduledTone(
            decodedHz,
            data.currentRound.audioDurationMs || 2500,
            data.currentRound.scheduledPlayTime
          );
        }
      }
    };

    const onSyncPlayAudio = (data: any) => {
      if (data.encodedTargetHz) {
        const roomId = data.roomId || currentRoomIdRef.current;
        const decodedHz = decodeTargetHz(data.encodedTargetHz, roomId, data.roundNumber);
        triggerScheduledTone(decodedHz, data.durationMs || 2500, data.scheduledPlayTime);
      }
    };

    const onPong = (data: any) => {
      if (data.clientTimestamp && data.serverTimestamp) {
        const now = Date.now();
        const rtt = now - data.clientTimestamp;
        const estimatedServerTime = data.serverTimestamp + (rtt / 2);
        clockOffsetRef.current = estimatedServerTime - now;
      }
    };

    const onError = (data: any) => {
      setErrorMessage(data.message || 'Error en la conexión con el servidor.');
    };

    const onConnected = () => {
      setIsConnected(true);
      realtimeNetworkAdapter.sendPing(Date.now());
    };
    const onDisconnected = () => setIsConnected(false);

    realtimeNetworkAdapter.on('ROOM_STATE', onRoomState);
    realtimeNetworkAdapter.on('SYNC_PLAY_AUDIO', onSyncPlayAudio);
    realtimeNetworkAdapter.on('PONG', onPong);
    realtimeNetworkAdapter.on('ERROR', onError);
    realtimeNetworkAdapter.on('CONNECTED', onConnected);
    realtimeNetworkAdapter.on('DISCONNECTED', onDisconnected);

    return () => {
      if (scheduledAudioTimeoutRef.current) {
        clearTimeout(scheduledAudioTimeoutRef.current);
      }
      realtimeNetworkAdapter.off('ROOM_STATE', onRoomState);
      realtimeNetworkAdapter.off('SYNC_PLAY_AUDIO', onSyncPlayAudio);
      realtimeNetworkAdapter.off('PONG', onPong);
      realtimeNetworkAdapter.off('ERROR', onError);
      realtimeNetworkAdapter.off('CONNECTED', onConnected);
      realtimeNetworkAdapter.off('DISCONNECTED', onDisconnected);
    };
  }, [triggerScheduledTone]);

  const createRoom = useCallback(async (
    roomName: string,
    hostName: string,
    totalRounds: number,
    options: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      a4Reference?: number;
    } = {}
  ) => {
    setErrorMessage(null);
    setPlayerName(hostName);
    const code = await realtimeNetworkAdapter.createRoom(roomName, hostName, totalRounds, options);
    return code;
  }, []);

  const updateRoomSettings = useCallback((settings: {
    gameMode?: 'frequency' | 'notes';
    scaleType?: NoteScaleType;
    tuningSystem?: TuningSystem;
    totalRounds?: number;
    a4Reference?: number;
  }) => {
    if (roomState?.id) {
      realtimeNetworkAdapter.updateRoomSettings(roomState.id, settings);
    }
  }, [roomState]);

  const joinRoom = useCallback(async (roomId: string, name: string) => {
    setErrorMessage(null);
    setPlayerName(name);
    await realtimeNetworkAdapter.joinRoom(roomId, name);
  }, []);

  const leaveRoom = useCallback(() => {
    if (roomState?.id) {
      realtimeNetworkAdapter.leaveRoom(roomState.id);
      setRoomState(null);
    }
  }, [roomState]);

  const toggleReady = useCallback((isReady: boolean) => {
    if (roomState?.id) {
      realtimeNetworkAdapter.setReady(roomState.id, isReady);
    }
  }, [roomState]);

  const startMatch = useCallback(() => {
    if (roomState?.id) {
      realtimeNetworkAdapter.startMatch(roomState.id);
    }
  }, [roomState]);

  const setMultiplayerSliderPosition = useCallback((normalizedPos: number) => {
    // Tuning (and its live preview tone) is locked until the retention wait elapses,
    // otherwise a player could match the target by ear while it is still sounding.
    if (duelPhaseRef.current !== 'TUNING_READY') return;

    const clamped = Math.max(0, Math.min(1, normalizedPos));
    const hz = logSliderValueToHz(clamped, 20, 20000);
    setSliderPos(clamped);
    setSliderHz(hz);

    if (isMutedPreviewRef.current) return;
    audioAdapter.initialize().then(() => {
      audioAdapter.startContinuousTone(hz, 0.4);
      setIsPlayingPreviewAudio(true);
    });
  }, []);

  const adjustMultiplayerHzBy = useCallback((deltaHz: number) => {
    if (duelPhaseRef.current !== 'TUNING_READY') return;

    const newHz = Math.max(20, Math.min(20000, sliderHz + deltaHz));
    const newPos = hzToLogSliderValue(newHz, 20, 20000);
    setSliderHz(newHz);
    setSliderPos(newPos);

    if (isMutedPreviewRef.current) return;
    audioAdapter.initialize().then(() => {
      audioAdapter.startContinuousTone(newHz, 0.4);
      setIsPlayingPreviewAudio(true);
    });
  }, [sliderHz]);

  const stopMultiplayerPreview = useCallback(() => {
    audioAdapter.stopContinuousTone();
    setIsPlayingPreviewAudio(false);
  }, []);

  // Play audio preview for selected musical note
  const playReferenceNoteTone = useCallback((noteIndex: number, octave: number) => {
    const tuning = roomState?.tuningSystem || '12tet';
    const a4 = roomState?.a4Reference || 440;
    let hz = 440;
    if (tuning === 'pythagorean') {
      hz = MusicalNoteCalculator.getPythagoreanHertz(noteIndex, octave, false, a4);
    } else if (tuning === 'just') {
      hz = MusicalNoteCalculator.getJustHertz(noteIndex, octave, a4);
    } else {
      const midi = (octave + 1) * 12 + noteIndex;
      hz = MusicalNoteCalculator.get12TETHertz(midi, a4);
    }

    setIsPlayingReferenceNote(true);
    audioAdapter.initialize().then(() => {
      audioAdapter.playTone({
        frequencyHz: hz,
        durationMs: 800,
        volume: 0.5,
        fadeInMs: 20,
        fadeOutMs: 40
      }).finally(() => {
        setIsPlayingReferenceNote(false);
      });
    });
  }, [roomState]);

  const submitMultiplayerGuess = useCallback((options?: { noteIndex?: number; octave?: number }) => {
    if (!roomState?.id || hasSubmittedThisRound) return;
    // The server rejects early guesses too, but bail here so the UI never optimistically
    // flips to "submitted" for a message that will be dropped.
    if (duelPhaseRef.current !== 'TUNING_READY') return;

    audioAdapter.stopAll();
    setIsPlayingPreviewAudio(false);

    // Measured from when tuning unlocked (server clock), matching the server's own metric.
    const tuningStart = roomState.currentRound?.tuningStartTime;
    const responseTimeMs = tuningStart
      ? Math.max(50, Date.now() + clockOffsetRef.current - tuningStart)
      : Date.now() - roundStartRef.current;

    if (roomState.gameMode === 'notes') {
      const nIdx = options?.noteIndex !== undefined ? options.noteIndex : selectedNoteIndex;
      const oct = options?.octave !== undefined ? options.octave : selectedOctave;
      realtimeNetworkAdapter.submitGuess(roomState.id, {
        guessedNoteIndex: nIdx,
        guessedOctave: oct,
        responseTimeMs
      });
    } else {
      realtimeNetworkAdapter.submitGuess(roomState.id, {
        userHz: sliderHz,
        responseTimeMs
      });
    }

    setHasSubmittedThisRound(true);
  }, [roomState, sliderHz, selectedNoteIndex, selectedOctave, hasSubmittedThisRound]);

  const playRoundTargetAgain = useCallback(() => {
    if (roomState?.id && roomState.status === 'playing') {
      // Trigger synchronized playback across all devices in the room
      realtimeNetworkAdapter.playSyncTarget(roomState.id);
    }
  }, [roomState]);

  const nextRound = useCallback(() => {
    if (roomState?.id) {
      realtimeNetworkAdapter.requestNextRound(roomState.id);
    }
  }, [roomState]);

  const restartGame = useCallback(() => {
    if (roomState?.id) {
      realtimeNetworkAdapter.restartGame(roomState.id);
    }
  }, [roomState]);

  return {
    isConnected,
    roomState,
    playerId,
    playerName,
    setPlayerName,
    sliderHz,
    sliderPos,
    selectedNoteIndex,
    setSelectedNoteIndex,
    selectedOctave,
    setSelectedOctave,
    isPlayingReferenceNote,
    playReferenceNoteTone,
    hasSubmittedThisRound,
    isPlayingTargetAudio,
    isPlayingPreviewAudio,
    isMutedPreview,
    setIsMutedPreview,
    visualizerData,
    targetPlayCount,
    duelPhase,
    syncRemainingSec,
    sampleRemainingSec,
    retentionRemainingSec,
    tuningRemainingSec,
    errorMessage,
    setErrorMessage,
    createRoom,
    updateRoomSettings,
    joinRoom,
    leaveRoom,
    toggleReady,
    startMatch,
    setMultiplayerSliderPosition,
    adjustMultiplayerHzBy,
    stopMultiplayerPreview,
    submitMultiplayerGuess,
    playRoundTargetAgain,
    nextRound,
    restartGame
  };
}

