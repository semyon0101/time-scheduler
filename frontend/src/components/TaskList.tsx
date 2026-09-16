import React, { useState } from 'react';
import { Task, EngineerRoute, Engineer } from '../types';
import { 
  Search, Clock, MapPin, Wrench, AlertTriangle, 
  CheckCircle2, Sparkles, XCircle, Trash2, Zap 
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
  const [filter, setFilter] = useState<'all' | 'assigned' | 'urgent' | 'new' | 'cancelled' | 'selected_engineer'>('all');
  const [skillFilter, setSkillFilter] = useState<string | null>(null);

  // Helper to find which engineer is assigned to this task
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

  const filteredTasks = tasks.filter((t) => {
    const searchLower = search.toLowerCase().trim();
    const isUrgentQuery = searchLower === 'срочная' || searchLower === 'срочно' || searchLower === 'urgent';
    const matchesSearch =
      (isUrgentQuery && t.priority === 'Срочная') ||
      (t.id || '').toLowerCase().includes(searchLower) ||
      (t.address || '').toLowerCase().includes(searchLower) ||
      (t.district || '').toLowerCase().includes(searchLower) ||
      (t.required_skill || '').toLowerCase().includes(searchLower) ||
      (t.priority || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (skillFilter && t.required_skill !== skillFilter) return false;

    if (filter === 'selected_engineer') {
      return selectedEngTaskIds.has(t.id);
    }
    if (filter === 'urgent') return t.priority === 'Срочная' && t.status !== 'cancelled';
    if (filter === 'cancelled') return t.status === 'cancelled';
    if (filter === 'new') return t.status === 'new';
    if (filter === 'assigned') {
      return t.status !== 'cancelled' && findAssignedEngineer(t.id) !== null;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-2">
      {/* Search & Filters */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по адресу, #ID, 'срочная'..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-beeline-yellow transition-colors"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-1 text-[11px]">
          {selectedEng && (
            <button
              onClick={() => setFilter(filter === 'selected_engineer' ? 'all' : 'selected_engineer')}
              className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors flex items-center gap-1 ${
                filter === 'selected_engineer'
                  ? 'bg-amber-400 text-slate-950 font-bold ring-2 ring-amber-400/50'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              <span>👷 {selectedEng.name.replace('Бригада ', '')} ({selectedEngTaskIds.size})</span>
              {filter === 'selected_engineer' && <span className="text-[9px]">✕</span>}
            </button>
          )}

          <button
            onClick={() => { setFilter('all'); setSkillFilter(null); }}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
              filter === 'all' && !skillFilter
                ? 'bg-beeline-yellow text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Все ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
              filter === 'assigned'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Назначенные
          </button>
          <button
            onClick={() => setFilter('urgent')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors flex items-center gap-1 ${
              filter === 'urgent'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>Срочные ({tasks.filter(t => t.priority === 'Срочная' && t.status !== 'cancelled').length})</span>
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
              filter === 'new'
                ? 'bg-sky-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Измененные ({tasks.filter(t => t.status === 'new').length})
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
              filter === 'cancelled'
                ? 'bg-rose-500 text-white font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Отмененные ({tasks.filter(t => t.status === 'cancelled').length})
          </button>
        </div>

        {/* Active Skill Filter Indicator */}
        {skillFilter && (
          <div className="flex items-center justify-between bg-sky-950/40 border border-sky-800/60 px-2 py-0.5 rounded text-[10px] text-sky-300">
            <span>Фильтр по навыку: <strong>{skillFilter}</strong></span>
            <button
              onClick={() => setSkillFilter(null)}
              className="text-sky-400 hover:text-white font-bold ml-1 cursor-pointer"
            >
              ✕ Сбросить
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Tasks list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Заявки не найдены
          </div>
        ) : (
          filteredTasks.map((task) => {
            const assignment = findAssignedEngineer(task.id);
            const isSelected = selectedTaskId === task.id;
            const isCancelled = task.status === 'cancelled';
            const isNew = task.status === 'new';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-500/15 border-yellow-500/50 shadow-md'
                    : isCancelled
                    ? 'bg-slate-950/40 border-slate-800/40 opacity-60'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                {/* Header: ID, Priority, Status */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold font-mono ${isCancelled ? 'line-through text-slate-500' : 'text-white'}`}>
                      #{task.id}
                    </span>
                    {task.priority === 'Срочная' && !isCancelled && (
                      <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 shadow-sm">
                        <Zap className="w-2.5 h-2.5 text-amber-400" />
                        <span>Срочная</span>
                      </span>
                    )}
                  </div>

                  <div>
                    {isCancelled ? (
                      <span className="bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-medium line-through">
                        Отменена
                      </span>
                    ) : isNew ? (
                      <span className="bg-sky-950 text-sky-300 border border-sky-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Изменена
                      </span>
                    ) : assignment ? (
                      <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>{assignment.engineerName.replace('Бригада ', '')}</span>
                      </span>
                    ) : (
                      <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        В ожидании
                      </span>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className={`text-[11px] mb-1.5 flex items-start gap-1 ${
                  isCancelled ? 'line-through text-slate-500' : 'text-slate-300'
                }`}>
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span className="truncate">{task.address}</span>
                </div>

                {/* Info row: Window, Duration, Skill */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    <Clock className="w-2.5 h-2.5 text-yellow-400" />
                    <span>{task.window_start} - {task.window_end}</span>
                  </span>

                  <span className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    <span>{task.duration_min} мин</span>
                  </span>

                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSkillFilter(skillFilter === task.required_skill ? null : task.required_skill);
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                      skillFilter === task.required_skill
                        ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-800'
                    }`}
                    title="Нажмите для фильтрации по этому навыку"
                  >
                    <Wrench className="w-2.5 h-2.5 text-blue-400" />
                    <span>{task.required_skill}</span>
                  </span>
                </div>

                {/* Action buttons (full parity with map actions) */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onOpenExplanation(task.id)}
                    className="text-[10px] text-beeline-yellow hover:text-yellow-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-yellow-500/10 cursor-pointer transition-colors"
                    title="Получить ИИ-обоснование назначения этой заявки"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>ИИ-обоснование</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {!isCancelled && (
                      <button
                        onClick={() => onCancelTask(task.id)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-amber-950/40 cursor-pointer transition-colors"
                        title="Отменить заявку (сохраняется в базе)"
                      >
                        <XCircle className="w-2.5 h-2.5" />
                        <span>Отменить</span>
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-rose-950/40 cursor-pointer transition-colors"
                      title="Удалить заявку навсегда из базы"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
