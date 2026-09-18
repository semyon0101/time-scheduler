import React, { useState } from 'react';
import { Task, EngineerRoute, Engineer } from '../types';
import { 
  CANONICAL_SKILLS, 
  TASK_SEARCH_MODIFIERS, 
  ENGINEER_TAG_TRANSPORTS,
  TaskModifier, 
  getTaskModifierState, 
  getTaskTags, 
  matchesSearchQuery
} from '../utils/tags';
import { 
  Search, Clock, MapPin, Shield, 
  CheckCircle2, Sparkles, Trash2, Zap, AlertTriangle,
  Car, Bus, Bike, Footprints, Navigation
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  routes: EngineerRoute[];
  engineers?: Engineer[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  onSelectTask: (taskId: string) => void;
  onCancelTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenExplanation: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  routes,
  engineers = [],
  selectedEngineerId,
  selectedTaskId,
  onSelectTask,
  onCancelTask,
  onDeleteTask,
  onOpenExplanation
}) => {
  const [search, setSearch] = useState('');
  const [activeModifier, setActiveModifier] = useState<TaskModifier>('Все');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Find assigned engineer and stop for each task
  const findAssignedEngineer = (taskId: string) => {
    for (const r of routes) {
      const stop = r.stops.find((s) => s.task_id === taskId);
      if (stop) {
        return { engineerName: r.engineer_name, engineerId: r.engineer_id, stop };
      }
    }
    return null;
  };

  const selectedEng = engineers.find((e) => e.id === selectedEngineerId);
  const selectedEngRoute = routes.find((r) => r.engineer_id === selectedEngineerId);
  const selectedEngTaskIds = new Set(selectedEngRoute?.stops.map((s) => s.task_id) || []);

  const toggleTag = (tagLabel: string) => {
    if (selectedTags.includes(tagLabel)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagLabel));
    } else {
      setSelectedTags([...selectedTags, tagLabel]);
    }
  };

  // Helper for transport icons
  const getTransportIcon = (t?: string | null) => {
    switch (t) {
      case 'Автомобиль': return <Car className="w-3 h-3 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3 h-3 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3 h-3 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3 h-3 text-amber-400" />;
      default: return <Navigation className="w-3 h-3 text-slate-400" />;
    }
  };

  // Modifier counters
  const counts = {
    'Все': tasks.length,
    'В графике': tasks.filter((t) => findAssignedEngineer(t.id) !== null && t.status !== 'cancelled').length,
    'Не распределенные': tasks.filter((t) => findAssignedEngineer(t.id) === null && t.status !== 'cancelled' && t.status !== 'new').length,
    'Изменения': tasks.filter((t) => t.status === 'new' || t.status === 'cancelled').length
  };

  // Available tags list including transport requirements (Requirement 8)
  const availableTags = [
    // Skills
    { label: 'Локальные работы', category: 'skill' },
    { label: 'Работы на подключение и дозаказы', category: 'skill' },
    { label: 'Аварийные работы', category: 'skill' },
    // Priorities
    { label: 'Срочная', category: 'priority' },
    { label: 'Обычная', category: 'priority' },
    // Problem
    { label: 'Проблемная', category: 'problem' },
    // Transport tags (Requirement 8)
    { label: 'Автомобиль', category: 'transport' },
    { label: 'Общественный транспорт', category: 'transport' },
    { label: 'Велосипед', category: 'transport' },
    { label: 'Пешеход', category: 'transport' }
  ];

  const transportTagSet = new Set(ENGINEER_TAG_TRANSPORTS as readonly string[]);

  const filteredTasks = tasks.filter((t) => {
    const isAssigned = findAssignedEngineer(t.id) !== null;
    const isUnassignedProblem = !isAssigned && t.status !== 'cancelled' && t.status !== 'new';
    const modifierState = getTaskModifierState(t, isAssigned, isUnassignedProblem);
    const tags = getTaskTags(t, isAssigned, isUnassignedProblem);

    // If filtered by engineer in context
    if (selectedEng && selectedEngTaskIds.size > 0 && selectedTags.includes('eng_assigned')) {
      if (!selectedEngTaskIds.has(t.id)) return false;
    }

    // 1. Match active modifier (single select)
    if (activeModifier !== 'Все' && modifierState !== activeModifier) {
      return false;
    }

    // 2. Transport & Tag filtering (Requirement 8:
    // "если тег выбран, то выводятся все заявки у которых в транспорте указан этот тег или ничего не указано(любой).
    // А если никакой тег не выбран, то фильтрация по тегам отключена")
    const activeTransportTags = selectedTags.filter((st) => transportTagSet.has(st));
    const activeOtherTags = selectedTags.filter((st) => !transportTagSet.has(st) && st !== 'eng_assigned');

    // If transport tags are selected:
    if (activeTransportTags.length > 0) {
      const taskTransport = t.required_transport;
      const isAnyTransport = !taskTransport || taskTransport === 'Любой' || taskTransport === 'Любой транспорт';
      const matchesTransport = isAnyTransport || activeTransportTags.includes(taskTransport);
      if (!matchesTransport) {
        return false;
      }
    }

    // If other tags are selected (skills, priority, problem):
    if (activeOtherTags.length > 0) {
      const itemLabels = new Set(tags.map((tg) => tg.label.toLowerCase()));
      const matchesOther = activeOtherTags.every((req) => itemLabels.has(req.toLowerCase()));
      if (!matchesOther) {
        return false;
      }
    }

    // 3. Match text search (by title, address, district, ID OR by tag label)
    return matchesSearchQuery(
      search,
      `#${t.id}`,
      `${t.address} ${t.district || ''}`,
      tags
    );
  });

  return (
    <div className="flex flex-col h-full space-y-2 font-sans">
      {/* Search Input: Matches by address, title, ID or tag */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по адресу, номеру #ID или тегу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-beeline-yellow transition-colors"
        />
      </div>

      {/* Tier 1: Search Modifiers (Single Select: Все, В графике, Не распределенные, Отмененные, Изменения) */}
      <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5 scrollbar-none">
        {TASK_SEARCH_MODIFIERS.map((mod) => {
          const isActive = activeModifier === mod;
          return (
            <button
              key={mod}
              type="button"
              onClick={() => setActiveModifier(mod)}
              className={`px-2 py-0.5 rounded-md font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                isActive
                  ? 'bg-beeline-yellow text-slate-950 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{mod}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-black/20 text-current' : 'bg-slate-800 text-slate-400'
              }`}>
                {counts[mod]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tier 2: Filter Tags (Work types, Priorities, Problems, Transport requirements) */}
      <div className="flex flex-wrap gap-1 text-[11px]">
        {selectedEng && (
          <button
            type="button"
            onClick={() => toggleTag('eng_assigned')}
            className={`px-2 py-0.5 rounded-full font-medium cursor-pointer transition-colors flex items-center gap-1 border ${
              selectedTags.includes('eng_assigned')
                ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <span>👷 #{selectedEng.name.replace('Бригада ', '')} ({selectedEngTaskIds.size})</span>
            {selectedTags.includes('eng_assigned') && <span className="text-[9px]">✕</span>}
          </button>
        )}

        {availableTags.map((t) => {
          const isSelected = selectedTags.includes(t.label);
          let badgeColor = 'bg-slate-950/60 text-slate-400 border-slate-800';
          if (isSelected) {
            if (t.category === 'transport') {
              badgeColor = 'bg-purple-600 text-white font-bold border-purple-500 shadow-sm';
            } else if (t.label === 'Срочная') {
              badgeColor = 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm';
            } else if (t.label === 'Проблемная') {
              badgeColor = 'bg-rose-600 text-white font-bold border-rose-500 shadow-sm';
            } else {
              badgeColor = 'bg-sky-600 text-white font-bold border-sky-500 shadow-sm';
            }
          }

          return (
            <button
              key={t.label}
              type="button"
              onClick={() => toggleTag(t.label)}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-colors cursor-pointer flex items-center gap-1 border ${badgeColor}`}
            >
              {t.category === 'transport' && getTransportIcon(t.label)}
              {t.label === 'Срочная' && <Zap className="w-2.5 h-2.5 text-amber-400" />}
              {t.label === 'Проблемная' && <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />}
              <span>{t.label}</span>
              {isSelected && <span className="text-[9px]">✕</span>}
            </button>
          );
        })}
      </div>

      {/* Task Cards List (Requirement 4: structured matching EngineerList card positions) */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            Заявки не найдены по выбранным фильтрам
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            const assignment = findAssignedEngineer(task.id);
            const isAssigned = Boolean(assignment);
            const isCancelled = task.status === 'cancelled';
            const isUrgent = task.priority === 'Срочная';
            const isNew = task.status === 'new';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/95 border-beeline-yellow shadow-md ring-1 ring-beeline-yellow/40'
                    : isCancelled
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : isUrgent
                    ? 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700/60'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* 1. Header row (Identical layout to EngineerList: Left Title + Sub-row, Right Status Badge) */}
                <div className="flex items-start justify-between gap-1.5">
                  <div>
                    {/* Title row */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">Заявка #{task.id}</span>
                      {isUrgent && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          <span>Срочная</span>
                        </span>
                      )}
                      {task.priority === 'Обычная' && !isCancelled && !isNew && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          Обычная
                        </span>
                      )}
                      {isCancelled && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          Отменена
                        </span>
                      )}
                      {isNew && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                          Изменения
                        </span>
                      )}
                    </div>

                    {/* Sub-row: Transport Badge + Time Window (matching EngineerList sub-row) */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/60 font-medium flex items-center gap-1">
                        {getTransportIcon(task.required_transport)}
                        <span>{task.required_transport || 'Любой транспорт'}</span>
                      </span>
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        <span>{task.window_start}–{task.window_end}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Status Badge (matching EngineerList right status pill) */}
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                      isCancelled
                        ? 'bg-slate-900 text-slate-500 border border-slate-800'
                        : isAssigned && assignment
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                        : 'bg-rose-900/40 text-rose-400 border border-rose-800/50'
                    }`}>
                      {isCancelled ? (
                        'Снята'
                      ) : isAssigned && assignment ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{assignment.engineerName.replace('Бригада ', '')} (#{assignment.stop.order})</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>Не назначена</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* 2. Address row */}
                <div className="text-[11px] text-slate-300 mt-2 flex items-start gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-tight line-clamp-2">{task.address}</span>
                </div>

                {/* 3. Skills & Duration Tags (matching EngineerList skills tags row) */}
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 font-medium flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-blue-400" />
                    <span>{task.required_skill}</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800/80 font-mono">
                    {task.duration_min} мин
                  </span>
                </div>

                {/* 4. Action Buttons Footer */}
                <div className="flex items-center justify-end gap-1.5 mt-2 pt-1.5 border-t border-slate-800/50">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenExplanation(task.id);
                    }}
                    className="text-[10px] bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Объяснение ИИ"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-beeline-yellow" />
                    <span>ИИ-обоснование</span>
                  </button>

                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancelTask(task.id);
                      }}
                      className="text-[10px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                      title="Отменить заявку"
                    >
                      Отменить
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTask(task.id);
                    }}
                    className="text-[10px] bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-300 border border-slate-800 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Удалить заявку"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
