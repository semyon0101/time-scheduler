import React, { useState } from 'react';
import { 
  Zap, Plus, Layers, CheckCircle2, 
  ChevronDown, HelpCircle 
} from 'lucide-react';

interface HeaderProps {
  dispatcherId: string;
  activePreset: string;
  isOptimizing: boolean;
  onLoadPreset: (preset: string) => void;
  onOptimize: () => void;
  onOpenCreateEngineer: () => void;
  onOpenCreateTask: () => void;
  onResetSession: () => void;
  onNavigateHome?: () => void;
  onToggleHelp?: () => void;
  isHelpActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  dispatcherId,
  activePreset,
  isOptimizing,
  onLoadPreset,
  onOptimize,
  onOpenCreateEngineer,
  onOpenCreateTask,
  onResetSession,
  onNavigateHome,
  onToggleHelp,
  isHelpActive
}) => {
  const [presetDropdown, setPresetDropdown] = useState(false);

  const presets = [
    { id: 'vostok', name: 'Восток (67 заявок, 12 инж)' },
    { id: 'yugovostok', name: 'Юго-восток (84 заявки, 12 инж)' },
    { id: 'yugocentr', name: 'Югоцентр (57 заявок, 11 инж)' }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 sticky top-0 z-30 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onNavigateHome}
            title="Главная страница: быстрый старт"
            className="bg-beeline-yellow hover:bg-yellow-400 text-slate-950 p-2 rounded-xl font-black text-xl flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer"
          >
            <span>B!</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Билайн Бизнес</span>
                <span className="text-beeline-yellow text-[11px] font-semibold px-2 py-0.5 rounded bg-yellow-950/60 border border-yellow-700/40">
                  FSM Dispatcher
                </span>
              </h1>

              {/* Help question mark button (?) */}
              <button
                onClick={onToggleHelp}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                  isHelpActive
                    ? 'bg-beeline-yellow text-slate-950 border-beeline-yellow font-bold shadow-md shadow-yellow-500/20'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
                title="Справка / Руководство эксперта (?)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Диспетчер: <code className="text-slate-300 font-mono text-[11px]">{dispatcherId}</code></span>
              <button 
                onClick={onResetSession}
                title="Сбросить сессию и создать новую"
                className="hover:text-amber-400 underline ml-1 cursor-pointer transition-colors text-[11px]"
              >
                (Новая сессия)
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="relative">
            <button
              onClick={() => setPresetDropdown(!presetDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-beeline-yellow" />
              <span>Датасет: <strong className="text-white capitalize">{activePreset}</strong></span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {presetDropdown && (
              <div className="absolute left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1 text-[10px] text-slate-400 uppercase font-semibold">Выберите сектор</div>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onLoadPreset(p.id);
                      setPresetDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between transition-colors ${
                      activePreset === p.id ? 'text-beeline-yellow font-bold bg-slate-800/60' : 'text-slate-300'
                    }`}
                  >
                    <span>{p.name}</span>
                    {activePreset === p.id && <CheckCircle2 className="w-3.5 h-3.5 text-beeline-yellow" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Engineer in right panel */}
          <button
            onClick={onOpenCreateEngineer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Создать нового инженера через правое меню"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Новый инженер</span>
          </button>

          {/* Add Task in right panel */}
          <button
            onClick={onOpenCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            title="Создать новую задачу через правое меню"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Новая задача</span>
          </button>

          {/* Run Optimization */}
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer ${
              isOptimizing 
                ? 'bg-yellow-600/50 text-slate-300 cursor-not-allowed' 
                : 'bg-beeline-yellow hover:bg-yellow-400 text-slate-950 hover:shadow-yellow-500/20 shadow-sm'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 fill-current ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Оптимизация...' : '⚡ Распланировать'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
