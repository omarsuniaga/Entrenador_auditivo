/**
 * Main Application Root
 * Assembles presentation modules according to Hexagonal Architecture.
 * Includes responsive desktop & mobile navigation with a fixed mobile footer and overlay hamburger menu.
 */

import React, { useState, useEffect } from 'react';
import { HeaderNav, AppTab } from './presentation/components/HeaderNav';
import { MobileFooterNav } from './presentation/components/MobileFooterNav';
import { TrainingView } from './presentation/components/TrainingView';
import { MultiplayerView } from './presentation/components/MultiplayerView';
import { ProgressReportView } from './presentation/components/ProgressReportView';
import { TechnicalSpecsView } from './presentation/components/TechnicalSpecsView';
import { DiagnosticTestSuiteView } from './presentation/components/DiagnosticTestSuiteView';
import { PublicRankingView } from './presentation/components/PublicRankingView';
import { MetricsModal } from './presentation/components/MetricsModal';
import { LocalStorageAdapter } from './infrastructure/storage/LocalStorageAdapter';
import { TrainingSession } from './core/entities/TrainingSession';
import { useTheme } from './presentation/context/ThemeContext';

const storageAdapter = new LocalStorageAdapter();

export default function App() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<AppTab>('training');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isGlobalMetricsOpen, setIsGlobalMetricsOpen] = useState<boolean>(false);
  const [isExternalConfigOpen, setIsExternalConfigOpen] = useState<boolean>(false);

  // Load historical sessions
  const loadSessions = async () => {
    const loaded = await storageAdapter.getSessions();
    setSessions(loaded);
  };

  useEffect(() => {
    loadSessions();
  }, [activeTab, isGlobalMetricsOpen]);

  const handleClearHistory = async () => {
    await storageAdapter.clearHistory();
    setSessions([]);
  };

  const handleOpenTrainingConfig = () => {
    if (activeTab !== 'training') {
      setActiveTab('training');
    }
    setIsExternalConfigOpen(true);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-black antialiased relative transition-colors ${isDark ? 'bg-[#05070A] text-slate-200' : 'bg-slate-50 text-slate-900'
      }`}>
      {/* Ambient background grid / glow */}
      <div className={`fixed inset-0 pointer-events-none -z-10 transition-opacity ${isDark
        ? 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))]'
        : 'bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.08),rgba(0,0,0,0))]'
        }`} />

      {/* Global Header & Nav (with responsive hamburger overlay) */}
      <HeaderNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area (pb-24 ensures it sits cleanly above fixed bottom mobile footer) */}
      <main className="flex-1 pb-24 lg:pb-12">
        {activeTab === 'training' && (
          <TrainingView
            onViewReports={() => setActiveTab('reports')}
            isExternalConfigOpen={isExternalConfigOpen}
            onCloseExternalConfig={() => setIsExternalConfigOpen(false)}
          />
        )}

        {activeTab === 'multiplayer' && (
          <MultiplayerView />
        )}

        {activeTab === 'ranking' && <PublicRankingView />}

        {activeTab === 'reports' && (
          <ProgressReportView
            sessions={sessions}
            onClearHistory={handleClearHistory}
            onStartSession={() => setActiveTab('training')}
          />
        )}

        {activeTab === 'specs' && (
          <TechnicalSpecsView />
        )}

        {activeTab === 'tests' && (
          <DiagnosticTestSuiteView />
        )}
      </main>

      {/* Global Metrics Modal Triggerable from Mobile Footer or Hamburger */}
      <MetricsModal
        isOpen={isGlobalMetricsOpen}
        onClose={() => setIsGlobalMetricsOpen(false)}
        rounds={[]}
        currentRoundIndex={0}
        totalRounds={0}
        averageAccuracy={0}
        averageDeviationHz={0}
        historySessions={sessions}
        onClearHistory={handleClearHistory}
      />

      {/* Fixed Mobile / Tablet Footer Menu (Entrenar, Configurar, Duelo, Métrica) */}
      <MobileFooterNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenTrainingConfig={handleOpenTrainingConfig}
        onOpenMetrics={() => setIsGlobalMetricsOpen(true)}
      />

      {/* Telemetry Footer (Desktop only or placed above bottom bar) */}
      <footer className={`hidden lg:block border-t py-4 text-xs backdrop-blur-md transition-colors ${isDark ? 'border-white/5 bg-[#0A0D14]/90 text-slate-500' : 'border-slate-200 bg-white/90 text-slate-600 shadow-sm'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              HEX_DOMAIN: <span className="text-cyan-500 font-bold">AUDITORY_CORE_V2</span>
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className={`font-mono text-[11px] hidden sm:inline ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
              ADAPTER: <span className="text-slate-500">WEB_AUDIO_48KHZ</span>
            </span>
          </div>

          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span className={isDark ? 'text-slate-500' : 'text-slate-600'}>
              LATENCIA: <span className="text-emerald-500 font-bold">&lt; 1.2ms</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-cyan-600 font-bold">ENTRENAMIENTO AUDITIVO</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
