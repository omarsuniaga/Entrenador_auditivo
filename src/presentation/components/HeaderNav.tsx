/**
 * Presentation Component: HeaderNav
 * Global navigation, mode selection, audio engine status, and mobile overlay hamburger menu.
 * Hamburger menu requirements:
 * 1. Configuración -> Modo Dark/Light
 * 2. Reportes
 * 3. Specs
 * 4. Descargar PWA (con soporte web manifest & instalación nativa)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  Users,
  BarChart3,
  Trophy,
  Code2,
  FlaskConical,
  Headphones,
  Menu,
  X,
  Sun,
  Moon,
  Download,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAudioProfile } from '../context/AudioProfileContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { getAppVersion, getFullVersionLabel } from '../../shared/version';

export type AppTab = 'training' | 'multiplayer' | 'ranking' | 'reports' | 'specs' | 'tests';

interface HeaderNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isAudioActive?: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  onTabChange,
  isAudioActive = false
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { profileId, profile, toggleProfile, isMobileSpeakerMode } = useAudioProfile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);

  // Lock background scroll when hamburger menu or PWA modal is active
  useScrollLock(isMobileMenuOpen || showPwaModal);

  // Catch PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPwaInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleSelectTab = (tab: AppTab) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowPwaModal(true);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={`w-full sticky top-0 z-40 backdrop-blur-md border-b transition-colors ${isDark
        ? 'bg-[#0A0D14]/90 border-white/5 text-slate-200'
        : 'bg-white/90 border-slate-200 text-slate-800 shadow-sm'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Logo & Brand */}
            <div
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => handleSelectTab('training')}
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.5)] text-black font-black text-lg transition-transform group-hover:scale-105">
                <Headphones className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`font-black text-lg tracking-tight font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    AUDIOLAB
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full font-mono border ${isDark
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                    }`}>
                    {getAppVersion()}
                  </span>
                </div>
                <p className={`text-[11px] font-mono hidden xs:block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  CALIBRACIÓN AUDITIVA & DESVIACIÓN HZ
                </p>
              </div>
            </div>

            {/* Desktop Navigation Tabs (Hidden on mobile/tablet screens in favor of hamburger) */}
            <nav className={`hidden lg:flex items-center space-x-2 p-1.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-300'
              }`}>
              <button
                id="nav-training-tab"
                type="button"
                onClick={() => onTabChange('training')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'training'
                  ? isDark
                    ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-cyan-100 border border-cyan-500 text-cyan-950 font-black shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>Entrenamiento</span>
              </button>

              <button
                id="nav-multiplayer-tab"
                type="button"
                onClick={() => onTabChange('multiplayer')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'multiplayer'
                  ? isDark
                    ? 'bg-purple-500/20 border border-purple-500/60 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : 'bg-purple-100 border border-purple-500 text-purple-950 font-black shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Duelo Multijugador</span>
              </button>

              <button
                id="nav-reports-tab"
                type="button"
                onClick={() => onTabChange('reports')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'reports'
                  ? isDark
                    ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-emerald-100 border border-emerald-500 text-emerald-950 font-black shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Reportes</span>
              </button>

              <button
                id="nav-ranking-tab"
                type="button"
                onClick={() => onTabChange('ranking')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'ranking'
                  ? isDark ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300' : 'bg-amber-100 border border-amber-500 text-amber-950 font-black shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span>Ranking</span>
              </button>

              <button
                id="nav-specs-tab"
                type="button"
                onClick={() => onTabChange('specs')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'specs'
                  ? isDark
                    ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                    : 'bg-amber-100 border border-amber-500 text-amber-950 font-black shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <Code2 className="w-4 h-4 shrink-0" />
                <span>Specs</span>
              </button>

              <button
                id="nav-tests-tab"
                type="button"
                onClick={() => onTabChange('tests')}
                className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'tests'
                  ? isDark
                    ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-cyan-100 border border-cyan-500 text-cyan-950 font-black shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                  }`}
              >
                <FlaskConical className="w-4 h-4 shrink-0" />
                <span>Tests (Suite)</span>
              </button>
            </nav>

            {/* Right side actions: Device Profile + Theme Toggle + Engine Status Badge + Hamburger Trigger */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Device Profile Quick Toggle */}
              <button
                id="header-output-profile-toggle-btn"
                type="button"
                onClick={toggleProfile}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${isMobileSpeakerMode
                  ? isDark
                    ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300 shadow-sm'
                  : isDark
                    ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300 shadow-sm'
                  }`}
                title={`Dispositivo actual: ${profile.nameEs} (${profile.minHz}-${profile.maxHz} Hz). Clic para alternar.`}
              >
                {isMobileSpeakerMode ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">{profile.shortLabel}</span>
                    <span className="text-[10px] font-mono opacity-80">≥130Hz</span>
                  </>
                ) : (
                  <>
                    <Headphones className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">{profile.shortLabel}</span>
                    <span className="text-[10px] font-mono opacity-80">20Hz-20k</span>
                  </>
                )}
              </button>

              {/* Desktop Theme Toggle Switch */}
              <button
                id="desktop-theme-toggle-btn"
                type="button"
                onClick={toggleTheme}
                className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-amber-300 border-amber-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300 shadow-sm'
                  }`}
                title={`Cambiar a modo ${isDark ? 'Light' : 'Dark'}`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  </>
                )}
              </button>


              {/* Engine Status Badge */}
              <div className={`hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full font-mono border ${isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}>
                <span className={`w-2 h-2 rounded-full ${isAudioActive ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                <span className="font-bold">WEB</span>
              </div>

              {/* Hamburger Button for Mobile / Tablet */}
              <button
                id="hamburger-menu-toggle-btn"
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`lg:hidden p-2.5 rounded-2xl border flex items-center justify-center transition-all cursor-pointer min-w-[44px] min-h-[44px] shadow-md ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
                  }`}
                aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú principal'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 text-cyan-400" />
                ) : (
                  <Menu className={`w-6 h-6 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hamburger Overlay Menu (Exact 4 options requested by user) - Fully Scrollable */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden overflow-y-auto flex flex-col justify-start">
            {/* Backdrop Blur Layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Menu Modal / Drawer Container with touch scroll support */}
            <motion.div
              initial={{ y: -30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`relative z-10 w-full max-w-lg mx-auto border-b shadow-2xl p-5 space-y-4 rounded-b-3xl font-mono max-h-[88vh] overflow-y-auto overscroll-contain transition-colors ${isDark
                ? 'bg-[#0A0D14] border-cyan-500/30 text-white shadow-[0_20px_50px_rgba(0,0,0,0.9)]'
                : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.18)]'
                }`}
            >
              {/* Header inside overlay */}
              <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'
                }`}>
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center text-black font-black">
                    <Headphones className="w-4 h-4 text-black" />
                  </div>
                  <div>
                    <span className={`text-sm font-black block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      MENÚ PRINCIPAL
                    </span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                      {getFullVersionLabel()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`p-2 rounded-xl border cursor-pointer ${isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Options in Hamburger: EXACTLY the 4 requested items */}
              <div className="space-y-2.5">
                {/* 0. Dispositivo de Salida Acústica */}
                <div className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${isDark
                  ? 'bg-black/50 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                  : 'bg-cyan-50/80 border-cyan-300 shadow-sm'
                  }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-900'
                      }`}>
                      {isMobileSpeakerMode ? <Smartphone className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Dispositivo de Audio
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                        {profile.shortLabel} <strong className="text-cyan-600 dark:text-cyan-400">({profile.minHz}-{profile.maxHz >= 1000 ? `${profile.maxHz / 1000}k` : `${profile.maxHz}`}Hz)</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    id="hamburger-profile-toggle-btn"
                    type="button"
                    onClick={toggleProfile}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer active:scale-95 ${isMobileSpeakerMode
                      ? isDark ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-cyan-600 text-white border-cyan-700 shadow-sm'
                      : isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-600 text-white border-purple-700 shadow-sm'
                      }`}
                  >
                    {isMobileSpeakerMode ? 'Pasar a Estudio' : 'Pasar a Móvil'}
                  </button>
                </div>

                {/* 1. Configuración -> Modo Dark/Light */}
                <div className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${isDark
                  ? 'bg-black/50 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                  : 'bg-amber-50/80 border-amber-300 shadow-sm'
                  }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-900'
                      }`}>
                      {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Configuración de Tema
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                        Modo actual: <strong className="uppercase text-cyan-600 dark:text-cyan-400">{theme}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Interactive Toggle Switch */}
                  <button
                    id="hamburger-dark-light-toggle-btn"
                    type="button"
                    onClick={toggleTheme}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer active:scale-95 ${isDark
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-slate-900 text-amber-300 border-slate-800 hover:bg-black shadow-sm'
                      }`}
                  >
                    {isDark ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Activar Light</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Activar Dark</span>
                      </>
                    )}
                  </button>
                </div>


                {/* 2. Reportes */}
                <button
                  id="hamburger-reports-btn"
                  type="button"
                  onClick={() => handleSelectTab('reports')}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${activeTab === 'reports'
                    ? isDark
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-emerald-100 border-emerald-500 text-emerald-950 font-black shadow-sm'
                    : isDark
                      ? 'bg-black/60 border-white/5 text-slate-300 hover:bg-white/5'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Reportes
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Historial completo, promedios y estadísticas DDA
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
                </button>

                <button
                  id="hamburger-ranking-btn"
                  type="button"
                  onClick={() => handleSelectTab('ranking')}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${activeTab === 'ranking'
                    ? isDark ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-amber-100 border-amber-500 text-amber-950 font-black shadow-sm'
                    : isDark ? 'bg-black/60 border-white/5 text-slate-300 hover:bg-white/5' : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'}`}>
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>Ranking público</span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Mejores resultados de frecuencia</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
                </button>

                {/* 3. Specs */}
                <button
                  id="hamburger-specs-btn"
                  type="button"
                  onClick={() => handleSelectTab('specs')}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${activeTab === 'specs'
                    ? isDark
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                      : 'bg-amber-100 border-amber-500 text-amber-950 font-black shadow-sm'
                    : isDark
                      ? 'bg-black/60 border-white/5 text-slate-300 hover:bg-white/5'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'
                      }`}>
                      <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Specs
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Arquitectura Hexagonal, puertos, adaptadores y fórmulas
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
                </button>

                {/* 4. Suite de Tests & Diagnóstico */}
                <button
                  id="hamburger-tests-btn"
                  type="button"
                  onClick={() => handleSelectTab('tests')}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${activeTab === 'tests'
                    ? isDark
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'bg-cyan-100 border-cyan-500 text-cyan-950 font-black shadow-sm'
                    : isDark
                      ? 'bg-black/60 border-white/5 text-slate-300 hover:bg-white/5'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-800'
                      }`}>
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div>
                      <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Suite de Tests
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Evaluación automatizada, benchmark y diagnóstico WebAudio
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`} />
                </button>

                {/* 5. Descargar PWA */}
                <button
                  id="hamburger-download-pwa-btn"
                  type="button"
                  onClick={handleInstallPwa}
                  className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${isDark
                    ? 'bg-gradient-to-r from-cyan-950/60 to-purple-950/60 border-cyan-500/40 text-cyan-300 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                    : 'bg-gradient-to-r from-cyan-50 to-purple-50 border-cyan-400 text-cyan-950 hover:border-cyan-500 shadow-sm'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500 text-black flex items-center justify-center font-bold shadow-md">
                      <Download className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-sm block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Descargar PWA
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500 text-black font-black uppercase">
                          Offline App
                        </span>
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-cyan-200/80' : 'text-cyan-900 font-medium'}`}>
                        Instalar AudioLab en tu dispositivo o pantalla de inicio
                      </span>
                    </div>
                  </div>
                  <Smartphone className="w-4 h-4 text-cyan-500" />
                </button>
              </div>

              {/* Version info footer in Hamburger menu */}
              <div className={`pt-3 border-t text-center text-[10px] font-mono ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-600'
                }`}>
                <span>{getFullVersionLabel()}</span> • <span>Audio Engine WebAudio API</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PWA Install Guidance Modal - Scrollable and High Contrast */}
      <AnimatePresence>
        {showPwaModal && (
          <div
            id="pwa-guidance-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPwaModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`max-w-md w-full max-h-[90vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl space-y-4 font-mono transition-colors my-auto ${isDark
                ? 'bg-[#0A0D14] border-cyan-500/40 text-white'
                : 'bg-white border-slate-300 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.18)]'
                }`}
            >
              <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/10' : 'border-slate-200'
                }`}>
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500 flex items-center justify-center text-black">
                    <Smartphone className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className={`text-base font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Instalar AudioLab PWA
                    </h3>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Offline Application
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPwaModal(false)}
                  className={`p-1.5 rounded-lg border cursor-pointer ${isDark
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className={`p-3 rounded-xl border ${isDark ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-cyan-50 border-cyan-300 text-cyan-950 font-bold'
                  }`}>
                  <p>✨ Funciona 100% offline y sin latencia.</p>
                </div>
                <p className={isDark ? 'text-slate-300' : 'text-slate-800'}>
                  Para añadir esta app a tu pantalla de inicio:
                </p>
                <ul className={`list-disc list-inside space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  <li><strong>En Chrome / Android / PC:</strong> Pulsa el botón "Instalar" o el icono de descarga en la barra de navegación.</li>
                  <li><strong>En Safari / iPhone / iPad:</strong> Pulsa el botón <strong>Compartir (Share)</strong> y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setShowPwaModal(false)}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase cursor-pointer transition-all shadow-md"
              >
                ENTENDIDO
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
