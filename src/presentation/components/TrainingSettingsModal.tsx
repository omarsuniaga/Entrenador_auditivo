/**
 * Presentation Component: TrainingSettingsModal
 * Configures all training parameters:
 * 0. CANTIDAD DE RONDAS / REPETICIONES
 * 1. NIVEL DE DIFICULTAD INICIAL (1-20 DDA)
 * 2. DURACIÓN DEL TONO DE MUESTRA (CONFIGURABLE)
 * 3. TIEMPO DE ESPERA / RETENCIÓN EN SILENCIO (CONFIGURABLE)
 * 4. MODO DE ESPECTRO (Continuo, Ecualizador Gráfico ISO, Notas Musicales)
 * 5. Modo de Envío ("Comparar" vs Auto-Envío)
 */

import React from 'react';
import {
  Settings,
  Volume2,
  Hourglass,
  MousePointerClick,
  Check,
  RotateCcw,
  X,
  Zap,
  Radio,
  Layers,
  Sparkles,
  Target,
  ShieldAlert,
  Smartphone,
  Headphones
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAudioProfile } from '../context/AudioProfileContext';
import { useScrollLock } from '../hooks/useScrollLock';

import { getAppVersion, getBuildIdentifier } from '../../shared/version';
import { REPETITION_OPTIONS } from '../../shared/constants';
import { FocusRemediationMode } from '../../core/services/AcousticVulnerabilityEngine';

export interface TrainingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleDurationSec: number;
  retentionWaitSec: number;
  submitOnRelease: boolean;
  selectedReps?: number;
  selectedDifficulty?: number;
  selectedMode?: 'continuous' | 'discrete_eq' | 'musical';
  focusMode?: FocusRemediationMode;
  enableAdaptiveRemediation?: boolean;
  onSetSampleDurationSec: (sec: number) => void;
  onSetRetentionWaitSec: (sec: number) => void;
  onSetSubmitOnRelease: (enabled: boolean) => void;
  onSetSelectedReps?: (reps: number) => void;
  onSetSelectedDifficulty?: (diff: number) => void;
  onSetSelectedMode?: (mode: 'continuous' | 'discrete_eq' | 'musical') => void;
  onSetFocusMode?: (mode: FocusRemediationMode) => void;
  onSetEnableAdaptiveRemediation?: (enabled: boolean) => void;
}

const PRESET_SAMPLE_TIMES = [
  { seconds: 1, label: '1s (Rápido)' },
  { seconds: 2, label: '2s' },
  { seconds: 3, label: '3s' },
  { seconds: 4, label: '4s (Recomendado ★)' },
  { seconds: 5, label: '5s' },
  { seconds: 8, label: '8s' },
  { seconds: 10, label: '10s (Extenso)' }
];

const PRESET_RETENTION_TIMES = [
  { seconds: 0, label: '0s (Inmediato)' },
  { seconds: 1, label: '1s' },
  { seconds: 2, label: '2s' },
  { seconds: 3, label: '3s' },
  { seconds: 5, label: '5s (Estándar ★)' },
  { seconds: 8, label: '8s' },
  { seconds: 10, label: '10s (Retención Alta)' }
];

