import React, { useState } from 'react';
import { Task, EngineerRoute, ExplanationResponse } from '../types';
import { api } from '../api';
import { SkeletonText } from './Skeleton';
import { 
  ArrowLeft, Clock, MapPin, Wrench, Sparkles, 
  Trash2, XCircle, UserCheck, ShieldCheck, Database, X 
} from 'lucide-react';

interface TaskDrawerProps {
  task: Task;
  routes: EngineerRoute[];
  onClose: () => void;
  onSelectEngineer?: (engineerId: string) => void;
  onCancelTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

function timeToMin(t?: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  task,
  routes,
  onClose,
  onSelectEngineer,
  onCancelTask,
  onDeleteTask
}) => {
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExp, setIsLoadingExp] = useState(false);
  const [isExpOpen, setIsExpOpen] = useState(false);

  // Find assigned stop
  let assignedEngineerId: string | null = null;
  let assignedEngineerName: string | null = null;
  let assignedStop: any = null;

  for (const r of routes) {
    const s = r.stops.find((st) => st.task_id === task.id);
    if (s) {
      assignedEngineerId = r.engineer_id;
      assignedEngineerName = r.engineer_name;
      assignedStop = s;
      break;
    }
  }

  const isCancelled = task.status === 'cancelled';
  const isNew = task.status === 'new';

  const windowStartMin = timeToMin(task.window_start);
  const windowEndMin = timeToMin(task.window_end);
  const windowLeftPct = (windowStartMin / 1440) * 100;
  const windowWidthPct = Math.max(1, ((windowEndMin - windowStartMin) / 1440) * 100);

  const workStartMin = assignedStop ? timeToMin(assignedStop.start_time) : 0;
  const workEndMin = assignedStop ? timeToMin(assignedStop.end_time) : 0;
  const workLeftPct = (workStartMin / 1440) * 100;
  const workWidthPct = Math.max(1.5, ((workEndMin - workStartMin) / 1440) * 100);

  const hourMarks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  const handleFetchExplanation = async () => {
    setIsExpOpen(true);
    if (explanation) return; // Already cached locally
    setIsLoadingExp(true);
    try {
      const res = await api.getExplanation(task.id);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to get explanation:', err);
    } finally {
      setIsLoadingExp(false);
    }
  };

  return (
    <div className="h-full max-h-[calc(100vh-210px)] flex flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Header with Back button */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>Ко всем заявкам</span>
        </button>

        <div className="flex items-center gap-2">
          {isCancelled ? (
            <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-bold line-through">
              Отменена
            </span>
          ) : isNew ? (
            <span className="bg-sky-950 text-sky-300 border border-sky-800 text-[10px] px-2 py-0.5 rounded font-bold">
              Изменена
            </span>
          ) : assignedStop ? (
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold">
              В графике
            </span>
          ) : (
            <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">
              Не назначена
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable, does NOT lengthen page */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Title & Address */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-white">Заявка #{task.id}</span>
            {task.priority === 'Срочная' && (
              <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-sm">
                <span>⚡ Срочная</span>
              </span>
            )}
          </div>
          <div className="text-xs text-slate-200 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{task.address}</span>
          </div>
          {task.district && (
            <div className="text-[11px] text-slate-400">Район: {task.district}</div>
          )}
        </div>

        {/* 0.00 - 24.00 TIMELINE SCALE (Without travel time, work start/end only) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
              Шкала времени визита (00:00 – 24:00)
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Окно: {task.window_start} – {task.window_end}
            </span>
          </div>

          {/* Timeline Bar Track */}
          <div className="space-y-1">
            <div className="relative h-9 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              {/* Hour Grid Markers */}
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-r border-slate-800/60 pointer-events-none"
                  style={{ left: `${(h / 24) * 100}%` }}
                />
              ))}

              {/* Client Window Boundary (Subtle yellow highlight) */}
              <div
                className="absolute top-0 bottom-0 bg-yellow-500/10 border-l border-r border-yellow-500/40 pointer-events-none"
                style={{ left: `${windowLeftPct}%`, width: `${windowWidthPct}%` }}
                title={`Клиентское окно визита: ${task.window_start} - ${task.window_end}`}
              />

              {/* Status / Scheduled Work Block */}
              {isCancelled ? (
                <div className="absolute inset-0 bg-slate-800/80 text-slate-400 text-xs font-semibold flex items-center justify-center">
                  Заявка отменена клиентом
                </div>
              ) : assignedStop ? (
                /* Scheduled Work Execution (WITHOUT travel time, as requested) */
                <div
                  className="absolute top-1 bottom-1 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded flex items-center justify-center overflow-hidden border border-emerald-300 shadow-md transition-all hover:scale-105 z-10 px-1"
                  style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                  title={`Время работы: ${assignedStop.start_time} - ${assignedStop.end_time} (${task.duration_min} мин)`}
                >
                  <span className="truncate">
                    {assignedStop.start_time} – {assignedStop.end_time}
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 text-amber-400/80 text-[11px] font-medium flex items-center justify-center">
                  Ожидает назначения при оптимизации
                </div>
              )}
            </div>

            {/* Hour Axis Labels */}
            <div className="relative h-4 text-[9px] text-slate-400 font-mono">
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute transform -translate-x-1/2"
                  style={{ left: `${(h / 24) * 100}%` }}
                >
                  {h < 10 ? `0${h}:00` : `${h}:00`}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/20 border border-yellow-500/50"></span>
              <span>Окно визита ({task.window_start}–{task.window_end})</span>
            </div>
            {assignedStop && (
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                <span>Выполнение работ ({assignedStop.start_time}–{assignedStop.end_time})</span>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Engineer Card */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-300">Назначенный исполнитель:</div>
          {assignedEngineerName && assignedEngineerId ? (
            <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{assignedEngineerName}</div>
                  <div className="text-[10px] text-slate-400">
                    Прибытие: {assignedStop.arrival_time} • Работы: {assignedStop.start_time}–{assignedStop.end_time}
                  </div>
                </div>
              </div>

              {onSelectEngineer && (
                <button
                  onClick={() => onSelectEngineer(assignedEngineerId!)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium rounded border border-slate-700 cursor-pointer transition-colors"
                >
                  Маршрут →
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg">
              Исполнитель не назначен. Нажмите «⚡ Распланировать» для автоматического распределения.
            </div>
          )}
        </div>

        {/* Task Details Info */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Параметры ТЗ</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <div className="text-slate-400">Квалификация:</div>
              <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                <Wrench className="w-3 h-3 text-sky-400" />
                <span className="truncate">{task.required_skill}</span>
              </div>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <div className="text-slate-400">Длительность:</div>
              <div className="font-bold text-white mt-0.5">{task.duration_min} минут</div>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <div className="text-slate-400">Транспорт:</div>
              <div className="font-bold text-white mt-0.5">{task.required_transport || 'Любой'}</div>
            </div>

            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
              <div className="text-slate-400">Координаты:</div>
              <div className="font-mono text-[10px] text-slate-300 mt-0.5">
                {task.lat.toFixed(4)}, {task.lon.toFixed(4)}
              </div>
            </div>
          </div>
        </div>

        {/* AI EXPLANATION SECTION (Inline, no full-screen blur!) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-beeline-yellow" />
              ИИ-Обоснование решения (XAI)
            </span>

            <button
              onClick={handleFetchExplanation}
              disabled={isLoadingExp}
              className="px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-beeline-yellow border border-yellow-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isExpOpen ? 'Обновить' : 'Сгенерировать'}</span>
            </button>
          </div>

          {isExpOpen && (
            <div className="mt-2 space-y-2">
              {isLoadingExp ? (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-[11px] text-yellow-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-beeline-yellow animate-ping"></span>
                    <span>Анализ ограничений и генерация обоснования...</span>
                  </div>
                  <SkeletonText lines={4} />
                </div>
              ) : explanation ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Database className="w-3 h-3 text-blue-400" />
                      {explanation.cached ? 'Ответ из кэша SQLite' : 'Свежая генерация нейросетью'}
                    </span>
                    <button onClick={() => setIsExpOpen(false)} className="text-slate-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed select-text">
                    {explanation.explanation}
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 px-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Проверено на соответствие ТЗ «Билайн Бизнес»</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Action Buttons (Full parity with map actions) */}
        <div className="flex items-center gap-2 pt-1">
          {!isCancelled && (
            <button
              onClick={() => onCancelTask(task.id)}
              className="flex-1 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Отменить заявку</span>
            </button>
          )}

          <button
            onClick={() => onDeleteTask(task.id)}
            className="flex-1 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить из базы</span>
          </button>
        </div>
      </div>
    </div>
  );
};
