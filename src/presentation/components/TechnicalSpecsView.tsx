/**
 * Presentation Component: TechnicalSpecsView
 * Converts user requirements into formal technical specifications,
 * documenting Domain Entities, Hexagonal Architecture (Ports and Adapters),
 * Acoustic & Perceptual formulas, and WebSocket protocols.
 */

import React, { useState } from 'react';
import { Code2, Layers, Cpu, Database, Network, ShieldCheck, Check, Sparkles, BookOpen } from 'lucide-react';

export const TechnicalSpecsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'hexagonal' | 'math' | 'contracts'>('overview');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Code2 className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              Especificaciones Técnicas & Arquitectura Hexagonal
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Diseño arquitectónico formal (Puertos y Adaptadores / Clean Architecture), entidades de dominio y modelos acústicos.
          </p>
        </div>

        <div className="flex rounded-xl bg-black/60 p-1 border border-white/5 font-mono">
          <button
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'overview' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RESUMEN
          </button>
          <button
            onClick={() => setActiveSection('hexagonal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'hexagonal' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CAPAS HEXAGONALES
          </button>
          <button
            onClick={() => setActiveSection('math')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'math' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FÓRMULAS ACÚSTICAS
          </button>
          <button
            onClick={() => setActiveSection('contracts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'contracts' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CONTRATOS
          </button>
        </div>
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>Visión General del Sistema y Requerimientos Funcionales</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              El sistema <strong>AudioFit</strong> está concebido como una plataforma de entrenamiento auditivo
              y calibración espectral de alta precisión. A través de síntesis acústica en tiempo real, el motor
              expone al usuario a estímulos tonales aislados y calcula la desviación física (Hertz) y perceptual
              (Cents musicales), adaptando dinámicamente el nivel de dificultad.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">1. Núcleo de Discriminación</span>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Reproducción no destructiva de frecuencia oculta (f_target).</li>
                  <li>• Control deslizante continuo interactivo con síntesis en vivo (f_user).</li>
                  <li>• Análisis exacto de desviación en Hertz: Δf = f_user - f_target.</li>
                  <li>• Medición de error en Cents: Δc = 1200 · log₂(f_user / f_target).</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">2. Motor Adaptativo & Multijugador</span>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Dificultad dinámica según racha de precisión (&gt;90% asciende nivel).</li>
                  <li>• Desglose por 7 bandas espectrales (Sub-graves a Brillo/Aire).</li>
                  <li>• Duelos multijugador con servidor WebSocket autoritativo.</li>
                  <li>• Generación automática de reportes e informes de calibración.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: HEXAGONAL ARCHITECTURE */}
      {activeSection === 'hexagonal' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span>Estructura de Capas Hexagonal (Ports and Adapters)</span>
            </h3>

            {/* Architecture Visual Diagram */}
            <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 space-y-4 font-mono text-xs">
              {/* Primary Adapters */}
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                <span className="font-bold text-[11px] block uppercase">1. Primary / Driving Adapters (Entrada / UI & WS Client)</span>
                <span className="text-slate-400">React Components, useTrainingEngine, useMultiplayerEngine, Sliders, Radars</span>
              </div>

              {/* Inbound Ports */}
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 ml-4">
                <span className="font-bold text-[11px] block uppercase">2. Inbound Ports (Interfaces de Entrada)</span>
                <span className="text-slate-400">ITrainingUseCase, IMultiplayerUseCase, IAudioPlaybackUseCase</span>
              </div>

              {/* Core Domain */}
              <div className="p-4 rounded-xl bg-emerald-950/50 border-2 border-emerald-500 text-emerald-300 ml-8 shadow-lg shadow-emerald-950">
                <span className="font-bold text-[11px] block uppercase">3. Core Domain Layer (Dominio Central Aislado)</span>
                <div className="text-slate-300 text-[11px] mt-1 grid grid-cols-2 gap-2 font-sans">
                  <div><strong>Entidades:</strong> Frequency, ExerciseRound, DifficultyProfile, TrainingSession, MultiplayerRoom</div>
                  <div><strong>Servicios:</strong> DeviationCalculator, AdaptiveDifficultyEngine, ProgressReportGenerator</div>
                </div>
              </div>

              {/* Outbound Ports */}
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 ml-4">
                <span className="font-bold text-[11px] block uppercase">4. Outbound Ports (Interfaces SPI de Salida)</span>
                <span className="text-slate-400">IAudioSynthesizerPort, IStoragePort, IRealtimeNetworkPort</span>
              </div>

              {/* Secondary Adapters */}
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300">
                <span className="font-bold text-[11px] block uppercase">5. Secondary / Driven Adapters (Infraestructura Concreta)</span>
                <span className="text-slate-400">WebAudioSynthesizerAdapter, LocalStorageAdapter, WebSocketClientAdapter, RoomManager</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                <strong>Principio de Inversión de Dependencias:</strong> El dominio central jamás importa librerías externas
                (ni React, ni Web Audio API, ni bases de datos). Cualquier comunicación hacia el exterior se realiza a través
                de los contratos definidos en <code>ports/outbound</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MATHEMATICAL FORMULAS */}
      {activeSection === 'math' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <span>Fundamentos Físico-Acústicos & Modelos de Precisión</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cents Formula */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-cyan-400 block uppercase">Desviación en Cents Musicales</span>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-slate-100">
                Δc = 1200 · log₂(f_user / f_target)
              </div>
              <p className="text-[11px] text-slate-400">
                Donde 100 cents corresponden a 1 semitono témperado. 1 octava = 1200 cents.
              </p>
            </div>

            {/* Perceptual Accuracy */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 block uppercase">Cálculo de Porcentaje de Precisión</span>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-slate-100">
                P(%) = 100 · exp(-|Δc| / 110)
              </div>
              <p className="text-[11px] text-slate-400">
                Modelo psicofísico derivado de la ley Weber-Fechner para resolución auditiva humana.
              </p>
            </div>

            {/* Log Slider Mapping */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-indigo-400 block uppercase">Mapeo Logarítmico del Slider</span>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-slate-100">
                f(x) = 10^(log₁₀(min) + x · (log₁₀(max) - log₁₀(min)))
              </div>
              <p className="text-[11px] text-slate-400">
                Distribuye equitativamente las octavas a lo largo del recorrido físico del slider (x ∈ [0, 1]).
              </p>
            </div>

            {/* Multiplayer Scoring */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-400 block uppercase">Puntaje Multijugador Autoritativo</span>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-slate-100">
                Score = (Precisión/100 · 1000) + max(0, 300 · (1 - t / T_max))
              </div>
              <p className="text-[11px] text-slate-400">
                Premia simultáneamente la precisión milimétrica y la velocidad de respuesta en milisegundos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: CONTRACTS */}
      {activeSection === 'contracts' && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <span>Contratos de Puertos TypeScript (Interfaces Clave)</span>
          </h3>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto space-y-3">
            <pre className="text-cyan-300">
{`// Port Inbound: ITrainingUseCase
export interface ITrainingUseCase {
  startSession(params: StartTrainingParams): Promise<TrainingSession>;
  playTargetTone(): Promise<void>;
  startPreviewTone(frequencyHz: number): void;
  updatePreviewTone(frequencyHz: number): void;
  stopPreviewTone(): void;
  submitGuess(userHz: number, responseTimeMs: number): Promise<GuessSubmissionResult>;
  nextRound(): ExerciseRound | null;
}

// Port Outbound: IAudioSynthesizerPort
export interface IAudioSynthesizerPort {
  initialize(): Promise<void>;
  playTone(options: ToneOptions): Promise<void>;
  startContinuousTone(frequencyHz: number, volume?: number): void;
  setContinuousFrequency(frequencyHz: number): void;
  stopContinuousTone(): void;
  getAnalyserData(): Uint8Array | null;
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
