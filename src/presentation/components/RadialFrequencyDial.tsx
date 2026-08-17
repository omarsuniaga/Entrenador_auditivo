/**
 * Presentation Component: RadialFrequencyDial (Manilla Giratoria de Sintonización Acústica)
 * Studio-Grade Infinite Rotary Dial / Radial Knob calibrated for pure ear training.
 *
 * Replaces vertical linear fader with an infinite continuous circular rotary knob:
 * - Clockwise rotation (Giro a la derecha ↻): Increases acoustic frequency (+Agudo).
 * - Counter-clockwise rotation (Giro a la izquierda ↺): Decreases acoustic frequency (-Grave).
 * - Infinite rotation: Eliminates screen boundary limits (drags in endless continuous circles).
 * - Multi-gear sensitivity: Grueso (3x), Normal (1x), Fino (0.2x), Milimétrico (0.05x).
 * - High-contrast Light Mode & Dark Mode studio aesthetic.
 * - Tangential mouse drag, touch dial tracking, mouse wheel micro-scroll, and keyboard shortcuts.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCw,
  RotateCcw,
  CheckCircle,
  Activity,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  Clock,
  Settings2,
  Gauge,
  Sliders,
  Radio,
  ChevronsRight,
  ChevronsLeft,
  ChevronRight,
  ChevronLeft,
  X,
  MousePointer
} from 'lucide-react';
import { hzToLogSliderValue, logSliderValueToHz, formatHertz } from '../../shared/utils/audioMath';
import { TrainingPhase } from '../hooks/useTrainingEngine';
import { useTheme } from '../context/ThemeContext';

export interface RadialFrequencyDialProps {
  currentHz: number;
  sliderPos: number; // 0 to 1 (logarithmic normalized position)
  onSliderChange: (pos: number) => void;
  onAdjustHz: (deltaHz: number) => void;
  onStopPreview: () => void;
  onSubmit: () => void;
  onPlayTargetTone?: () => void;
  isMuted: boolean;
  onToggleMute: (muted: boolean) => void;
  previewEnabled?: boolean;
  activeMinHz?: number;
  activeMaxHz?: number;
  disabled?: boolean;
  autoSubmitOnRelease?: boolean;
  submitOnRelease?: boolean;
  trainingPhase?: TrainingPhase;
  sampleRemainingSec?: number;
  retentionRemainingSec?: number;
  sampleDurationSec?: number;
  retentionWaitSec?: number;
  onSetRetentionWaitSec?: (sec: number) => void;
  onSetSampleDurationSec?: (sec: number) => void;
  onSetSubmitOnRelease?: (enabled: boolean) => void;
  onOpenSettings?: () => void;
}

type GearRatio = 'coarse' | 'normal' | 'fine' | 'micro';

const GEAR_CONFIG: Record<GearRatio, { label: string; multiplier: number; desc: string }> = {
  coarse: { label: 'Grueso (3x)', multiplier: 3.0, desc: 'Recorrido rápido por octavas' },
  normal: { label: 'Normal (1x)', multiplier: 1.0, desc: 'Sintonización balanceada' },
  fine: { label: 'Fino (0.2x)', multiplier: 0.22, desc: 'Ajuste de precisión semitonal' },
  micro: { label: 'Micro (0.05x)', multiplier: 0.05, desc: 'Calibración milimétrica en cents' }
};

export const RadialFrequencyDial: React.FC<RadialFrequencyDialProps> = ({
  currentHz,
  sliderPos,
  onSliderChange,
  onAdjustHz,
  onStopPreview,
  onSubmit,
  onPlayTargetTone,
  isMuted,
  onToggleMute,
  previewEnabled = true,
  activeMinHz = 20,
  activeMaxHz = 20000,
  disabled = false,
  autoSubmitOnRelease,
  submitOnRelease = false,
  trainingPhase = 'TUNING_READY',
  sampleRemainingSec = 0,
  retentionRemainingSec = 0,
  sampleDurationSec = 4,
  retentionWaitSec = 5,
  onSetRetentionWaitSec,
  onSetSampleDurationSec,
  onSetSubmitOnRelease,
  onOpenSettings
}) => {
  const { isDark } = useTheme();
  const dialCardRef = useRef<HTMLDivElement | null>(null);
  const dialContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [gear, setGear] = useState<GearRatio>('normal');
  const [totalRotationDeg, setTotalRotationDeg] = useState<number>(0);
  const [recentDirection, setRecentDirection] = useState<'cw' | 'ccw' | null>(null);
  const [isSensitivityModalOpen, setIsSensitivityModalOpen] = useState<boolean>(false);

  // References for continuous drag tracking
  const lastAngleRef = useRef<number | null>(null);
  const sliderPosRef = useRef<number>(sliderPos);
  const wheelAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync ref with prop
  useEffect(() => {
    sliderPosRef.current = sliderPos;
  }, [sliderPos]);

  // Clean wheel timeout
  useEffect(() => {
    return () => {
      if (wheelAudioTimeoutRef.current) {
        clearTimeout(wheelAudioTimeoutRef.current);
      }
    };
  }, []);

  const effectiveSubmitOnRelease = autoSubmitOnRelease !== undefined ? autoSubmitOnRelease : submitOnRelease;
  const isTuningAllowed = trainingPhase === 'TUNING_READY' && !disabled;

  /**
   * Applies angular delta to frequency and visual knob rotation
   */
  const applyAngleDelta = useCallback((deltaRadians: number) => {
    if (!isTuningAllowed) return;

    const deltaDeg = (deltaRadians * 180) / Math.PI;
    setTotalRotationDeg((prev) => prev + deltaDeg);
    setRecentDirection(deltaDeg > 0 ? 'cw' : 'ccw');

    // Multiplier based on current gear
    const gearMultiplier = GEAR_CONFIG[gear].multiplier;

    // A standard full 360 degree rotation (2*PI rad) traverses 0.28 of the normalized logarithmic spectrum at 1x
    const normalizedDelta = (deltaRadians / (2 * Math.PI)) * 0.28 * gearMultiplier;

    const newPos = Math.max(0, Math.min(1, sliderPosRef.current + normalizedDelta));
    sliderPosRef.current = newPos;
    onSliderChange(newPos);
  }, [isTuningAllowed, gear, onSliderChange]);

  /**
   * Non-passive Wheel Event Listener attached STRICTLY to the rotary dial container element.
   * When cursor is directly over the rotary knob, it alters frequency smoothly without scrolling the page.
   * When cursor is outside the rotary knob, mouse wheel scrolls the page normally and does not alter frequency.
   */
  useEffect(() => {
    const dialEl = dialContainerRef.current;
    if (!dialEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (!isTuningAllowed) return;
      // Prevent window scroll only when the mouse cursor is over the dial
      e.preventDefault();
      e.stopPropagation();

      // Delta: deltaY < 0 is scroll up / forward (increase freq), deltaY > 0 is scroll down / back (decrease freq)
      const direction = e.deltaY < 0 ? 1 : -1;
      const stepRad = direction * 0.09 * (Math.abs(e.deltaY) > 40 ? 1.4 : 0.85);

      applyAngleDelta(stepRad);

      // Stop preview tone after scrolling stops
      if (wheelAudioTimeoutRef.current) {
        clearTimeout(wheelAudioTimeoutRef.current);
      }
      wheelAudioTimeoutRef.current = setTimeout(() => {
        onStopPreview();
      }, 400);
    };

    dialEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      dialEl.removeEventListener('wheel', handleNativeWheel);
    };
  }, [isTuningAllowed, applyAngleDelta, onStopPreview]);

  /**
   * Pointer Down - Starts circular rotary tracking
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTuningAllowed) return;

    const rect = dialContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initialAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    lastAngleRef.current = initialAngle;
    setIsDragging(true);

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  /**
   * Pointer Move - Calculates continuous delta angle with wrap-around protection
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || lastAngleRef.current === null || !isTuningAllowed) return;

    const rect = dialContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    let deltaAngle = currentAngle - lastAngleRef.current;

    // Handle wrap-around across -PI / +PI boundary
    if (deltaAngle > Math.PI) {
      deltaAngle -= 2 * Math.PI;
    } else if (deltaAngle < -Math.PI) {
      deltaAngle += 2 * Math.PI;
    }

    applyAngleDelta(deltaAngle);
    lastAngleRef.current = currentAngle;
  };

  /**
   * Pointer Up / Cancel - Ends dragging and handles submit if auto-submit on release is on
   */
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    lastAngleRef.current = null;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }

    onStopPreview();

    if (effectiveSubmitOnRelease && isTuningAllowed) {
      onSubmit();
    }
  };

  /**
   * Keyboard Shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTuningAllowed) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rad = e.shiftKey ? 0.35 : 0.12;
        applyAngleDelta(rad);
        setTimeout(onStopPreview, 250);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        const rad = e.shiftKey ? -0.35 : -0.12;
        applyAngleDelta(rad);
        setTimeout(onStopPreview, 250);
      } else if (e.key === ' ' && onPlayTargetTone) {
        e.preventDefault();
        onPlayTargetTone();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTuningAllowed, applyAngleDelta, onStopPreview, onPlayTargetTone, onSubmit]);

  // Step buttons delta adjustments
  const handleStepHz = (delta: number) => {
    if (!isTuningAllowed) return;
    onAdjustHz(delta);
    setRecentDirection(delta > 0 ? 'cw' : 'ccw');
    setTotalRotationDeg((prev) => prev + (delta > 0 ? 18 : -18));
    setTimeout(onStopPreview, 350);
  };

  // Dial aesthetic calculations
  const knobAngleDeg = totalRotationDeg % 360;
  const normalizedPercentage = Math.round(sliderPos * 100);

  return (
    <div
      ref={dialCardRef}
      className={`w-full rounded-3xl p-5 sm:p-7 border shadow-2xl flex flex-col justify-between space-y-4 transition-colors relative overflow-hidden ${isDark
        ? 'bg-[#0A0D14] border-white/10 text-slate-200 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
        : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
        }`}
    >
      {/* Top Header: Title, Sensitivity Modal Icon Button, Reescuchar, and Live/Mute */}
      <div className="w-full flex items-center justify-between border-b pb-3.5 relative z-10 border-white/5">
        <div className="flex items-center space-x-2.5">
          {/* Button to open Sensitivity and Dial Settings Modal (as requested by user) */}
          <button
            type="button"
            onClick={() => setIsSensitivityModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border flex items-center space-x-1.5 transition-all cursor-pointer group ${isDark
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
              : 'bg-cyan-50 text-cyan-700 border-cyan-400 hover:bg-cyan-100 shadow-sm'
              }`}
            title="Abrir configuración de sensibilidad del giro y opciones"
          >
            <Sliders className="w-4 h-4 rotate-90 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
              {GEAR_CONFIG[gear].label}
            </span>
          </button>


        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Re-listen Tone Button */}
          {onPlayTargetTone && (
            <button
              type="button"
              onClick={onPlayTargetTone}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${isDark
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                : 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                }`}
              title="Volver a escuchar el tono de muestra (Espacio)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleMute(!isMuted)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${isMuted
              ? isDark
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-rose-100 text-rose-800 border-rose-300'
              : isDark
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-cyan-100 text-cyan-800 border-cyan-300'
              }`}
            title={isMuted ? 'Audio de sintonización silenciado' : 'Audio de sintonización activo'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Radial Dial Interactive Area (Positioned directly at the top to match TonePlayer's circle) */}
      <div className="flex flex-col items-center justify-center my-auto py-2 z-10 w-full relative select-none">
        {/* ROTARY WHEEL CONTAINER */}
        <div
          ref={dialContainerRef}
          id="infinite-radial-frequency-knob"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          tabIndex={0}
          role="slider"
          aria-label="Sintonizador de Frecuencia Radial Infinito"
          aria-valuemin={activeMinHz}
          aria-valuemax={activeMaxHz}
          aria-valuenow={currentHz}
          className={`relative w-56 h-56 sm:w-72 sm:h-72 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none transition-transform focus:outline-none focus:ring-4 focus:ring-cyan-500/40 ${!isTuningAllowed ? 'opacity-40 pointer-events-none' : ''
            }`}
        >
          {/* Outer Ring with Laser-Engraved Ticks & Glowing Arc */}
          <div className={`absolute inset-0 rounded-full border-4 transition-colors ${isDark
            ? 'border-slate-800 bg-gradient-to-b from-[#121826] to-[#080b12] shadow-[inset_0_0_30px_rgba(0,0,0,0.9),0_0_30px_rgba(6,182,212,0.15)]'
            : 'border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 shadow-[inset_0_0_20px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.1)]'
            }`}>
            {/* 36 Radial Notches / Graduation Ticks (every 10 degrees) */}
            {Array.from({ length: 36 }).map((_, i) => {
              const deg = i * 10;
              const isMajor = i % 3 === 0;
              const isCardinal = i % 9 === 0;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 origin-left pointer-events-none"
                  style={{
                    transform: `rotate(${deg}deg) translate(${isCardinal ? '112px' : isMajor ? '116px' : '120px'}, -50%)`
                  }}
                >
                  <div
                    className={`rounded-full ${isCardinal
                      ? isDark ? 'w-4 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'w-4 h-1 bg-cyan-600'
                      : isMajor
                        ? isDark ? 'w-3 h-0.5 bg-slate-400' : 'w-3 h-0.5 bg-slate-600'
                        : isDark ? 'w-1.5 h-0.5 bg-slate-700' : 'w-1.5 h-0.5 bg-slate-400'
                      }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Rotating Milled Aluminum Knob Body */}
          <div
            className={`w-44 h-44 sm:w-54 sm:h-54 rounded-full relative flex items-center justify-center transition-transform duration-75 shadow-2xl ${isDark
              ? 'bg-gradient-to-br from-[#1e2738] via-[#101622] to-[#090d15] border-2 border-white/15'
              : 'bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 border-slate-300'
              }`}
            style={{
              transform: `rotate(${knobAngleDeg}deg)`,
              boxShadow: isDark
                ? '0 12px 35px rgba(0,0,0,0.8), inset 0 2px 6px rgba(255,255,255,0.2), inset 0 -4px 10px rgba(0,0,0,0.6)'
                : '0 12px 30px rgba(0,0,0,0.15), inset 0 2px 5px rgba(255,255,255,0.9), inset 0 -4px 8px rgba(0,0,0,0.1)'
            }}
          >
            {/* Knurled Grip Texture on the Knob Edge */}
            <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/20 pointer-events-none opacity-40" />

            {/* Recessed Tactile Finger Handle / Notch with Luminescent Indicator */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
              {/* Needle pointer */}
              <div className="w-1.5 h-5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] animate-pulse" />
              {/* Tactile finger divot */}
              <div className={`w-6 h-6 rounded-full mt-1 border-2 flex items-center justify-center ${isDark
                ? 'bg-black/60 border-cyan-400/40 shadow-inner'
                : 'bg-slate-200 border-cyan-600/50 shadow-inner'
                }`}>
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,1)]" />
              </div>
            </div>

            {/* Central Brushed Hub with State Icon */}
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center pointer-events-none border text-center shadow-lg transition-colors ${isDark
              ? 'bg-[#0b0f19] border-white/10 text-white'
              : 'bg-white border-slate-300 text-slate-800'
              }`}>
              {isDragging ? (
                <Activity className="w-6 h-6 text-cyan-400 animate-spin" />
              ) : (
                <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500" />
              )}
              <span className="text-[8px] sm:text-[9px] font-mono font-bold mt-1 text-cyan-400 tracking-wider">
                {isDragging ? 'GIRANDO...' : 'GIRAR AQUÍ'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTIONS PLACED BELOW THE ROTARY DIAL */}
      <div className="w-full space-y-3 pt-6  z-10">
        {/* Instruction & Functionality Banner */}
        {/* Main Submit / Compare Button */}
        <div>
          <button
            id="submit-frequency-guess-btn"
            type="button"
            onClick={onSubmit}
            disabled={!isTuningAllowed}
            className={`w-full py-3.5 rounded-2xl font-mono font-black text-sm uppercase tracking-wider transition-all duration-200 flex items-center justify-center space-x-2 shadow-xl cursor-pointer ${isTuningAllowed
              ? 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400 text-black hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_30px_rgba(6,182,212,0.4)]'
              : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed opacity-50'
              }`}
          >
            <Zap className="w-5 h-5 fill-black" />
            <span>COMPARAR </span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-6 gap-2 font-mono text-xs">

        <button
          type="button"
          onClick={() => handleStepHz(-100)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-purple-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Salto Grande Hacia Graves"
        >
          <span className="text-[10px] sm:text-[11px]">◀◀◀</span>
        </button>

        <button
          type="button"
          onClick={() => handleStepHz(-10)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-purple-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Paso Medio Hacia Graves"
        >
          <span className="text-[10px] sm:text-[11px]">◀◀</span>
        </button>

        <button
          type="button"
          onClick={() => handleStepHz(-1)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-purple-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Micro-Ajuste Fino Hacia Graves"
        >
          <span className="text-[10px] sm:text-[11px] text-purple-400">◀</span>
        </button>

        <button
          type="button"
          onClick={() => handleStepHz(1)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-cyan-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Micro-Ajuste Fino Hacia Agudos"
        >
          <span className="text-[10px] sm:text-[11px] text-cyan-400">▶</span>
        </button>

        <button
          type="button"
          onClick={() => handleStepHz(10)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-cyan-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Paso Medio Hacia Agudos"
        >
          <span className="text-[10px] sm:text-[11px]">▶▶</span>
        </button>

        <button
          type="button"
          onClick={() => handleStepHz(100)}
          disabled={!isTuningAllowed}
          className={`py-1.5 px-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 ${isDark
            ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-cyan-500/40'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          title="Salto Grande Hacia Agudos"
        >
          <span className="text-[10px] sm:text-[11px]">▶▶▶</span>
        </button>
      </div>



      {/* SENSITIVITY & DIAL SETTINGS MODAL */}
      {isSensitivityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl flex flex-col space-y-5 transition-all ${isDark
            ? 'bg-[#0E131F] border-cyan-500/30 text-slate-200 shadow-[0_0_60px_rgba(6,182,212,0.2)]'
            : 'bg-white border-slate-300 text-slate-900 shadow-2xl'
            }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${isDark
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-cyan-50 text-cyan-700 border border-cyan-300'
                  }`}>
                  <Sliders className="w-4 h-4 rotate-90" />
                </div>
                <div>
                  <h3 className="text-sm font-black font-mono tracking-wider uppercase">
                    SENSIBILIDAD DEL GIRO
                  </h3>
                  <p className="text-[11px] font-mono text-cyan-400">
                    Ajuste de respuesta del sintonizador
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSensitivityModalOpen(false)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                  }`}
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gear Ratio Selector Cards */}
            <div className="space-y-2 font-mono text-xs">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Selecciona la velocidad de rotación:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GEAR_CONFIG) as GearRatio[]).map((gKey) => {
                  const isSelected = gear === gKey;
                  return (
                    <button
                      key={gKey}
                      type="button"
                      onClick={() => setGear(gKey)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${isSelected
                        ? isDark
                          ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                          : 'bg-cyan-50 border-cyan-500 text-slate-900 shadow-sm ring-1 ring-cyan-500'
                        : isDark
                          ? 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10 hover:text-white'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-black text-xs uppercase">{GEAR_CONFIG[gKey].label}</span>
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <span className={`text-[10px] leading-tight ${isSelected ? (isDark ? 'text-cyan-300' : 'text-cyan-800 font-medium') : 'text-slate-500'}`}>
                        {GEAR_CONFIG[gKey].desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guide & Controls Reference */}
            <div className={`p-3.5 rounded-2xl border space-y-2 font-mono text-[11px] ${isDark ? 'bg-black/40 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
              <span className="font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
                <MousePointer className="w-3.5 h-3.5" />
                <span>Control con Rueda del Ratón:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                • Coloca el cursor <strong className="text-cyan-300">directamente sobre el disco giratorio</strong> para ajustar la frecuencia con la rueda del ratón sin hacer scroll.
              </p>
              <p className="text-[11px] leading-relaxed">
                • Al retirar el cursor del disco, la rueda del ratón vuelve a su comportamiento normal para desplazarte por la página.
              </p>
            </div>

            {/* Close / Apply button */}
            <button
              type="button"
              onClick={() => setIsSensitivityModalOpen(false)}
              className="w-full py-3 rounded-2xl font-mono font-black text-xs uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg transition-all cursor-pointer"
            >
              ACEPTAR Y CONTINUAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
