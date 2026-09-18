import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDispatcherId, setDispatcherId } from '../api';
import { StateResponse, Task, Engineer } from '../types';
import { Header } from '../components/Header';
import { MetricsCard } from '../components/MetricsCard';
import { MapView } from '../components/MapView';
import { EngineerList } from '../components/EngineerList';
import { EngineerDrawer } from '../components/EngineerDrawer';
import { TaskList } from '../components/TaskList';
import { TaskDrawer } from '../components/TaskDrawer';
import { GlobalTimeline } from '../components/GlobalTimeline';
import { CreatePanel } from '../components/CreatePanel';
import { SkeletonTimeline } from '../components/Skeleton';
import { 
  Users, AlertCircle, Sparkles, CheckCircle2, 
  Map as MapIcon, List, Trash2, XCircle, 
  ClipboardList, HelpCircle, Plus, Search 
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Selection state
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createPanelType, setCreatePanelType] = useState<'task' | 'engineer' | null>(null);

  // Focused travel segment (Point 8: clicking travel segment focuses map path without changing menus)
  const [focusedSegment, setFocusedSegment] = useState<{
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  } | null>(null);

  // Explicit session binding
  const [currentDispatcherId, setCurrentDispatcherId] = useState<string>(() => getDispatcherId());

  // Problematic tab filter and search
  const [problematicSearch, setProblematicSearch] = useState('');
  const [problematicFilter, setProblematicFilter] = useState<'all' | 'urgent' | 'skills' | 'time' | 'transport' | 'new'>('all');

  // Point 8: Help tab as question mark (?) open initially on first page visit
  const [activeTab, setActiveTab] = useState<'engineers' | 'tasks' | 'unassigned' | 'guide'>('guide');

  // Mobile layout view switcher ('map' vs 'sidebar')
  const [mobileView, setMobileView] = useState<'map' | 'sidebar'>('map');

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await api.initSession();
      setState(data);
    } catch (err) {
      console.error('Failed to init session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreset = async (preset: string) => {
    setIsOptimizing(true);
    try {
      const data = await api.loadPreset(preset);
      setState(data);
      setSelectedEngineerId(null);
      setSelectedTaskId(null);
    } catch (err) {
      console.error(`Ошибка загрузки датасета: ${err}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const data = await api.optimize();
      setState(data);
    } catch (err) {
      console.error(`Ошибка оптимизации: ${err}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await api.createTask(taskData);
      const updated = await api.getState();
      setState(updated);
      setCreatePanelType(null);
      setActiveTab('tasks');
    } catch (err) {
      console.error(`Ошибка добавления задачи: ${err}`);
    }
  };

  const handleCreateEngineer = async (engData: Partial<Engineer>) => {
    try {
      await api.createEngineer(engData);
      const updated = await api.getState();
      setState(updated);
      setCreatePanelType(null);
      setActiveTab('engineers');
    } catch (err) {
      console.error(`Ошибка добавления инженера: ${err}`);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const updated = await api.cancelTask(taskId);
      setState(updated);
    } catch (err) {
      console.error(`Ошибка отмены заявки: ${err}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      const updated = await api.getState();
      setState(updated);
    } catch (err) {
      console.error(`Ошибка удаления заявки: ${err}`);
    }
  };

  const handleDeleteEngineer = async (engineerId: string) => {
    try {
      await api.deleteEngineer(engineerId);
      if (selectedEngineerId === engineerId) {
        setSelectedEngineerId(null);
      }
      const updated = await api.getState();
      setState(updated);
    } catch (err) {
      console.error(`Ошибка удаления инженера: ${err}`);
    }
  };

  const handleToggleEngineerStatus = async (engineerId: string) => {
    try {
      const updated = await api.toggleEngineerStatus(engineerId);
      setState(updated);
    } catch (err) {
      console.error(`Ошибка переключения статуса инженера: ${err}`);
    }
  };

  const handleResetSession = async () => {
    const newId = `disp_${Math.random().toString(36).substring(2, 9)}`;
    setDispatcherId(newId);
    setCurrentDispatcherId(newId);
    setSelectedEngineerId(null);
    setSelectedTaskId(null);
    setFocusedSegment(null);
    setCreatePanelType(null);
    setActiveTab('guide');
    setState(null);
    setLoading(true);
    try {
      const data = await api.initSession();
      setState(data);
    } catch (err) {
      console.error('Failed to init session:', err);
    } finally {
      setLoading(false);
    }
  };

  // Nav helpers for selection
  const handleSelectEngineer = (engId: string) => {
    setSelectedTaskId(null);
    setCreatePanelType(null);
    setSelectedEngineerId(engId);
    setMobileView('sidebar');
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedEngineerId(null);
    setCreatePanelType(null);
    setSelectedTaskId(taskId);
    setMobileView('sidebar');
  };

  const selectedRoute = state?.schedule.find((r) => r.engineer_id === selectedEngineerId);
  const selectedEngineer = state?.engineers.find((e) => e.id === selectedEngineerId);
  const selectedTaskObj = state?.tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        dispatcherId={state?.dispatcher_id || currentDispatcherId}
        activePreset={state?.active_preset || 'vostok'}
        isOptimizing={isOptimizing}
        onLoadPreset={handleLoadPreset}
        onOptimize={handleOptimize}
        onOpenCreateEngineer={() => {
          setSelectedEngineerId(null);
          setSelectedTaskId(null);
          setCreatePanelType('engineer');
          setMobileView('sidebar');
        }}
        onOpenCreateTask={() => {
          setSelectedEngineerId(null);
          setSelectedTaskId(null);
          setCreatePanelType('task');
          setMobileView('sidebar');
        }}
        onResetSession={handleResetSession}
        onNavigateHome={() => navigate('/')}
        onToggleHelp={() => {
          setSelectedEngineerId(null);
          setSelectedTaskId(null);
          setCreatePanelType(null);
          setActiveTab(activeTab === 'guide' ? 'engineers' : 'guide');
          setMobileView('sidebar');
        }}
        isHelpActive={activeTab === 'guide' && !selectedEngineerId && !selectedTaskId && !createPanelType}
      />

      {/* Main Container */}
      <main className="flex-1 p-2 md:p-3.5 space-y-2.5 flex flex-col overflow-hidden max-w-[1920px] mx-auto w-full">
        {/* KPI Metrics Hero Bar (with Skeleton loading) */}
        <MetricsCard
          metrics={state?.metrics}
          totalTasks={state?.tasks.filter((t) => t.status !== 'cancelled').length || 0}
          isLoading={loading || isOptimizing}
        />

        {/* Mobile View Switcher (Visible ONLY on small mobile screens) */}
        <div className="flex md:hidden bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mobileView === 'map' ? 'bg-beeline-yellow text-slate-950' : 'text-slate-400'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Карта</span>
          </button>
          <button
            onClick={() => setMobileView('sidebar')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mobileView === 'sidebar' ? 'bg-beeline-yellow text-slate-950' : 'text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Панель управления</span>
          </button>
        </div>

        {/* Main 2-Column Layout: Left Map (7/12) + Right Sidebar (5/12) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-[500px] lg:min-h-[calc(100vh-210px)]">
          {/* Left Column: Map + Global Timeline under Map */}
          <div className={`lg:col-span-7 flex flex-col gap-2.5 ${
            mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'
          }`}>
            {/* Leaflet Map Box */}
            <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 relative flex flex-col shadow-lg min-h-[360px]">
              <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Карта маршрутов
                  </span>
                  {selectedEngineerId && (
                    <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] px-2 py-0.5 rounded font-medium">
                      Фильтр: {selectedEngineer?.name}
                    </span>
                  )}
                  {selectedTaskId && (
                    <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] px-2 py-0.5 rounded font-medium">
                      Заявка #{selectedTaskId}
                    </span>
                  )}
                </div>

                {(selectedEngineerId || selectedTaskId || focusedSegment) && (
                  <button
                    onClick={() => {
                      setSelectedEngineerId(null);
                      setSelectedTaskId(null);
                      setFocusedSegment(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Показать всё
                  </button>
                )}
              </div>

              <div className="flex-1 w-full h-full relative min-h-[300px]">
                {loading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-xs space-y-2">
                    <span className="w-3 h-3 rounded-full bg-beeline-yellow animate-ping" />
                    <span>Загрузка карты и маршрутов...</span>
                  </div>
                ) : (
                  <MapView
                    routes={state?.schedule || []}
                    allTasks={state?.tasks || []}
                    allEngineers={state?.engineers || []}
                    unassignedTasks={state?.unassigned_tasks || []}
                    selectedEngineerId={selectedEngineerId}
                    selectedTaskId={selectedTaskId}
                    focusedSegment={focusedSegment}
                    onSelectEngineer={handleSelectEngineer}
                    onSelectTask={handleSelectTask}
                    onOpenExplanation={handleSelectTask}
                    onCancelTask={handleCancelTask}
                    onDeleteTask={handleDeleteTask}
                    onClearFocusedSegment={() => setFocusedSegment(null)}
                  />
                )}
              </div>
            </div>

            {/* Point 5: Global Timeline (00:00 – 24:00) for EVERY engineer under the map */}
            <div className="shrink-0">
              {loading ? (
                <SkeletonTimeline />
              ) : (
                <GlobalTimeline
                  engineers={state?.engineers || []}
                  routes={state?.schedule || []}
                  tasks={state?.tasks || []}
                  selectedEngineerId={selectedEngineerId}
                  selectedTaskId={selectedTaskId}
                  onSelectEngineer={handleSelectEngineer}
                  onSelectTask={handleSelectTask}
                  onFocusTravelSegment={setFocusedSegment}
                />
              )}
            </div>
          </div>

          {/* Right Column: Menu / Detail Drawers / Creation / Tabs */}
          <div className={`lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-lg overflow-hidden max-h-[calc(100vh-210px)] ${
            mobileView === 'map' ? 'hidden md:flex' : 'flex'
          }`}>
            {/* View 1: Creation Panel (Task or Engineer) */}
            {createPanelType ? (
              <CreatePanel
                type={createPanelType}
                onClose={() => setCreatePanelType(null)}
                onSubmitTask={handleCreateTask}
                onSubmitEngineer={handleCreateEngineer}
              />
            ) : selectedEngineerId ? (
              /* View 2: Selected Engineer Drawer (Timeline 0-24, route explanation, parity actions) */
              <EngineerDrawer
                route={selectedRoute}
                engineer={selectedEngineer}
                tasks={state?.tasks || []}
                onClose={() => setSelectedEngineerId(null)}
                onOpenExplanation={handleSelectTask}
                onSelectTask={handleSelectTask}
                onFocusTravelSegment={setFocusedSegment}
                onCancelTask={handleCancelTask}
                onDeleteEngineer={handleDeleteEngineer}
                onToggleEngineerStatus={handleToggleEngineerStatus}
              />
            ) : selectedTaskId && selectedTaskObj ? (
              /* View 3: Selected Task Drawer (Timeline 0-24, work start/end without travel, parity actions) */
              <TaskDrawer
                task={selectedTaskObj}
                routes={state?.schedule || []}
                onClose={() => setSelectedTaskId(null)}
                onSelectEngineer={handleSelectEngineer}
                onCancelTask={handleCancelTask}
                onDeleteTask={handleDeleteTask}
              />
            ) : (
              /* View 4: Main Tabs Header & Content */
              <>
                {/* Tabs Header */}
                <div className="flex items-center border-b border-slate-800 bg-slate-950/70 p-1 shrink-0">
                  {/* Tab 1: Engineers */}
                  <button
                    onClick={() => setActiveTab('engineers')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'engineers'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Инженеры ({state?.engineers.length || 0})</span>
                  </button>

                  {/* Tab 2: Tasks (Point 4) */}
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'tasks'
                        ? 'bg-slate-800 text-sky-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
                    <span>Заявки ({state?.tasks.length || 0})</span>
                  </button>

                  {/* Tab 3: Unassigned */}
                  <button
                    onClick={() => setActiveTab('unassigned')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === 'unassigned'
                        ? 'bg-slate-800 text-rose-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Проблемные ({state?.unassigned_tasks.length || 0})</span>
                  </button>

                  {/* Tab 4: Guide Question Mark (?) (Point 8) */}
                  <button
                    onClick={() => setActiveTab('guide')}
                    className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      activeTab === 'guide'
                        ? 'bg-beeline-yellow text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-yellow-300'
                    }`}
                    title="Справка / Экспертный гид (?)"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab Content Container */}
                <div className="flex-1 p-3 overflow-y-auto min-h-0">
                  {/* TAB: ENGINEERS */}
                  {activeTab === 'engineers' && (
                    <div className="space-y-2 h-full flex flex-col">
                      <div className="flex items-center justify-between pb-1 text-xs">
                        <span className="text-slate-400 text-[11px]">Кликните на инженера для графика:</span>
                        <button
                          onClick={() => setCreatePanelType('engineer')}
                          className="text-[11px] font-bold text-beeline-yellow hover:text-yellow-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Добавить</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <EngineerList
                          routes={state?.schedule || []}
                          allEngineers={state?.engineers || []}
                          selectedEngineerId={selectedEngineerId}
                          selectedTaskId={selectedTaskId}
                          tasks={state?.tasks || []}
                          onSelectEngineer={handleSelectEngineer}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB: ALL TASKS (Point 4) */}
                  {activeTab === 'tasks' && (
                    <div className="space-y-2 h-full flex flex-col">
                      <div className="flex items-center justify-between pb-1 text-xs">
                        <span className="text-slate-400 text-[11px]">Кликните на заявку для графика:</span>
                        <button
                          onClick={() => setCreatePanelType('task')}
                          className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Добавить</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <TaskList
                          tasks={state?.tasks || []}
                          routes={state?.schedule || []}
                          selectedTaskId={selectedTaskId}
                          selectedEngineerId={selectedEngineerId}
                          engineers={state?.engineers || []}
                          onSelectTask={handleSelectTask}
                          onCancelTask={handleCancelTask}
                          onDeleteTask={handleDeleteTask}
                          onOpenExplanation={handleSelectTask}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB: UNASSIGNED */}
                  {activeTab === 'unassigned' && (() => {
                    const unassignedList = state?.unassigned_tasks || [];
                    const filteredUnassigned = unassignedList.filter((u) => {
                      const fullTask = state?.tasks?.find((t) => t.id === u.task_id);
                      const searchLower = problematicSearch.toLowerCase().trim();
                      if (searchLower) {
                        const matchId = (u.task_id || '').toLowerCase().includes(searchLower);
                        const matchAddress = (u.address || '').toLowerCase().includes(searchLower);
                        const matchReason = (u.reason || '').toLowerCase().includes(searchLower);
                        const matchSkill = (fullTask?.required_skill || '').toLowerCase().includes(searchLower);
                        if (!matchId && !matchAddress && !matchReason && !matchSkill) return false;
                      }

                      if (problematicFilter === 'urgent') {
                        return u.priority === 'Срочная' || fullTask?.priority === 'Срочная';
                      }
                      if (problematicFilter === 'skills') {
                        const r = u.reason.toLowerCase();
                        return r.includes('навык') || r.includes('квалифик');
                      }
                      if (problematicFilter === 'time') {
                        const r = u.reason.toLowerCase();
                        return r.includes('окон') || r.includes('смен') || r.includes('врем');
                      }
                      if (problematicFilter === 'transport') {
                        const r = u.reason.toLowerCase();
                        return r.includes('транспорт') || !!fullTask?.required_transport;
                      }
                      if (problematicFilter === 'new') {
                        return fullTask?.status === 'new';
                      }
                      return true;
                    });

                    return (
                      <div className="space-y-2.5">
                        {/* Search & Tag Filters */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Поиск по причине, адресу или #ID..."
                              value={problematicSearch}
                              onChange={(e) => setProblematicSearch(e.target.value)}
                              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-beeline-yellow transition-colors"
                            />
                          </div>

                          <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5">
                            <button
                              onClick={() => setProblematicFilter('all')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'all'
                                  ? 'bg-beeline-yellow text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Все ({unassignedList.length})
                            </button>
                            <button
                              onClick={() => setProblematicFilter('urgent')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'urgent'
                                  ? 'bg-rose-500 text-white font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Срочные ({unassignedList.filter(u => u.priority === 'Срочная' || state?.tasks?.find(t => t.id === u.task_id)?.priority === 'Срочная').length})
                            </button>
                            <button
                              onClick={() => setProblematicFilter('skills')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'skills'
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Навык
                            </button>
                            <button
                              onClick={() => setProblematicFilter('time')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'time'
                                  ? 'bg-indigo-500 text-white font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Окна / Смена
                            </button>
                            <button
                              onClick={() => setProblematicFilter('transport')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'transport'
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Транспорт
                            </button>
                            <button
                              onClick={() => setProblematicFilter('new')}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                                problematicFilter === 'new'
                                  ? 'bg-sky-500 text-slate-950 font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              Измененные ({unassignedList.filter(u => state?.tasks?.find(t => t.id === u.task_id)?.status === 'new').length})
                            </button>
                          </div>
                        </div>

                        {unassignedList.length === 0 ? (
                          <div className="text-center py-10 bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <h4 className="text-xs font-bold text-emerald-300">100% Заявок распределено</h4>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Все заявки текущего набора идеально уложились в смены, квалификацию и транспортные требования.
                            </p>
                          </div>
                        ) : filteredUnassigned.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-xs">
                            Нет заявок, соответствующих фильтрам
                          </div>
                        ) : (
                          filteredUnassigned.map((u) => {
                            const fullTask = state?.tasks?.find((t) => t.id === u.task_id);
                            const isNew = fullTask?.status === 'new';
                            const isUrgent = u.priority === 'Срочная';

                            return (
                              <div
                                key={u.task_id}
                                onClick={() => handleSelectTask(u.task_id)}
                                className={`p-3 rounded-lg text-xs space-y-1.5 cursor-pointer transition-all ${
                                  isUrgent
                                    ? 'bg-rose-950/40 border-2 border-rose-500 ring-1 ring-rose-500/50 shadow-md shadow-rose-950/50 hover:bg-rose-950/60'
                                    : 'bg-rose-950/20 border border-rose-900/50 hover:bg-rose-950/40'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold text-rose-300">
                                  <div className="flex items-center gap-1.5">
                                    <span className={isUrgent ? 'text-white font-extrabold text-xs' : ''}>Заявка #{u.task_id}</span>
                                    {isNew && (
                                      <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1 rounded font-semibold">
                                        Изменена
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isUrgent ? (
                                      <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded shadow flex items-center gap-1">
                                        <span>🚨</span>
                                        <span>СРОЧНАЯ — НЕ НАЗНАЧЕНА</span>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                        <span>⚠️ Не назначена</span>
                                      </span>
                                    )}
                                    {fullTask?.required_skill && (
                                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                                        {fullTask.required_skill}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-slate-300 text-[11px]">{u.address}</div>

                                {fullTask && (
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <span>Окно: <strong className="text-slate-300">{fullTask.window_start}-{fullTask.window_end}</strong></span>
                                    <span>•</span>
                                    <span>Длит: <strong className="text-slate-300">{fullTask.duration_min} мин</strong></span>
                                    {fullTask.required_transport && (
                                      <>
                                        <span>•</span>
                                        <span className="text-beeline-yellow">Транспорт: {fullTask.required_transport}</span>
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="text-rose-400 text-[11px] pt-1 border-t border-rose-900/40 font-medium">
                                  ⚠️ Причина: {u.reason}
                                </div>

                                <div className="flex items-center gap-1 pt-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleCancelTask(u.task_id)}
                                    className="bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-[10px] px-2 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <XCircle className="w-2.5 h-2.5" />
                                    <span>Отменить</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(u.task_id)}
                                    className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-[10px] px-2 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>Удалить</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}

                  {/* TAB: GUIDE / HELP (?) (Point 8) */}
                  {activeTab === 'guide' && (
                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl">
                        <h4 className="font-bold text-beeline-yellow flex items-center gap-1.5 text-xs mb-1">
                          <Sparkles className="w-4 h-4" />
                          Справка: сценарий проверки для жюри (5 минут)
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Решение задачи VRPTW с жесткими ограничениями кейса «Билайн Бизнес»: навыки, смены, окна визита, типы транспорта.
                        </p>
                      </div>

                      <ol className="space-y-2 text-[11px]">
                        <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <strong className="text-white block">1. Выбор сектора Москвы</strong>
                          <span className="text-slate-400">
                            В шапке выберите датасет: <strong>Восток, Юго-восток или Югоцентр</strong>. На карте моментально появятся маршруты и метки.
                          </span>
                        </li>

                        <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <strong className="text-white block">2. Метрики и оптимизация</strong>
                          <span className="text-slate-400">
                            Оцените KPI в верхней панели (экономия инженеров и пробега). Нажмите <strong>«⚡ Распланировать»</strong> для запуска эвристики 2-opt.
                          </span>
                        </li>

                        <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <strong className="text-white block">3. Глобальная шкала времени (00:00 – 24:00)</strong>
                          <span className="text-slate-400">
                            Снизу карты отображается временная шкала каждого инженера: синий — переезд, зеленый — выполнение работ, красный — сход с линии, серый — резерв.
                          </span>
                        </li>

                        <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <strong className="text-white block">4. Путевой лист и таймлайн заявки</strong>
                          <span className="text-slate-400">
                            Кликните на инженера во вкладке «Инженеры» или на задачу во вкладке «Заявки». Откроется детальная шкала визита и кнопка <strong>«Обосновать весь путь»</strong>.
                          </span>
                        </li>

                        <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <strong className="text-white block">5. Создание через правое меню</strong>
                          <span className="text-slate-400">
                            Нажмите <strong>«+ Добавить»</strong> для создания задачи или инженера. Значения по умолчанию уже предзаполнены для быстрого старта!
                          </span>
                        </li>
                      </ol>

                      <div className="pt-2">
                        <button
                          onClick={() => setActiveTab('engineers')}
                          className="w-full py-2 bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-bold rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Перейти к списку инженеров →</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
