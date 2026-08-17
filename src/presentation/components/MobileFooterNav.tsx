/**
 * Presentation Component: MobileFooterNav
 * Fixed bottom navigation bar for mobile and tablet devices.
 * User requirement: Exactly 4 options:
 * 1. Entrenar (activa por defecto)
 * 2. Configurar -> Abre "Configuración de Entrenamiento" con Dificultad (1-20 DDA), Duración Tono Muestra, Retención Silencio y Modo de Espectro
 * 3. Duelo -> Duelo Multijugador
 * 4. Métrica -> Métricas e Historial
 */

import React from 'react';
import { Volume2, Sliders, Users, Gauge } from 'lucide-react';
import { AppTab } from './HeaderNav';
import { useTheme } from '../context/ThemeContext';

interface MobileFooterNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenTrainingConfig: () => void;
  onOpenMetrics: () => void;
}

export const MobileFooterNav: React.FC<MobileFooterNavProps> = ({
  activeTab,
  onTabChange,
  onOpenTrainingConfig,
  onOpenMetrics
}) => {
  const { isDark } = useTheme();

  return (
    <nav
      id="mobile-footer-nav"
      aria-label="Navegación Móvil Inferior"
      className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden backdrop-blur-xl border-t px-2 py-1.5 safe-area-inset-bottom transition-colors ${
        isDark
          ? 'bg-[#0A0D14]/95 border-white/10 shadow-[0_-10px_25px_rgba(0,0,0,0.6)]'
          : 'bg-white/95 border-slate-200 shadow-[0_-10px_25px_rgba(0,0,0,0.08)]'
      }`}
    >
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 items-center">
        {/* 1. Entrenar (Activa por defecto) */}
        <button
          id="mobile-footer-training-btn"
          type="button"
          onClick={() => onTabChange('training')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer min-h-[46px] active:scale-95 ${
            activeTab === 'training'
              ? isDark
                ? 'text-cyan-300 bg-cyan-500/15 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                : 'text-cyan-800 bg-cyan-100 font-black shadow-sm'
              : isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            activeTab === 'training'
              ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]'
              : isDark
                ? 'bg-white/5 text-slate-300'
                : 'bg-slate-100 text-slate-600'
          }`}>
            <Volume2 className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono font-bold mt-1 tracking-tight">
            Entrenar
          </span>
        </button>

        {/* 2. Configurar (Abre la Configuración de Entrenamiento) */}
        <button
          id="mobile-footer-config-btn"
          type="button"
          onClick={onOpenTrainingConfig}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer min-h-[46px] active:scale-95 group ${
            isDark
              ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10'
              : 'text-amber-800 hover:text-amber-900 hover:bg-amber-50'
          }`}
          title="Configuración de Entrenamiento"
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-transform group-hover:scale-105 ${
            isDark
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
              : 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm'
          }`}>
            <Sliders className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono font-bold mt-1 tracking-tight">
            Configurar
          </span>
        </button>

        {/* 3. Duelo */}
        <button
          id="mobile-footer-duel-btn"
          type="button"
          onClick={() => onTabChange('multiplayer')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer min-h-[46px] active:scale-95 ${
            activeTab === 'multiplayer'
              ? isDark
                ? 'text-purple-300 bg-purple-500/15 font-bold shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'text-purple-900 bg-purple-100 font-black shadow-sm'
              : isDark
                ? 'text-slate-400 hover:text-white hover:bg-white/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            activeTab === 'multiplayer'
              ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
              : isDark
                ? 'bg-white/5 text-slate-300'
                : 'bg-slate-100 text-slate-600'
          }`}>
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono font-bold mt-1 tracking-tight">
            Duelo
          </span>
        </button>

        {/* 4. Métrica */}
        <button
          id="mobile-footer-metrics-btn"
          type="button"
          onClick={onOpenMetrics}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer min-h-[46px] active:scale-95 group ${
            isDark
              ? 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10'
              : 'text-emerald-800 hover:text-emerald-900 hover:bg-emerald-50'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-transform group-hover:scale-105 ${
            isDark
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm'
          }`}>
            <Gauge className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono font-bold mt-1 tracking-tight">
            Métrica
          </span>
        </button>
      </div>
    </nav>
  );
};
