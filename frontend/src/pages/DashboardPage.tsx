import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDispatcherId } from '../api';
import {
  StateResponse,
  Task,
  Engineer,
  TaskStatusEnum,
  ChangeEvent,
  ChangeEventTypeEnum,
  PriorityEnum,
  SkillEnum,
  EngineerStatusEnum,
  TransportTypeEnum,
  Focus,
} from '../types';
import {
  parseTime,
  durationMinutesToTime,
  createPosition,
  computeTaskTags,
  computeEngineerTags,
} from '../utils/adapters';
import { dataStore } from '../utils/DataStore';
import { Header } from '../components/Header';
import { MetricsCard } from '../components/MetricsCard';
import { MapView } from '../components/MapView';
import { MapHeader } from '../components/MapHeader';
import { Menu } from '../components/Menu';
import { HelpBody } from '../components/Menu/HelpBody';
import { GlobalTimeline } from '../components/GlobalTimeline';
import { SkeletonTimeline, SkeletonCard } from '../components/Skeleton';
import { HelpCircle, X } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Batch changes queue
  const [pendingChanges, setPendingChanges] = useState<ChangeEvent[]>([]);

  // Unified Reactive Focus
  const [focus, setFocus] = useState<Focus>(null);

  // Synchronized Selection state
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);

  // Focused travel segment
  const [focusedSegment, setFocusedSegment] = useState<{
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  } | null>(null);

  // Explicit session binding
  const [currentDispatcherId] = useState<string>(() => getDispatcherId());

  // Active tab state in sidebar Menu
  const [activeTab, setActiveTab] = useState<'engineers' | 'tasks' | 'help'>('engineers');

  // Help Modal state decoupled from Sidebar Menu tab
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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

  const handleSetFocus = (newFocus: Focus) => {
    setFocus(newFocus);
    if (!newFocus) {
      setSelectedEngineerId(null);
      setSelectedTaskId(null);
      setSelectedRoadId(null);
      setFocusedSegment(null);
      return;
    }

    if (newFocus.kind === 'engineer') {
      setSelectedEngineerId(newFocus.id);
      setSelectedTaskId(null);
      setSelectedRoadId(null);
      setActiveTab('engineers');
    } else if (newFocus.kind === 'task') {
      setSelectedTaskId(newFocus.id);
      setSelectedEngineerId(null);
      setSelectedRoadId(null);
      setActiveTab('tasks');
    } else if (newFocus.kind === 'road') {
      const road = dataStore.find_by_id_roads(newFocus.id);
      setSelectedRoadId(newFocus.id);
      if (road?.engineer_id) {
        setSelectedEngineerId(road.engineer_id);
        setActiveTab('engineers');
      }
      setSelectedTaskId(null);
    }
  };

  const handleLoadPreset = async (preset: string) => {
    setIsOptimizing(true);
    try {
      const data = await api.loadPreset(preset);
      setState(data);
      setPendingChanges([]);
      handleSetFocus(null);
    } catch (err) {
      console.error(`Ошибка загрузки датасета: ${err}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * Batch replanning & optimization handler:
   * If there are pending changes in the queue, sends them via api.replan(pendingChanges).
   * Otherwise executes standard global optimization via api.optimize().
   */
  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      let data: StateResponse;
      if (pendingChanges.length > 0) {
        data = await api.replan(pendingChanges);
        setPendingChanges([]);
      } else {
        data = await api.optimize();
      }
      setState(data);
    } catch (err) {
      console.error(`Ошибка оптимизации: ${err}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * Optimistic task creation: enqueues ChangeEvent without recalculating schedule.
   */
  const handleCreateTask = async (taskData: Partial<Task>) => {
    const taskId = taskData.id || `task_${Date.now().toString(36)}`;
    const isUrgent = taskData.priority === PriorityEnum.URGENT;

    const tags = computeTaskTags({
      required_transport: taskData.required_transport,
      required_skill: taskData.required_skill || SkillEnum.LOCKAL,
      priority: taskData.priority || PriorityEnum.NORMAL,
      status: TaskStatusEnum.NEW,
    });

    const newTask: Task = {
      id: taskId,
      position: taskData.position || createPosition('Москва', 55.75, 37.61),
      district: taskData.district,
      window_start: taskData.window_start || parseTime('09:00'),
      window_end: taskData.window_end || parseTime('18:00'),
      duration_time: taskData.duration_time || durationMinutesToTime(45),
      priority: taskData.priority || PriorityEnum.NORMAL,
      required_skill: taskData.required_skill || SkillEnum.LOCKAL,
      required_transport: taskData.required_transport,
      status: TaskStatusEnum.NEW,
      tags,
      engineer_id: null,
    };

    if (!isUrgent) {
      try {
        await api.createTask(newTask);
      } catch (err) {
        console.error('Failed to persist task in repository:', err);
      }
    }

    const event: ChangeEvent = {
      event_type: isUrgent ? ChangeEventTypeEnum.URGENT_TASK : ChangeEventTypeEnum.NEW_TASK,
      timestamp: parseTime(),
      task: newTask,
      task_id: taskId,
    };
    setPendingChanges((prev) => [...prev, event]);

    dataStore.add_task(newTask);

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [newTask, ...prev.tasks],
        unassigned_tasks: [
          {
            task_id: taskId,
            address: newTask.position.address,
            reason: 'Ожидает распределения («⚡ Распланировать»)',
            priority: newTask.priority,
          },
          ...prev.unassigned_tasks,
        ],
      };
    });

    handleSetFocus({ kind: 'task', id: taskId });
  };

  /**
   * Optimistic engineer creation: enqueues ChangeEvent without recalculating schedule.
   */
  const handleCreateEngineer = async (engData: Partial<Engineer>) => {
    const engId = engData.id || `eng_${Date.now().toString(36)}`;
    const tags = computeEngineerTags({
      transport_type: engData.transport_type || TransportTypeEnum.CAR,
      skills: engData.skills || [SkillEnum.LOCKAL],
      status: EngineerStatusEnum.NEW,
      tasksCount: 0,
    });

    const newEngineer: Engineer = {
      id: engId,
      name: engData.name || 'Новый инженер',
      position: engData.position || createPosition('Москва', 55.75, 37.61),
      shift_start: engData.shift_start || parseTime('09:00'),
      shift_end: engData.shift_end || parseTime('21:00'),
      skills: engData.skills || [SkillEnum.LOCKAL],
      transport_type: engData.transport_type || TransportTypeEnum.CAR,
      status: EngineerStatusEnum.NEW,
      tags,
      tasks: [],
      roads: [],
    };

    try {
      await api.createEngineer(newEngineer);
    } catch (err) {
      console.error('Failed to persist engineer in repository:', err);
    }

    const event: ChangeEvent = {
      event_type: ChangeEventTypeEnum.NEW_ENGINEER,
      engineer_id: engId,
      timestamp: parseTime(),
    };
    setPendingChanges((prev) => [...prev, event]);

    dataStore.add_engineer(newEngineer);

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        engineers: [...prev.engineers, newEngineer],
      };
    });

    handleSetFocus({ kind: 'engineer', id: engId });
  };

  /**
   * Optimistic task cancellation: enqueues CANCEL_TASK ChangeEvent.
   */
  const handleCancelTask = (taskId: string) => {
    const event: ChangeEvent = {
      event_type: ChangeEventTypeEnum.CANCEL_TASK,
      task_id: taskId,
      timestamp: parseTime(),
    };
    setPendingChanges((prev) => [...prev, event]);

    setState((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          const updated = { ...t, status: TaskStatusEnum.CANCELLED };
          updated.tags = computeTaskTags(updated);
          dataStore.set_by_id_task(taskId, updated);
          return updated;
        }
        return t;
      });

      const updatedEngineers = prev.engineers.map((eng) => {
        if (eng.tasks.includes(taskId)) {
          const updatedTasksList = eng.tasks.filter((tId) => tId !== taskId);
          const updatedEng = {
            ...eng,
            tasks: updatedTasksList,
          };
          updatedEng.tags = computeEngineerTags({
            transport_type: updatedEng.transport_type,
            skills: updatedEng.skills,
            status: updatedEng.status,
            tasksCount: updatedTasksList.length,
          });
          dataStore.set_by_id_engineer(updatedEng.id, updatedEng);
          return updatedEng;
        }
        return eng;
      });

      const updatedSchedule = prev.schedule.map((route) => ({
        ...route,
        stops: route.stops.filter((s) => s.task_id !== taskId),
      }));

      return {
        ...prev,
        tasks: updatedTasks,
        engineers: updatedEngineers,
        schedule: updatedSchedule,
      };
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      if (selectedTaskId === taskId) {
        handleSetFocus(null);
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
        handleSetFocus(null);
      }
      const updated = await api.getState();
      setState(updated);
    } catch (err) {
      console.error(`Ошибка удаления инженера: ${err}`);
    }
  };

  /**
   * Optimistic engineer status toggle: enqueues ENGINEER_UNAVAILABLE ChangeEvent.
   */
  const handleToggleEngineerStatus = (engineerId: string) => {
    const eng = state?.engineers.find((e) => e.id === engineerId);
    const isCurrentlyUnavailable = eng?.status === EngineerStatusEnum.UNAVAILABLE;
    const newStatus = isCurrentlyUnavailable
      ? EngineerStatusEnum.ACTIVE
      : EngineerStatusEnum.UNAVAILABLE;

    const event: ChangeEvent = {
      event_type: ChangeEventTypeEnum.ENGINEER_UNAVAILABLE,
      engineer_id: engineerId,
      timestamp: parseTime(),
    };
    setPendingChanges((prev) => [...prev, event]);

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        engineers: prev.engineers.map((e) => {
          if (e.id === engineerId) {
            const updated = { ...e, status: newStatus };
            updated.tags = computeEngineerTags({
              transport_type: updated.transport_type,
              skills: updated.skills,
              status: updated.status,
              tasksCount: updated.tasks.length,
            });
            dataStore.set_by_id_engineer(engineerId, updated);
            return updated;
          }
          return e;
        }),
      };
    });
  };

  const handleResetSession = async () => {
    try {
      const updated = await api.resetSession();
      setState(updated);
      setPendingChanges([]);
      handleSetFocus(null);
    } catch (err) {
      console.error(`Ошибка сброса сессии: ${err}`);
    }
  };

  // Synchronized Selection Logic (strictly string IDs)
  const handleSelectEngineer = (engId: string) => {
    if (!engId || selectedEngineerId === engId) {
      handleSetFocus(null);
    } else {
      handleSetFocus({ kind: 'engineer', id: engId });
    }
  };

  const handleSelectTask = (taskId: string) => {
    if (!taskId || selectedTaskId === taskId) {
      handleSetFocus(null);
    } else {
      handleSetFocus({ kind: 'task', id: taskId });
    }
  };

  const handleSelectRoad = (roadId: string) => {
    if (!roadId || selectedRoadId === roadId) {
      handleSetFocus(null);
    } else {
      handleSetFocus({ kind: 'road', id: roadId });
    }
  };

  const handleClearMapSelection = () => {
    handleSetFocus(null);
  };

  const engineerIds = state?.engineers.map((e) => e.id) || [];
  const taskIds = state?.tasks.map((t) => t.id) || [];

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* ============================================================== */}
      {/* SCREEN 1: 100vh Full Screen Map & Side Menu (no GlobalTimeline) */}
      {/* ============================================================== */}
      <section className="h-screen w-full flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header */}
        <Header
          dispatcherId={currentDispatcherId}
          activePreset={state?.active_preset || 'vostok'}
          isOptimizing={isOptimizing}
          onLoadPreset={handleLoadPreset}
          onOptimize={handleOptimize}
          onResetSession={handleResetSession}
          onNavigateHome={() => navigate('/')}
          onToggleHelp={() => setIsHelpModalOpen((prev) => !prev)}
          isHelpActive={isHelpModalOpen}
          pendingChangesCount={pendingChanges.length}
        />

        {/* Compact KPI Metrics Hero Bar */}
        <div className="px-3 pt-2 shrink-0">
          <MetricsCard
            metrics={state?.metrics}
            totalTasks={state?.tasks.filter((t) => t.status !== TaskStatusEnum.CANCELLED).length || 0}
            isLoading={loading || isOptimizing}
          />
        </div>

        {/* Work Area: Left Map (col-span-7) + Right Menu (col-span-5) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 p-3">
          {/* Left: MapView taking FULL height (h-full w-full) */}
          <div className="col-span-7 flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl relative">
            <MapHeader
              selectedEngineerId={selectedEngineerId}
              selectedTaskId={selectedTaskId}
              selectedRoadId={selectedRoadId}
              focus={focus}
              focusedSegment={focusedSegment}
              onClearSelection={handleClearMapSelection}
            />

            <div className="flex-1 w-full h-full relative min-h-0">
              {loading || isOptimizing ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-xs space-y-3">
                  <span className="w-4 h-4 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-medium">
                    {isOptimizing
                      ? 'Оптимизация и пересчет маршрутов...'
                      : 'Загрузка картографических слоев и маршрутов...'}
                  </span>
                </div>
              ) : (
                <MapView
                  engineerIds={engineerIds}
                  taskIds={taskIds}
                  selectedEngineerId={selectedEngineerId}
                  selectedTaskId={selectedTaskId}
                  selectedRoadId={selectedRoadId}
                  focus={focus}
                  onSetFocus={handleSetFocus}
                  focusedSegment={focusedSegment}
                  onSelectEngineer={handleSelectEngineer}
                  onSelectTask={handleSelectTask}
                  onSelectRoad={handleSelectRoad}
                  onOpenExplanation={handleSelectTask}
                  onCancelTask={handleCancelTask}
                  onDeleteTask={handleDeleteTask}
                  onClearFocusedSegment={() => setFocusedSegment(null)}
                />
              )}
            </div>

            {/* Quick jump to Screen 2 button / indicator */}
            <button
              onClick={() => {
                const el = document.getElementById('screen-2-timeline');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-20 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xl backdrop-blur-sm cursor-pointer transition-all"
            >
              <span>К расписанию инженеров</span>
              <span className="text-cyan-400 animate-bounce">↓</span>
            </button>
          </div>

          {/* Right: Side Menu taking FULL height */}
          <div className="col-span-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-xl overflow-hidden h-full">
            {loading || isOptimizing ? (
              <div className="p-3 space-y-3">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : (
              <Menu
                engineerIds={engineerIds}
                taskIds={taskIds}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                selectedEngineerId={selectedEngineerId}
                selectedTaskId={selectedTaskId}
                selectedRoadId={selectedRoadId}
                focus={focus}
                onSetFocus={handleSetFocus}
                onSelectEngineer={handleSelectEngineer}
                onSelectTask={handleSelectTask}
                onSelectRoad={handleSelectRoad}
                onCancelTask={handleCancelTask}
                onDeleteTask={handleDeleteTask}
                onOpenExplanation={handleSelectTask}
                onToggleEngineerStatus={handleToggleEngineerStatus}
                onDeleteEngineer={handleDeleteEngineer}
                onCreateEngineer={handleCreateEngineer}
                onCreateTask={handleCreateTask}
                onFocusTravelSegment={setFocusedSegment}
              />
            )}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SCREEN 2: Full Screen Global Timeline below Screen 1           */}
      {/* ============================================================== */}
      <section id="screen-2-timeline" className="h-screen max-h-screen overflow-hidden flex flex-col p-3 bg-slate-950 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <span>↑ Вернуться к карте и меню</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {loading || isOptimizing ? (
            <SkeletonTimeline />
          ) : (
            <GlobalTimeline
              engineerIds={engineerIds}
              selectedEngineerId={selectedEngineerId}
              selectedTaskId={selectedTaskId}
              selectedRoadId={selectedRoadId}
              focus={focus}
              onSetFocus={handleSetFocus}
              onSelectEngineer={handleSelectEngineer}
              onSelectTask={handleSelectTask}
              onSelectRoad={handleSelectRoad}
              onFocusTravelSegment={setFocusedSegment}
            />
          )}
        </div>
      </section>

      {/* Decoupled Help Modal Popup */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <HelpCircle className="w-4 h-4 text-beeline-yellow" />
                <span>Руководство эксперта / Справка FSM Dispatcher</span>
              </div>
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Закрыть справку"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm">
              <HelpBody
                onSwitchToEngineers={() => {
                  setIsHelpModalOpen(false);
                  setActiveTab('engineers');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
