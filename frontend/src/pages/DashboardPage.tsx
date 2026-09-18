import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDispatcherId, setDispatcherId } from '../api';
import { 
  StateResponse, 
  Task, 
  Engineer, 
  MapFocusState, 
  TravelSegmentFocus, 
  createNoneFocus, 
  createTaskFocus, 
  createEngineerFocus, 
  createSegmentFocus 
} from '../types';
import { Header } from '../components/Header';
import { MetricsCard } from '../components/MetricsCard';
import { MapView } from '../components/MapView';
import { EngineerList } from '../components/EngineerList';
import { EngineerDrawer } from '../components/EngineerDrawer';
import { TaskList } from '../components/TaskList';
import { TaskDrawer } from '../components/TaskDrawer';
import { CreatePanel } from '../components/CreatePanel';
import { FullScheduleBoard } from '../components/FullScheduleBoard';
import { 
  Users, Sparkles, CheckCircle2, 
  Map as MapIcon, List, Trash2, XCircle, 
  ClipboardList, HelpCircle, Plus, Search, ChevronDown 
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [mapFocus, setMapFocus] = useState<MapFocusState>(createNoneFocus());
  const [createPanelType, setCreatePanelType] = useState<'task' | 'engineer' | null>(null);
  const [deletedChangesCount, setDeletedChangesCount] = useState(0);

  const selectedEngineerId = mapFocus.type === 'engineer_route' 
    ? (mapFocus.engineerId || null) 
    : (mapFocus.type === 'travel_segment' ? (mapFocus.segment?.engineerId || null) : null);
  const selectedTaskId = mapFocus.type === 'task' ? (mapFocus.taskId || null) : null;
  const focusedSegment = mapFocus.type === 'travel_segment' ? (mapFocus.segment || null) : null;

  const pendingChangesCount = (
    (state?.tasks.filter((t) => t.status === 'new' || t.status === 'cancelled').length || 0) +
    (state?.engineers.filter((e) => e.status === 'new' || e.status === 'pending_unavailable').length || 0) +
    deletedChangesCount
  );
  const hasChanges = pendingChangesCount > 0;

  // Explicit session binding
  const [currentDispatcherId, setCurrentDispatcherId] = useState<string>(() => getDispatcherId());

  // Help tab as question mark (?) or regular tabs
  const [activeTab, setActiveTab] = useState<'engineers' | 'tasks' | 'guide'>('engineers');

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
      handleClearFocus();
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
      setDeletedChangesCount(0);
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
      setDeletedChangesCount((prev) => prev + 1);
      if (selectedTaskId === taskId) {
        handleClearFocus();
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
      setDeletedChangesCount((prev) => prev + 1);
      if (selectedEngineerId === engineerId) {
        handleClearFocus();
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
    handleClearFocus();
    setCreatePanelType(null);
    setActiveTab('engineers');
    setState(null);
    setLoading(true);
    try {
      const preset = state?.active_preset || 'vostok';
      const uniqueData = await api.createUniqueSession(preset);
      setDispatcherId(uniqueData.dispatcher_id);
      setCurrentDispatcherId(uniqueData.dispatcher_id);
      const data = await api.getState();
      setState(data);
    } catch (err) {
      console.error('Failed to create unique session, falling back:', err);
      const newId = `disp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      setDispatcherId(newId);
      setCurrentDispatcherId(newId);
      try {
        const data = await api.initSession();
        setState(data);
      } catch (innerErr) {
        console.error('Fallback init failed:', innerErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Nav helpers for selection (Requirement 9: single active focus clears all others)
  const handleSelectEngineer = (engId: string) => {
    setCreatePanelType(null);
    setMapFocus(createEngineerFocus(engId));
    setMobileView('sidebar');
  };

  const handleSelectTask = (taskId: string) => {
    setCreatePanelType(null);
    setMapFocus(createTaskFocus(taskId));
    setMobileView('sidebar');
  };

  const handleFocusTravelSegment = (seg: TravelSegmentFocus) => {
    setCreatePanelType(null);
    setMapFocus(createSegmentFocus(seg));
  };

  const handleClearFocus = () => {
    setMapFocus(createNoneFocus());
  };

  const selectedRoute = state?.schedule.find((r) => r.engineer_id === selectedEngineerId);
  const selectedEngineer = state?.engineers.find((e) => e.id === selectedEngineerId);
  const selectedTaskObj = state?.tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Initial Screen: Exactly 100vh Full Viewport */}
      <div className="h-screen max-h-screen flex flex-col overflow-hidden">
        {/* Top Header */}
        <Header
          dispatcherId={state?.dispatcher_id || currentDispatcherId}
          activePreset={state?.active_preset || 'vostok'}
          isOptimizing={isOptimizing}
          onLoadPreset={handleLoadPreset}
          onOptimize={handleOptimize}
          onResetSession={handleResetSession}
          onNavigateHome={() => navigate('/')}
          onToggleHelp={() => {
            handleClearFocus();
            setCreatePanelType(null);
            setActiveTab(activeTab === 'guide' ? 'engineers' : 'guide');
            setMobileView('sidebar');
          }}
        />

        {/* Main Dashboard Area */}
        <main className="flex-1 p-2 md:p-3 space-y-2 flex flex-col overflow-hidden max-w-[1920px] mx-auto w-full min-h-0">
          {/* KPI Metrics Hero Bar */}
          <MetricsCard
            metrics={state?.metrics}
            totalTasks={state?.tasks.filter((t) => t.status !== 'cancelled').length || 0}
            hasChanges={hasChanges}
            pendingChangesCount={pendingChangesCount}
            unassignedTasksCount={state?.unassigned_tasks.length || 0}
            isLoading={loading || isOptimizing}
          />

          {/* Mobile View Switcher (Visible ONLY on small mobile screens) */}
          <div className="flex md:hidden bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 shrink-0">
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
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-0 overflow-hidden">
            {/* Left Column: Map + Global Timeline under Map */}
            <div className={`lg:col-span-7 flex flex-col gap-2 min-h-0 h-full overflow-hidden ${
              mobileView === 'sidebar' ? 'hidden md:flex' : 'flex'
            }`}>
              {/* Map Box */}
              <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 relative flex flex-col shadow-lg min-h-0">
                <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
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
                      onClick={handleClearFocus}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Показать всё
                    </button>
                  )}
                </div>

                <div className="flex-1 w-full h-full relative min-h-0">
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
                      focus={mapFocus}
                      selectedEngineerId={selectedEngineerId}
                      selectedTaskId={selectedTaskId}
                      focusedSegment={focusedSegment}
                      onSetFocus={setMapFocus}
                      onClearFocus={handleClearFocus}
                      onSelectEngineer={handleSelectEngineer}
                      onSelectTask={handleSelectTask}
                      onOpenExplanation={handleSelectTask}
                      onCancelTask={handleCancelTask}
                      onDeleteTask={handleDeleteTask}
                      onClearFocusedSegment={handleClearFocus}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Menu / Detail Drawers / Creation / Tabs */}
            <div className={`lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-lg overflow-hidden h-full min-h-0 ${
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
                /* View 2: Selected Engineer Drawer */
                <EngineerDrawer
                  route={selectedRoute}
                  engineer={selectedEngineer}
                  tasks={state?.tasks || []}
                  onClose={handleClearFocus}
                  onOpenExplanation={handleSelectTask}
                  onSelectTask={handleSelectTask}
                  onFocusTravelSegment={handleFocusTravelSegment}
                  onCancelTask={handleCancelTask}
                  onDeleteEngineer={handleDeleteEngineer}
                  onToggleEngineerStatus={handleToggleEngineerStatus}
                />
              ) : selectedTaskId && selectedTaskObj ? (
                /* View 3: Selected Task Drawer */
                <TaskDrawer
                  task={selectedTaskObj}
                  routes={state?.schedule || []}
                  onClose={handleClearFocus}
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

                    {/* Tab 2: Tasks */}
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

                    {/* Tab 3: Guide Tab (Справка) */}
                    <button
                      onClick={() => setActiveTab('guide')}
                      className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeTab === 'guide'
                          ? 'bg-slate-800 text-beeline-yellow shadow-sm border border-yellow-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Справка / Руководство диспетчера"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-beeline-yellow" />
                      <span>Справка</span>
                    </button>
                  </div>

                  {/* Tab Content Container */}
                  <div className="flex-1 p-3 overflow-y-auto min-h-0">
                    {/* TAB: ENGINEERS */}
                    {activeTab === 'engineers' && (
                      <div className="space-y-2 h-full flex flex-col">
                        <div className="flex items-center justify-between pb-1 text-xs shrink-0">
                          <span className="text-slate-400 text-[11px]">Кликните на инженера для графика:</span>
                          <button
                            onClick={() => setCreatePanelType('engineer')}
                            className="text-[11px] font-bold text-beeline-yellow hover:text-yellow-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Добавить</span>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                          <EngineerList
                            engineers={state?.engineers || []}
                            routes={state?.schedule || []}
                            selectedEngineerId={selectedEngineerId}
                            selectedTaskId={selectedTaskId}
                            onSelectEngineer={handleSelectEngineer}
                            onSelectTask={handleSelectTask}
                            onFocusTravelSegment={handleFocusTravelSegment}
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB: ALL TASKS */}
                    {activeTab === 'tasks' && (
                      <div className="space-y-2 h-full flex flex-col">
                        <div className="flex items-center justify-between pb-1 text-xs shrink-0">
                          <span className="text-slate-400 text-[11px]">Кликните на заявку для графика:</span>
                          <button
                            onClick={() => setCreatePanelType('task')}
                            className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Добавить</span>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                          <TaskList
                            tasks={state?.tasks || []}
                            routes={state?.schedule || []}
                            engineers={state?.engineers || []}
                            selectedEngineerId={selectedEngineerId}
                            selectedTaskId={selectedTaskId}
                            onSelectTask={handleSelectTask}
                            onCancelTask={handleCancelTask}
                            onDeleteTask={handleDeleteTask}
                            onOpenExplanation={handleSelectTask}
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB: GUIDE / HELP */}
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
                              Оцените KPI в верхней панели. Нажмите <strong>«⚡ Распланировать»</strong> для запуска эвристики перепланирования.
                            </span>
                          </li>

                          <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <strong className="text-white block">3. Сводное расписание внизу экрана</strong>
                            <span className="text-slate-400">
                              Прокрутите страницу вниз, чтобы увидеть синхронное расписание всех бригад на единой фиксированной сетке часов 08:00 – 22:00.
                            </span>
                          </li>

                          <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <strong className="text-white block">4. Путевой лист и таймлайн заявки</strong>
                            <span className="text-slate-400">
                              Кликните на инженера во вкладке «Инженеры» или на задачу во вкладке «Заявки». Откроется детальная шкала визита и ИИ-обоснование.
                            </span>
                          </li>

                          <li className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 space-y-1">
                            <strong className="text-white block">5. Создание через правое меню</strong>
                            <span className="text-slate-400">
                              Нажмите <strong>«+ Добавить»</strong> для создания задачи или инженера.
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

          {/* Bottom Quick Jump to Full-Screen Schedule */}
          <div className="shrink-0 pt-0.5 pb-1 text-center">
            <button
              type="button"
              onClick={() => {
                document.getElementById('full-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-slate-900/90 hover:bg-slate-850 text-slate-400 hover:text-beeline-yellow border border-slate-800 hover:border-yellow-500/40 rounded-full text-[11px] font-semibold transition-all shadow cursor-pointer group"
            >
              <span>Сводное расписание всех инженеров на весь экран</span>
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform text-beeline-yellow" />
            </button>
          </div>
        </main>
      </div>

      {/* 2. Below the fold: Full-Screen Schedule View (Requirement 11) */}
      <section id="full-schedule-section" className="min-h-screen p-3 md:p-6 bg-slate-950 flex flex-col border-t border-slate-800/80">
        <FullScheduleBoard
          engineers={state?.engineers || []}
          routes={state?.schedule || []}
          tasks={state?.tasks || []}
          selectedEngineerId={selectedEngineerId}
          selectedTaskId={selectedTaskId}
          onSelectEngineer={handleSelectEngineer}
          onSelectTask={handleSelectTask}
          onFocusTravelSegment={handleFocusTravelSegment}
          onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      </section>
    </div>
  );
};
