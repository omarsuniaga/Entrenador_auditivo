/**
 * Presentation Component: MultiplayerView
 * Real-time multiplayer competition duel:
 * 1. Connect two devices via 5-letter room code.
 * 2. Simultaneous clock-synchronized target frequency playback.
 * 3. Individual real-time tuner with scroll-wheel & step micro-adjustments.
 * 4. Authoritative evaluation: Winner is whoever guessed closest to the target sample (lowest deviation in Hz).
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Trophy,
  Play,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Radio,
  Crown,
  Sparkles,
  AlertCircle,
  Award,
  Target,
  Zap,
  Clock,
  Sliders,
  Flame,
  ChevronRight,
  Music2,
  Settings2
} from 'lucide-react';
import { useMultiplayerEngine } from '../hooks/useMultiplayerEngine';
import { formatHertz, formatDeviationHz } from '../../shared/utils/audioMath';
import { NoteSelector } from './NoteSelector';
import { TonePlayer } from './TonePlayer';
import { RadialFrequencyDial } from './RadialFrequencyDial';
import { WaitingForOpponentPanel } from './WaitingForOpponentPanel';
import { DuelRoundResultModal } from './DuelRoundResultModal';
import { useTheme } from '../context/ThemeContext';
import { TuningSystem, NoteScaleType } from '../../core/entities/MusicalNote';

export const MultiplayerView: React.FC = () => {
  const { isDark } = useTheme();
  const {
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
  } = useMultiplayerEngine();

  const [inputRoomName, setInputRoomNameState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('audiofit_multiplayer_roomname');
      if (saved && saved.trim()) return saved;
    } catch { }
    return 'Duelo Acústico Pro';
  });

  const [inputJoinCode, setInputJoinCode] = useState<string>('');

  const [inputReps, setInputRepsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('audiofit_multiplayer_reps');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1 && val <= 50) return val;
      }
    } catch { }
    return 5;
  });

  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // New room game mode options with persistence
  const [selectedGameMode, setSelectedGameModeState] = useState<'frequency' | 'notes'>(() => {
    try {
      const saved = localStorage.getItem('audiofit_multiplayer_gamemode');
      if (saved === 'frequency' || saved === 'notes') return saved;
    } catch { }
    return 'frequency';
  });

  const [selectedScaleType, setSelectedScaleTypeState] = useState<NoteScaleType>(() => {
    try {
      const saved = localStorage.getItem('audiofit_multiplayer_scaletype');
      if (saved === 'chromatic' || saved === 'diatonic') return saved;
    } catch { }
    return 'chromatic';
  });

  const [selectedTuning, setSelectedTuningState] = useState<TuningSystem>(() => {
    try {
      const saved = localStorage.getItem('audiofit_multiplayer_tuningsystem');
      if (saved === '12tet' || saved === 'pythagorean' || saved === 'just') return saved;
    } catch { }
    return '12tet';
  });

  const setInputRoomName = (name: string) => {
    setInputRoomNameState(name);
    try {
      localStorage.setItem('audiofit_multiplayer_roomname', name);
    } catch { }
  };

  const setInputReps = (reps: number) => {
    setInputRepsState(reps);
    try {
      localStorage.setItem('audiofit_multiplayer_reps', reps.toString());
    } catch { }
  };

  const setSelectedGameMode = (mode: 'frequency' | 'notes') => {
    setSelectedGameModeState(mode);
    try {
      localStorage.setItem('audiofit_multiplayer_gamemode', mode);
    } catch { }
  };

  const setSelectedScaleType = (scale: NoteScaleType) => {
    setSelectedScaleTypeState(scale);
    try {
      localStorage.setItem('audiofit_multiplayer_scaletype', scale);
    } catch { }
  };

  const setSelectedTuning = (tuning: TuningSystem) => {
    setSelectedTuningState(tuning);
    try {
      localStorage.setItem('audiofit_multiplayer_tuningsystem', tuning);
    } catch { }
  };

  const handleCopyCode = () => {
    if (roomState?.id) {
      navigator.clipboard.writeText(roomState.id);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const isHost = roomState?.hostId === playerId;
  const currentPlayer = roomState?.players?.find((p: any) => p.id === playerId);
  const opponent = roomState?.players?.find((p: any) => p.id !== playerId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Flame className="w-5 h-5 text-cyan-500" />
            </div>
            <h2 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              DUELO MULTIJUGADOR
            </h2>
          </div>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Empareja 2 dispositivos: audio sincronizado simultáneo, calibración en vivo o duelo de notas musicales.
          </p>
        </div>

        <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border shadow-sm ${isDark ? 'bg-[#0A0D14] border-white/10 text-slate-300' : 'bg-white border-slate-300 text-slate-800'
          }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
          <span className="text-xs font-bold font-mono">
            {isConnected ? 'WEBSOCKET EN VIVO' : 'CONECTANDO AL SERVIDOR...'}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. LOBBY ENTRY FORM (If not in a room) */}
      {!roomState ? (
        <div className={`border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-w-xl mx-auto relative overflow-hidden ${isDark ? 'bg-[#0A0D14] border-cyan-500/20' : 'bg-white border-slate-300'
          }`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Player Name Input */}
          <div className="space-y-2 relative z-10">
            <label className={`text-xs font-bold uppercase tracking-wider block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              TU NOMBRE / APODO:
            </label>
            <input
              id="multiplayer-player-name-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 font-mono font-medium shadow-inner ${isDark ? 'bg-black/60 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              placeholder="Ej: GoldenEar_Pro"
            />
          </div>

          {/* Tab Switcher: Create vs Join */}
          <div className={`flex rounded-xl p-1 border relative z-10 ${isDark ? 'bg-black/60 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'create'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              CREAR SALA
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'join'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              UNIRSE CON CÓDIGO
            </button>
          </div>

          {activeTab === 'create' ? (
            <div className="space-y-4 relative z-10">
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  MODALIDAD DEL DUELO:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGameMode('frequency')}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center space-y-1 transition-all cursor-pointer ${selectedGameMode === 'frequency'
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 shadow-md'
                        : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                  >
                    <Sliders className="w-5 h-5 mb-0.5" />
                    <span className="text-xs font-black">Calibración en Hz</span>
                    <span className="text-[10px] opacity-75">Sintonizador continuo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedGameMode('notes')}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center space-y-1 transition-all cursor-pointer ${selectedGameMode === 'notes'
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-md'
                        : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                  >
                    <Music2 className="w-5 h-5 mb-0.5" />
                    <span className="text-xs font-black">Notas Musicales</span>
                    <span className="text-[10px] opacity-75">Do, Re, Mi / C, D, E</span>
                  </button>
                </div>
              </div>

              {selectedGameMode === 'notes' && (
                <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3">
                  <div className="space-y-1.5">
                    <label className={`text-[11px] font-bold uppercase tracking-wider block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Escala de Notas:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedScaleType('chromatic')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selectedScaleType === 'chromatic'
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        Cromática (12 Notas)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScaleType('diatonic')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${selectedScaleType === 'diatonic'
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        Diatónica (7 Naturales)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-[11px] font-bold uppercase tracking-wider block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Sistema de Afinación:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTuning('12tet')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${selectedTuning === '12tet'
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        12-TET
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTuning('pythagorean')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${selectedTuning === 'pythagorean'
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        Pitagórico (3:2)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTuning('just')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${selectedTuning === 'just'
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                      >
                        Justa
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  NOMBRE DE LA SALA:
                </label>
                <input
                  id="multiplayer-room-name-input"
                  type="text"
                  value={inputRoomName}
                  onChange={(e) => setInputRoomName(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 font-mono shadow-inner ${isDark ? 'bg-black/60 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  CANTIDAD DE RONDAS DEL DUELO:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setInputReps(num)}
                      className={`py-2.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${inputReps === num
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-300 shadow-sm font-black'
                          : isDark ? 'bg-black/60 border-white/5 text-slate-400 hover:bg-white/5' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                    >
                      {num} RONDAS
                    </button>
                  ))}
                </div>
              </div>

              <button
                id="create-multiplayer-room-btn"
                onClick={() => createRoom(inputRoomName, playerName, inputReps, {
                  gameMode: selectedGameMode,
                  scaleType: selectedScaleType,
                  tuningSystem: selectedTuning
                })}
                disabled={!isConnected || !playerName.trim()}
                className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-95"
              >
                CREAR SALA Y GENERAR CÓDIGO
              </button>
            </div>
          ) : (
            <div className="space-y-4 relative z-10">
              <div className="space-y-2">
                <label className={`text-xs font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  CÓDIGO DE SALA (5 CARACTERES):
                </label>
                <input
                  id="multiplayer-join-code-input"
                  type="text"
                  maxLength={5}
                  value={inputJoinCode}
                  onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                  className={`w-full border rounded-xl px-4 py-3 text-cyan-600 dark:text-cyan-400 text-center text-2xl font-mono font-black tracking-widest uppercase focus:outline-none focus:border-cyan-500 shadow-inner ${isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-300'
                    }`}
                  placeholder="Ej: AB12C"
                />
              </div>

              <button
                id="join-multiplayer-room-btn"
                onClick={() => joinRoom(inputJoinCode, playerName)}
                disabled={!isConnected || inputJoinCode.length < 3 || !playerName.trim()}
                className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-95"
              >
                EMPAREJARSE AL DUELO
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 2. INSIDE ACTIVE ROOM */
        <div className="space-y-6">
          {/* Room Header bar */}
          <div className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl ${isDark ? 'bg-[#0A0D14] border-white/10' : 'bg-white border-slate-300'
            }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-500 font-bold shadow-sm">
                {roomState.gameMode === 'notes' ? <Music2 className="w-5 h-5" /> : '🎧'}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className={`font-bold font-mono text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{roomState.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono font-bold uppercase border border-indigo-500/30">
                    {roomState.gameMode === 'notes' ? 'Modo Notas' : 'Modo Frecuencias'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>CÓDIGO DE SALA:</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center space-x-1 font-mono font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400 cursor-pointer"
                    title="Copiar código para el segundo dispositivo"
                  >
                    <span className="tracking-widest">{roomState.id}</span>
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-mono font-bold">
                RONDA {roomState.currentRoundNumber || 0} / {roomState.totalRounds}
              </span>

              <button
                onClick={leaveRoom}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-mono font-semibold border border-rose-500/30 transition-all cursor-pointer"
              >
                SALIR
              </button>
            </div>
          </div>

          {/* ROOM STATE 1: LOBBY */}
          {roomState.status === 'lobby' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Connected Players Card */}
              <div className={`md:col-span-2 border rounded-3xl p-6 space-y-4 shadow-xl ${isDark ? 'bg-[#0A0D14] border-white/10' : 'bg-white border-slate-300'
                }`}>
                <div className="flex items-center justify-between font-mono">
                  <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DISPOSITIVOS CONECTADOS ({roomState.players?.length || 0}/2)</h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {roomState.players?.length < 2 ? 'Comparte el código con el segundo dispositivo...' : '¡Ambos listos para el duelo!'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roomState.players?.map((player: any) => (
                    <div
                      key={player.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between ${player.id === playerId
                          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm'
                          : isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{player.avatar || '🎧'}</span>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{player.name}</span>
                            {player.isHost && (
                              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {player.id === playerId ? '(ESTE DISPOSITIVO)' : 'CONTRINCANTE'}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] uppercase font-mono font-bold px-2.5 py-1 rounded-full ${player.isReady
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : isDark ? 'bg-white/5 text-slate-400 border border-white/5' : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}>
                        {player.isReady ? 'LISTO ✓' : 'ESPERANDO'}
                      </span>
                    </div>
                  ))}

                  {roomState.players?.length === 1 && (
                    <div className="p-4 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 flex flex-col items-center justify-center text-center space-y-1">
                      <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-300">ESPERANDO JUGADOR 2</span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Ingresa el código <strong className="text-cyan-600 dark:text-cyan-400">{roomState.id}</strong> en el otro dispositivo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lobby Controls */}
              <div className={`border rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xl ${isDark ? 'bg-[#0A0D14] border-white/10' : 'bg-white border-slate-300'
                }`}>
                <div className="space-y-3 font-mono">
                  <h4 className={`font-bold text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>REGLAS DEL DUELO</h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                    <li className="flex items-start space-x-1.5">
                      <span className="text-cyan-500 font-bold">1.</span>
                      <span>Sonará la <strong>misma muestra</strong> simultáneamente en ambos dispositivos.</span>
                    </li>
                    <li className="flex items-start space-x-1.5">
                      <span className="text-cyan-500 font-bold">2.</span>
                      <span>{roomState.gameMode === 'notes' ? 'Selecciona la nota musical y octava correcta.' : 'Mueve tu sintonizador o rueda del mouse para encontrar el tono.'}</span>
                    </li>
                    <li className="flex items-start space-x-1.5">
                      <span className="text-cyan-500 font-bold">3.</span>
                      <span><strong>Gana quien se acerque más</strong> (mayor precisión de nota o menor desviación en Hz).</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5 font-mono">
                  <button
                    onClick={() => toggleReady(!currentPlayer?.isReady)}
                    className={`w-full py-3.5 rounded-2xl text-xs font-mono font-bold border transition-all cursor-pointer ${currentPlayer?.isReady
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                        : isDark ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                  >
                    {currentPlayer?.isReady ? '✓ ESTOY LISTO' : 'MARCAR COMO LISTO'}
                  </button>

                  {isHost && (
                    <button
                      id="host-start-multiplayer-btn"
                      onClick={startMatch}
                      disabled={roomState.players?.length < 2}
                      className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                    >
                      {roomState.players?.length < 2 ? 'ESPERANDO 2º JUGADOR...' : 'INICIAR DUELO DE OÍDO'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ROOM STATE 2: COUNTDOWN */}
          {roomState.status === 'countdown' && (
            <div className={`rounded-3xl border border-cyan-500/30 p-12 text-center space-y-4 shadow-2xl font-mono relative overflow-hidden ${isDark ? 'bg-[#0A0D14]' : 'bg-white'
              }`}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyan-500/20 rounded-full blur-3xl" />
              <span className="text-xs uppercase font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
                SINCRONIZANDO AUDIO ENTRE AMBOS DISPOSITIVOS...
              </span>
              <h3 className={`text-5xl font-black animate-pulse ${isDark ? 'text-white' : 'text-slate-900'}`}>¡ATENCIÓN!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El tono de prueba sonará exactamente al mismo tiempo con la misma duración.
              </p>
            </div>
          )}

          {/* ROOM STATE 3: PLAYING */}
          {roomState.status === 'playing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Playback & Input Area */}
              <div className="lg:col-span-2 space-y-6">
                {/* MAIN CENTRAL STAGE — mirrors the solo trainer exactly: TonePlayer and the
                    radial dial SWAP in the same slot so the circle never moves between
                    phases. Sample/retention show the tone player + draining countdown;
                    tuning shows the dial. */}
                <div className="w-full">
                  {duelPhase === 'WAITING_OPPONENT' ? (
                    <WaitingForOpponentPanel
                      players={roomState.players || []}
                      playerId={playerId}
                      isDark={isDark}
                      tuningRemainingSec={tuningRemainingSec}
                    />
                  ) : duelPhase === 'TUNING_READY' && roomState.gameMode !== 'notes' ? (
                    <RadialFrequencyDial
                      currentHz={sliderHz}
                      sliderPos={sliderPos}
                      onSliderChange={setMultiplayerSliderPosition}
                      onAdjustHz={adjustMultiplayerHzBy}
                      onStopPreview={stopMultiplayerPreview}
                      onSubmit={() => submitMultiplayerGuess()}
                      isMuted={isMutedPreview}
                      onToggleMute={setIsMutedPreview}
                      disabled={hasSubmittedThisRound}
                      trainingPhase="TUNING_READY"
                      sampleRemainingSec={sampleRemainingSec}
                      retentionRemainingSec={retentionRemainingSec}
                    />
                  ) : (
                    <TonePlayer
                      isPlaying={duelPhase === 'SAMPLE_PLAYING'}
                      onPlayTarget={playRoundTargetAgain}
                      targetPlayCount={targetPlayCount}
                      visualizerData={visualizerData}
                      roundNumber={roomState.currentRoundNumber}
                      totalRounds={roomState.totalRounds}
                      trainingPhase={duelPhase === 'RETENTION_WAIT' ? 'RETENTION_WAIT' : 'SAMPLE_PLAYING'}
                      sampleRemainingSec={sampleRemainingSec}
                      retentionRemainingSec={retentionRemainingSec}
                      sampleTotalSec={(roomState.currentRound?.audioDurationMs || 2500) / 1000}
                      retentionTotalSec={(roomState.currentRound?.retentionWaitMs || 3000) / 1000}
                      disabled
                    />
                  )}
                </div>

                {/* Device sync banner — shown in the lead window before the tone fires */}
                {duelPhase === 'SYNCING' && (
                  <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 flex items-center justify-center gap-3 font-mono">
                    <Radio className="w-4 h-4 text-cyan-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                      Sincronizando dispositivos… el tono suena en {syncRemainingSec.toFixed(1)}s
                    </span>
                  </div>
                )}

                {/* NOTE MODE INPUT vs FREQUENCY SLIDER */}
                {duelPhase === 'TUNING_READY' && roomState.gameMode === 'notes' ? (
                  <div className={`rounded-3xl border p-6 space-y-5 shadow-xl ${isDark ? 'bg-[#0A0D14] border-white/10' : 'bg-white border-slate-300'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Music2 className="w-5 h-5 text-indigo-500" />
                        <h4 className={`font-bold text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          SELECCIONA LA NOTA MUSICAL
                        </h4>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        Escala: {roomState.scaleType || 'Cromática'}
                      </span>
                    </div>

                    <NoteSelector
                      selectedNoteIndex={selectedNoteIndex}
                      selectedOctave={selectedOctave}
                      onSelectNote={setSelectedNoteIndex}
                      onSelectOctave={setSelectedOctave}
                      scaleType={roomState.scaleType}
                      tuningSystem={roomState.tuningSystem}
                      a4Reference={roomState.a4Reference}
                      onPlayReferenceTone={playReferenceNoteTone}
                      isPlayingReference={isPlayingReferenceNote}
                      disabled={hasSubmittedThisRound}
                    />

                    <div className="pt-2 flex justify-end">
                      <button
                        id="multiplayer-submit-note-btn"
                        onClick={() => submitMultiplayerGuess()}
                        disabled={hasSubmittedThisRound}
                        className={`px-8 py-3.5 rounded-2xl font-black text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${hasSubmittedThisRound
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-sm'
                            : 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30 active:scale-95'
                          }`}
                      >
                        {hasSubmittedThisRound ? '✓ NOTA ENVIADA' : 'CONFIRMAR NOTA MUSICAL'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Live Scoreboard */}
              <div className={`rounded-3xl border p-6 space-y-4 shadow-xl font-mono flex flex-col justify-between ${isDark ? 'bg-[#0A0D14] border-white/10' : 'bg-white border-slate-300'
                }`}>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <h4 className={`font-bold text-sm uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>TABLA EN DIRECTO</h4>
                  </div>

                  <div className="space-y-3">
                    {roomState.players?.map((p: any, idx: number) => (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between ${p.id === playerId ? 'bg-cyan-500/10 border-cyan-500/40 shadow-sm' : isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-200'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-mono font-bold text-slate-400">#{idx + 1}</span>
                          <span className="text-xl">{p.avatar || '🎧'}</span>
                          <div>
                            <span className={`font-bold text-xs block truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{p.roundsWon || 0} rondas ganadas</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-black text-amber-500 text-sm">{p.score} pts</span>
                          <span className={`block text-[9px] font-bold mt-0.5 ${p.hasSubmitted ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {p.hasSubmitted ? '✓ ENVIADO' : 'AFINANDO...'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-2xl p-4 border space-y-1 text-[11px] ${isDark ? 'bg-black/40 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold block uppercase">Criterio de Victoria:</span>
                  <p>
                    {roomState.gameMode === 'notes'
                      ? 'Gana quien acierte la nota musical exacta (Solfège + Octava) y tenga la mayor precisión teórica.'
                      : 'Al enviar, el sistema calcula la diferencia absoluta |Hz objetivo - Hz usuario|. Gana la ronda quien tenga la menor desviación.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ROOM STATE 4: ROUND RESULT — modal with both players' metrics and the winner */}
          <DuelRoundResultModal
            isOpen={roomState.status === 'round_result'}
            players={roomState.players || []}
            playerId={playerId}
            gameMode={roomState.gameMode}
            roundNumber={roomState.currentRoundNumber}
            totalRounds={roomState.totalRounds}
            targetHz={roomState.currentRound?.targetHz}
            noteAnalysis={roomState.currentRound?.noteAnalysis}
            isHost={isHost}
            isLastRound={roomState.currentRoundNumber >= roomState.totalRounds}
            onNextRound={nextRound}
          />

          {/* Between-rounds holding screen behind the modal, so a non-host player who
              dismisses nothing still sees the room is waiting rather than a blank area. */}
          {roomState.status === 'round_result' && (
            <div className={`rounded-3xl border border-cyan-500/20 p-10 text-center font-mono ${isDark ? 'bg-[#0A0D14]' : 'bg-white'
              }`}>
              <span className="text-xs uppercase font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
                Ronda {roomState.currentRoundNumber} evaluada — preparando la siguiente…
              </span>
            </div>
          )}

          {/* ROOM STATE 5: GAME OVER */}
          {roomState.status === 'game_over' && (
            <div className={`rounded-3xl border border-amber-500/40 p-8 text-center space-y-6 shadow-2xl font-mono relative overflow-hidden ${isDark ? 'bg-[#0A0D14]' : 'bg-white'
              }`}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-md">
                <Trophy className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-bold tracking-widest text-amber-500">
                  {roomState.abandonedByName ? 'DUELO TERMINADO POR ABANDONO' : 'DUELO FINALIZADO'}
                </span>
                <h3 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {roomState.abandonedByName
                    ? `¡GANA POR ABANDONO: ${roomState.players?.find((p: any) => p.id === roomState.winnerByAbandonmentId)?.name || roomState.players?.[0]?.name}!`
                    : roomState.finalResult?.isDraw
                      ? '¡EMPATE!'
                      : `¡CAMPEÓN: ${roomState.players?.find((p: any) => p.id === roomState.finalResult?.winnerPlayerId)?.name || roomState.players?.[0]?.name}!`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {roomState.players?.[0]?.roundsWon || 0} de {roomState.totalRounds} rondas ganadas • {roomState.players?.[0]?.score} puntos totales
                </p>
              </div>

              {/* Abandonment notice — the duel still shows every accumulated metric below */}
              {roomState.abandonedByName && (
                <div className="max-w-lg mx-auto rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-3.5">
                  <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-300">
                    <strong>{roomState.abandonedByName}</strong> abandonó la partida en la ronda {roomState.currentRoundNumber} de {roomState.totalRounds}.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                    Estas son las métricas acumuladas hasta el momento del abandono.
                  </p>
                </div>
              )}

              {/* Leaderboard Final */}
              <div className="max-w-lg mx-auto space-y-2 text-left">
                {roomState.players?.map((p: any, idx: number) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border flex justify-between items-center ${idx === 0 ? 'bg-amber-500/10 border-amber-500/40' : isDark ? 'bg-black/60 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-amber-500 font-mono text-base">#{idx + 1}</span>
                      <span className="text-2xl">{p.avatar || '🎧'}</span>
                      <div>
                        <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.name} {p.id === playerId && '(TÚ)'}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Precisión promedio: {p.totalAccuracy}%</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-base text-cyan-600 dark:text-cyan-400">{p.score} pts</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold">{p.roundsWon || 0} Rondas Ganadas</span>
                    </div>
                  </div>
                ))}
              </div>

              {isHost && (
                <button
                  onClick={restartGame}
                  className="px-8 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/30 active:scale-95 transition-all cursor-pointer"
                >
                  VOLVER AL LOBBY PARA REVANCHA
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