export const TrainingSettingsModal: React.FC<TrainingSettingsModalProps> = ({
  isOpen,
  onClose,
  sampleDurationSec,
  retentionWaitSec,
  submitOnRelease,
  selectedReps = 10,
  selectedDifficulty = 5,
  selectedMode = 'continuous',
  focusMode = 'auto',
  enableAdaptiveRemediation = true,
  onSetSampleDurationSec,
  onSetRetentionWaitSec,
  onSetSubmitOnRelease,
  onSetSelectedReps,
  onSetSelectedDifficulty,
  onSetSelectedMode,
  onSetFocusMode,
  onSetEnableAdaptiveRemediation
}) => {
  const { isDark } = useTheme();
  const { profileId, profile, setProfileId, isMobileSpeakerMode } = useAudioProfile();
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    onSetSampleDurationSec(4);
    onSetRetentionWaitSec(5);
    onSetSubmitOnRelease(false);
    setProfileId('mobile_speaker');
    if (onSetSelectedReps) onSetSelectedReps(10);
    if (onSetSelectedDifficulty) onSetSelectedDifficulty(5);
    if (onSetSelectedMode) onSetSelectedMode('continuous');
  };

  const getDifficultyDescription = (lvl: number) => {
    if (lvl <= 5) return { name: 'PRINCIPIANTE (BANDA ANCHA)', tol: '±12% - ±8% Hz', desc: 'Rango generoso para familiarización auditiva.' };
    if (lvl <= 10) return { name: 'INTERMEDIO (RESOLUCIÓN 1/3 OCTAVA)', tol: '±7% - ±4% Hz', desc: 'Precisión equivalente a ecualización estándar.' };
    if (lvl <= 15) return { name: 'AVANZADO (CALIBRACIÓN QUIRÚRGICA)', tol: '±3% - ±1.5% Hz', desc: 'Entrenamiento de oído absoluto y microafinación.' };
    return { name: 'EXPERTO / MASTER (PRECISIÓN PRO)', tol: '±1.2% - ±0.5% Hz', desc: 'Nivel élite para masterización y producción acústica.' };
  };

  const diffInfo = getDifficultyDescription(selectedDifficulty);

  return (
    <div
      id="training-settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 my-auto transition-colors ${
        isDark
          ? 'bg-[#0a0e17] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-slate-200'
          : 'bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-slate-900'
      }`}>
        {/* Header: CONFIGURACIÓN DE ENTRENAMIENTO */}
        <div className={`flex items-center justify-between border-b pb-3.5 relative z-10 shrink-0 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
              isDark
                ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-cyan-50 border border-cyan-500/40 text-cyan-700 shadow-sm'
            }`}>
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className={`text-base sm:text-lg font-black font-mono tracking-wider uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  CONFIGURACIÓN DE ENTRENAMIENTO
                </h2>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                }`}>
                  {getAppVersion()}
                </span>
              </div>
              <p className={`text-xs font-mono ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                Parámetros acústicos, rondas, dificultad DDA y modos espectrales
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Cerrar configuración"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 space-y-4 relative z-10 overflow-y-auto pr-1 sm:pr-2 font-mono scroll-smooth">
          {/* Section: PERFIL DE SALIDA ACÚSTICA (CALIBRACIÓN DE DISPOSITIVO) */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            isDark
              ? 'bg-black/50 border-cyan-500/30 shadow-inner'
              : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-cyan-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  0. DISPOSITIVO / TRANSDUCTOR ACÚSTICO
                </label>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isMobileSpeakerMode
                  ? isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                  : isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
              }`}>
                {profile.shortLabel}
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Ajusta el piso acústico mínimo para asegurar que todas las frecuencias sean físicamente audibles en tus bocinas o audífonos:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Card 1: Altavoces Móvil */}
              <div
                onClick={() => setProfileId('mobile_speaker')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  profileId === 'mobile_speaker'
                    ? isDark
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400'
                      : 'bg-cyan-50 border-cyan-600 text-cyan-950 shadow-sm ring-1 ring-cyan-600'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono">Altavoces Móvil / Integrados</span>
                  </div>
                  {profileId === 'mobile_speaker' && <Check className="w-4 h-4 text-cyan-400" />}
                </div>
                <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1">
                  Rango Seguro: 130 Hz - 12,000 Hz (C₃ a C₆)
                </div>
                <p className={`text-[10px] font-normal leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Optimizado para micro-parlantes de smartphone/tablet. Elimina sub-graves inaudibles (&lt;130 Hz).
                </p>
              </div>

              {/* Card 2: Auriculares / Estudio */}
              <div
                onClick={() => setProfileId('headphones_studio')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  profileId === 'headphones_studio'
                    ? isDark
                      ? 'bg-purple-950/40 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-400'
                      : 'bg-purple-50 border-purple-600 text-purple-950 shadow-sm ring-1 ring-purple-600'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Headphones className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold font-mono">Auriculares / Monitores</span>
                  </div>
                  {profileId === 'headphones_studio' && <Check className="w-4 h-4 text-purple-400" />}
                </div>
                <div className="text-[10px] font-mono text-purple-400 font-bold mb-1">
                  Rango Íntegro: 20 Hz - 20,000 Hz (C₁ a C₇)
                </div>
                <p className={`text-[10px] font-normal leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Espectro acústico completo con sub-graves profundos para audífonos y sistemas de producción.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: CANTIDAD DE RONDAS / REPETICIONES */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            isDark
              ? 'bg-black/50 border-cyan-500/20 shadow-inner'
              : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  1. RONDAS POR SESIÓN
                </label>
              </div>

              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                isDark
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-cyan-100 text-cyan-900 border-cyan-300 font-black'
              }`}>
                {selectedReps} RONDAS
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Cantidad de frecuencias aleatorias a calibrar antes de emitir el reporte final de calibración.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {REPETITION_OPTIONS.map((num) => (
                <button
                  key={num}
                  id={`config-rep-option-${num}`}
                  type="button"
                  onClick={() => onSetSelectedReps && onSetSelectedReps(num)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedReps === num
                      ? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-md scale-105'
                      : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                  }`}
                >
                  {num} R
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: NIVEL DE DIFICULTAD INICIAL (1-20 DDA) */}
          <div className={`p-4 rounded-2xl border space-y-3.5 transition-colors ${
            isDark
              ? 'bg-black/50 border-amber-500/20 shadow-inner'
              : 'bg-amber-50/60 border-amber-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  2. NIVEL DE DIFICULTAD INICIAL (1-20 DDA)
                </label>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                isDark
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'bg-amber-100 text-amber-900 border-amber-400 font-black'
              }`}>
                NIVEL {selectedDifficulty} / 20
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <span className={`font-bold ${isDark ? 'text-amber-400' : 'text-amber-900'}`}>
                {diffInfo.name}
              </span>
              <span className={isDark ? 'text-slate-400' : 'text-slate-700'}>
                Tolerancia de acierto: <strong>{diffInfo.tol}</strong>
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {diffInfo.desc} El algoritmo DDA ajustará la precisión automáticamente según tus respuestas consecutivas.
            </p>

            <div className="pt-2 flex items-center space-x-3">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Nv. 1</span>
              <input
                id="modal-difficulty-slider"
                type="range"
                min="1"
                max="20"
                step="1"
                value={selectedDifficulty}
                onChange={(e) => onSetSelectedDifficulty && onSetSelectedDifficulty(parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Nv. 20</span>
            </div>
          </div>

          {/* Section 2: DURACIÓN DEL TONO DE MUESTRA (CONFIGURABLE) */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            isDark
              ? 'bg-black/50 border-cyan-500/20 shadow-inner'
              : 'bg-cyan-50/50 border-cyan-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-cyan-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  3. DURACIÓN DEL TONO DE MUESTRA
                </label>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                isDark
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-cyan-100 text-cyan-900 border-cyan-400 font-black'
              }`}>
                {sampleDurationSec}s
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Tiempo de emisión del tono acústico inicial con frecuencia oculta que debes memorizar en cada ronda.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {PRESET_SAMPLE_TIMES.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  onClick={() => onSetSampleDurationSec(preset.seconds)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    sampleDurationSec === preset.seconds
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-black'
                      : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>1s</span>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={sampleDurationSec}
                onChange={(e) => onSetSampleDurationSec(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>15s</span>
            </div>
          </div>

          {/* Section 3: TIEMPO DE ESPERA / RETENCIÓN EN SILENCIO (CONFIGURABLE) */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            isDark
              ? 'bg-black/50 border-purple-500/20 shadow-inner'
              : 'bg-purple-50/50 border-purple-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hourglass className="w-4 h-4 text-purple-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  4. TIEMPO DE RETENCIÓN EN SILENCIO
                </label>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                isDark
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                  : 'bg-purple-100 text-purple-900 border-purple-400 font-black'
              }`}>
                {retentionWaitSec}s
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Intervalo de silencio posterior al tono de muestra. Obliga al cerebro a retener la huella psicoacústica antes de modular el sintonizador.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {PRESET_RETENTION_TIMES.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  onClick={() => onSetRetentionWaitSec(preset.seconds)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    retentionWaitSec === preset.seconds
                      ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] font-black'
                      : isDark
                        ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>0s</span>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={retentionWaitSec}
                onChange={(e) => onSetRetentionWaitSec(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>20s</span>
            </div>
          </div>

          {/* Section 4: MODO DE ESPECTRO */}
          <div className={`p-4 rounded-2xl border space-y-3.5 transition-colors ${
            isDark
              ? 'bg-black/50 border-emerald-500/20 shadow-inner'
              : 'bg-emerald-50/50 border-emerald-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  5. MODO DE ESPECTRO
                </label>
              </div>
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Determina la escala y distribución de frecuencias generadas durante las rondas de entrenamiento:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* Option 1: Continuo */}
              <div
                onClick={() => onSetSelectedMode && onSetSelectedMode('continuous')}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                  selectedMode === 'continuous'
                    ? isDark
                      ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-md'
                      : 'bg-cyan-50 border-cyan-600 text-slate-900 shadow-sm'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-400 opacity-70'
                      : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Continuo (20Hz - 20kHz)</span>
                  {selectedMode === 'continuous' && <Check className="w-3.5 h-3.5 text-cyan-500 stroke-[3]" />}
                </div>
                <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Espectro logarítmico completo para calibración libre y microtonal.
                </p>
              </div>

              {/* Option 2: Ecualizador ISO */}
              <div
                onClick={() => onSetSelectedMode && onSetSelectedMode('discrete_eq')}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                  selectedMode === 'discrete_eq'
                    ? isDark
                      ? 'bg-purple-950/40 border-purple-400 text-white shadow-md'
                      : 'bg-purple-50 border-purple-600 text-slate-900 shadow-sm'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-400 opacity-70'
                      : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Ecualizador ISO 31-Bandas</span>
                  {selectedMode === 'discrete_eq' && <Check className="w-3.5 h-3.5 text-purple-500 stroke-[3]" />}
                </div>
                <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Bandas de tercio de octava (31.5Hz, 63Hz, 125Hz, 1kHz, 8kHz, 16kHz...).
                </p>
              </div>

              {/* Option 3: Notas Musicales */}
              <div
                onClick={() => onSetSelectedMode && onSetSelectedMode('musical')}
                className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                  selectedMode === 'musical'
                    ? isDark
                      ? 'bg-emerald-950/40 border-emerald-400 text-white shadow-md'
                      : 'bg-emerald-50 border-emerald-600 text-slate-900 shadow-sm'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-slate-400 opacity-70'
                      : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">Notas Musicales (A4=440Hz)</span>
                  {selectedMode === 'musical' && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />}
                </div>
                <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Escala temperada estándar (C0 a B8) para entrenamiento de músicos.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Modo de Envío ("Comparar" vs Auto-Envío) */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            isDark
              ? 'bg-black/50 border-slate-700/50 shadow-inner'
              : 'bg-slate-50 border-slate-300 shadow-sm'
          }`}>
            <div className="flex items-center space-x-2">
              <MousePointerClick className="w-4 h-4 text-cyan-500" />
              <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                6. Modo de Envío y Botón "Comparar"
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div
                onClick={() => onSetSubmitOnRelease(false)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  !submitOnRelease
                    ? isDark
                      ? 'bg-emerald-950/40 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span>Modo Manual ("COMPARAR")</span>
                  {!submitOnRelease && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <p className={`text-[10px] font-normal mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Permite afinar libremente y confirmar con el botón "Comparar".
                </p>
              </div>

              <div
                onClick={() => onSetSubmitOnRelease(true)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  submitOnRelease
                    ? isDark
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-cyan-50 border-cyan-600 text-cyan-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span>Envío al Soltar Click</span>
                  {submitOnRelease && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                </div>
                <p className={`text-[10px] font-normal mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Evalúa instantáneamente al levantar el dedo o cursor.
                </p>
              </div>
            </div>
          </div>

          {/* Section 6: REMEDIACIÓN DE VULNERABILIDADES (80/20) */}
          <div className={`p-4 rounded-2xl border space-y-3.5 transition-colors ${
            isDark
              ? 'bg-black/50 border-amber-500/20 shadow-inner'
              : 'bg-amber-50/50 border-amber-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  7. REMEDIACIÓN DE VULNERABILIDADES & ENFOQUE (80/20)
                </label>
              </div>

              {onSetEnableAdaptiveRemediation && (
                <button
                  type="button"
                  onClick={() => onSetEnableAdaptiveRemediation(!enableAdaptiveRemediation)}
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border transition-all ${
                    enableAdaptiveRemediation
                      ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                      : isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}
                >
                  {enableAdaptiveRemediation ? '80/20 Activado' : '80/20 Desactivado'}
                </button>
              )}
            </div>

            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Distribuye las frecuencias generadas dando un <strong className="text-amber-400">80% de prioridad</strong> a tu zona espectral con menor acierto y un <strong className="text-cyan-400">20% al resto</strong> del espectro:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {/* Option: Auto */}
              <div
                onClick={() => onSetFocusMode && onSetFocusMode('auto')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  focusMode === 'auto'
                    ? isDark
                      ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-cyan-50 border-cyan-600 text-cyan-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Auto-Detección</span>
                  {focusMode === 'auto' && <Check className="w-3 h-3 text-cyan-500" />}
                </div>
                <p className={`text-[9px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Detecta tus fallas y genera 80% en tu zona débil.
                </p>
              </div>

              {/* Option: Graves (20-250 Hz) */}
              <div
                onClick={() => onSetFocusMode && onSetFocusMode('graves')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  focusMode === 'graves'
                    ? isDark
                      ? 'bg-blue-950/40 border-blue-400 text-blue-300 font-bold'
                      : 'bg-blue-50 border-blue-600 text-blue-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>80% Graves</span>
                  {focusMode === 'graves' && <Check className="w-3 h-3 text-blue-500" />}
                </div>
                <p className={`text-[9px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  20 - 250 Hz (80% bajas, 20% medias/altas).
                </p>
              </div>

              {/* Option: Medios */}
              <div
                onClick={() => onSetFocusMode && onSetFocusMode('medios')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  focusMode === 'medios'
                    ? isDark
                      ? 'bg-emerald-950/40 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>80% Medios</span>
                  {focusMode === 'medios' && <Check className="w-3 h-3 text-emerald-500" />}
                </div>
                <p className={`text-[9px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  250 - 4,000 Hz (80% medios, 20% resto).
                </p>
              </div>

              {/* Option: Equilibrado */}
              <div
                onClick={() => onSetFocusMode && onSetFocusMode('balanced')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  focusMode === 'balanced'
                    ? isDark
                      ? 'bg-amber-950/40 border-amber-400 text-amber-300 font-bold'
                      : 'bg-amber-50 border-amber-600 text-amber-950 font-bold'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Equilibrado</span>
                  {focusMode === 'balanced' && <Check className="w-3 h-3 text-amber-500" />}
                </div>
                <p className={`text-[9px] font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  100% espectro uniforme sin sesgo ponderado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 border-t relative z-10 font-mono shrink-0 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handleResetDefaults}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Valores por Defecto</span>
            </button>
            <span className={`text-[10px] hidden md:inline ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
              {getBuildIdentifier()}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4 text-black stroke-[2.5]" />
            <span>GUARDAR Y CERRAR</span>
          </button>
        </div>
      </div>
    </div>
  );
};

