import React, { useState } from 'react';
import { EngineerRoute, Engineer, Task, ExplanationResponse } from '../types';
import { api } from '../api';
import { SkeletonText } from './Skeleton';
import { 
  ArrowLeft, Car, Bus, Bike, Footprints, Clock, MapPin, 
  Sparkles, Navigation, Wrench, Shield, Trash2, XCircle, 
  AlertTriangle, Database, ShieldCheck, X, UserX, UserCheck 
} from 'lucide-react';

interface EngineerDrawerProps {
  route?: EngineerRoute;
  engineer: Engineer;
  tasks?: Task[];
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteEngineer?: (engineerId: string) => void;
  onToggleEngineerStatus?: (engineerId: string) => void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
}

function timeToMin(t?: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1440, Math.max(0, h * 60 + m));
}

export const EngineerDrawer: React.FC<EngineerDrawerProps> = ({
  route,
  engineer,
  tasks = [],
  onClose,
  onSelectTask,
  onOpenExplanation,
  onCancelTask,
  onDeleteEngineer,
  onToggleEngineerStatus,
  onFocusTravelSegment
}) => {
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExp, setIsLoadingExp] = useState(false);
  const [isExpOpen, setIsExpOpen] = useState(false);

  if (!engineer && !route) return null;

  const engName = route?.engineer_name || engineer?.name || 'Инженер';
  const engId = route?.engineer_id || engineer?.id || '';
  const transport = route?.transport_type || engineer?.transport_type || 'Автомобиль';
  const shiftStart = route?.shift_start || engineer?.shift_start || '09:00';
  const shiftEnd = route?.shift_end || engineer?.shift_end || '22:00';
  const skills = route?.skills || engineer?.skills || [];
  const stops = route?.stops || [];
  const isUnavailable = engineer?.status === 'unavailable';
  const isIdle = stops.length === 0;

  const shiftStartMin = timeToMin(shiftStart);
  const shiftEndMin = timeToMin(shiftEnd);
  const shiftLeftPct = (shiftStartMin / 1440) * 100;
  const shiftWidthPct = Math.max(0, ((shiftEndMin - shiftStartMin) / 1440) * 100);

  const hourMarks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  const getTransportIcon = (t: string) => {
    switch (t) {
      case 'Автомобиль': return <Car className="w-3.5 h-3.5 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3.5 h-3.5 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Car className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleFetchRouteExplanation = async () => {
    setIsExpOpen(true);
    if (explanation) return;
    setIsLoadingExp(true);
    try {
      const res = await api.getEngineerExplanation(engId);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to get engineer explanation:', err);
    } finally {
      setIsLoadingExp(false);
    }
  };

  return (
    <div className="h-full max-h-[calc(100vh-210px)] flex flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Top Header inside sidebar */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>Ко всем инженерам</span>
        </button>

        <div className="flex items-center gap-1.5">
          {isUnavailable ? (
            <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-bold">
              Сход с линии
            </span>
          ) : engineer?.is_on_duty === false ? (
            <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-600 px-2 py-0.5 rounded font-bold">
              Выходной
            </span>
          ) : isIdle ? (
            <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-bold">
              В резерве
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">
              {stops.length} заявок
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable, does NOT lengthen page */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Profile Card */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{engName}</h3>
              <span className="text-[10px] text-slate-400 font-mono">ID: {engId}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-200 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              {getTransportIcon(transport)}
              <span>{transport}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-800/60">
            <span className="text-slate-400">Смена:</span>
            <span className="font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-beeline-yellow" />
              {shiftStart} – {shiftEnd}
            </span>
          </div>

          <div className="pt-1">
            <span className="text-[10px] text-slate-400 block mb-1">Навыки:</span>
            <div className="flex flex-wrap gap-1">
              {skills.map((s, i) => (
                <span key={i} className="text-[9px] bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 border border-slate-700">
                  <Shield className="w-2.5 h-2.5 text-blue-400" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Stats if active */}
          {!isIdle && (
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/60 text-center text-xs">
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Пробег</span>
                <span className="font-bold text-amber-400">{route?.total_distance_km} км</span>
              </div>
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Время в пути</span>
                <span className="font-bold text-sky-400">{route?.total_travel_min} мин</span>
              </div>
            </div>
          )}
        </div>

        {/* 0.00 - 24.00 TIMELINE SCALE (Red if unavailable, gray if idle, travel & work if active) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
              Шкала времени (00:00 – 24:00)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Смена: {shiftStart}–{shiftEnd}
            </span>
          </div>

          <div className="space-y-1">
            {/* Horizontal Timeline Track */}
            <div className="relative h-9 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              {/* Hour Grid Markers */}
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-r border-slate-800/60 pointer-events-none"
                  style={{ left: `${(h / 24) * 100}%` }}
                />
              ))}

              {/* Shift window boundaries */}
              <div
                className="absolute top-0 bottom-0 bg-slate-800/20 border-l border-r border-yellow-500/30 pointer-events-none"
                style={{ left: `${shiftLeftPct}%`, width: `${shiftWidthPct}%` }}
                title={`Смена: ${shiftStart} - ${shiftEnd}`}
              />

              {/* Unavailable state: RED timeline */}
              {isUnavailable ? (
                <div className="absolute inset-0 bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-bold flex items-center justify-center">
                  Инженер недоступен (сход с линии / болезнь)
                </div>
              ) : isIdle ? (
                /* Idle state: GRAY timeline */
                <div className="absolute inset-0 bg-slate-800/70 border border-slate-700/50 text-slate-400 text-xs font-medium flex items-center justify-center">
                  Оперативный резерв (0 выездов)
                </div>
              ) : (
                /* Active Route: Travel + Work Blocks */
                <>
                  {stops.map((stop, sIdx) => {
                    const startTimeMin = timeToMin(stop.start_time);
                    const endTimeMin = timeToMin(stop.end_time);

                    // Travel occurs immediately prior to work start
                    const travelDurationMin = Math.max(1, stop.travel_min || 15);
                    const depTimeMin = Math.max(0, startTimeMin - travelDurationMin);
                    const travelLeftPct = (depTimeMin / 1440) * 100;
                    const travelWidthPct = Math.max(0.6, (travelDurationMin / 1440) * 100);

                    const workLeftPct = (startTimeMin / 1440) * 100;
                    const workWidthPct = Math.max(1.0, ((endTimeMin - startTimeMin) / 1440) * 100);

                    // POINT 7: Check if task was cancelled
                    const fullTask = tasks.find((t) => t.id === stop.task_id);
                    const isTaskCancelled = fullTask?.status === 'cancelled';

                    const prevCoords = sIdx === 0
                      ? [engineer.start_lon, engineer.start_lat]
                      : [stops[sIdx - 1].lon, stops[sIdx - 1].lat];

                    return (
                      <React.Fragment key={stop.task_id || sIdx}>
                        {/* Travel block directly prior to work (Requirement 8: Focus on Map) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFocusTravelSegment) {
                              onFocusTravelSegment({
                                from: prevCoords as [number, number],
                                to: [stop.lon, stop.lat],
                                travelMin: stop.travel_min,
                                travelKm: stop.travel_km,
                                engineerName: engineer.name
                              });
                            }
                          }}
                          className="absolute top-1.5 bottom-1.5 bg-sky-500/80 hover:bg-sky-400 hover:ring-2 hover:ring-amber-400 rounded-sm cursor-pointer transition-all z-10"
                          style={{ left: `${travelLeftPct}%`, width: `${travelWidthPct}%` }}
                          title={`Кликните, чтобы показать путь на карте: ${stop.travel_min} мин (${stop.travel_km} км) к #${stop.task_id}`}
                        />

                        {/* Work execution block (Point 7) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTask) onSelectTask(stop.task_id);
                            else if (onOpenExplanation) onOpenExplanation(stop.task_id);
                          }}
                          className={`absolute top-1 bottom-1 font-black text-[9px] rounded flex items-center justify-center overflow-hidden border transition-all z-10 px-0.5 cursor-pointer ${
                            isTaskCancelled
                              ? 'bg-slate-600 hover:bg-slate-500 text-slate-300 border-slate-500 line-through opacity-75'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow'
                          }`}
                          style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                          title={
                            isTaskCancelled
                              ? `Заявка #${stop.task_id} ОТМЕНЕНА (будет удалена при пересчете)`
                              : `Заявка #${stop.task_id}: ${stop.start_time} - ${stop.end_time} (${stop.address})`
                          }
                        >
                          <span className="truncate">
                            {isTaskCancelled ? `✕ #${stop.task_id}` : `#${stop.task_id}`}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </>
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
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-sky-500"></span>
                <span>В пути</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-emerald-500"></span>
                <span>Работа</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-slate-600"></span>
                <span className="line-through">Отменена</span>
              </span>
            </div>
            <span className="italic text-[9px]">Клик по синему блоку покажет путь на карте</span>
          </div>
        </div>

        {/* AI ROUTE EXPLANATION SECTION (Inline, no full-screen blur!) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-beeline-yellow" />
              {isIdle ? 'ИИ-Обоснование резерва' : 'Обоснование всего маршрута'}
            </span>

            <button
              onClick={handleFetchRouteExplanation}
              disabled={isLoadingExp}
              className="px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-beeline-yellow border border-yellow-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isExpOpen ? 'Обновить' : 'Обосновать весь путь'}</span>
            </button>
          </div>

          {isExpOpen && (
            <div className="mt-2 space-y-2">
              {isLoadingExp ? (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-[11px] text-yellow-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-beeline-yellow animate-ping"></span>
                    <span>Анализ маршрута и генерация объяснения...</span>
                  </div>
                  <SkeletonText lines={4} />
                </div>
              ) : explanation ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Database className="w-3 h-3 text-blue-400" />
                      {explanation.cached ? 'Ответ из кэша PostgreSQL' : 'Свежая генерация нейросетью'}
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
                    <span>Проверено по критериям ТЗ «Билайн Бизнес»</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Vertical Chronological Timeline of events */}
        {!isIdle && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider pb-1">
              <span className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-beeline-yellow" />
                Путевой лист ({stops.length} остановок)
              </span>
            </div>

            <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {/* Event 0: Base Departure */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-700 text-white flex items-center justify-center text-[10px]">
                  🏠
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span>{shiftStart}</span>
                    <span className="text-emerald-400 font-semibold">Выезд с базы</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Старт смены со стартовой точки</div>
                </div>
              </div>

              {/* Stops in Vertical Timeline */}
              {stops.map((stop, sIdx) => {
                const fullTask = tasks.find((t) => t.id === stop.task_id);
                const isTaskCancelled = fullTask?.status === 'cancelled';
                const prevCoords = sIdx === 0
                  ? [engineer.start_lon, engineer.start_lat]
                  : [stops[sIdx - 1].lon, stops[sIdx - 1].lat];

                return (
                  <div key={stop.task_id} className="relative">
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shadow ${
                      isTaskCancelled
                        ? 'bg-slate-600 text-slate-300'
                        : stop.priority === 'Срочная' 
                        ? 'bg-rose-500 text-white ring-2 ring-rose-400' 
                        : 'bg-beeline-yellow text-slate-950'
                    }`}>
                      {isTaskCancelled ? '✕' : stop.order}
                    </div>

                    <div className={`p-2.5 rounded-lg border space-y-1.5 shadow-sm transition-all ${
                      isTaskCancelled
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}>
                      {/* Travel row with map focus button (Requirement 8) */}
                      <div 
                        onClick={() => {
                          if (onFocusTravelSegment) {
                            onFocusTravelSegment({
                              from: prevCoords as [number, number],
                              to: [stop.lon, stop.lat],
                              travelMin: stop.travel_min,
                              travelKm: stop.travel_km,
                              engineerName: engineer.name
                            });
                          }
                        }}
                        className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900 hover:bg-slate-800 hover:text-amber-300 px-2 py-1 rounded border border-slate-800 cursor-pointer transition-colors"
                        title="Нажмите, чтобы показать этот путь на карте"
                      >
                        <span className="flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5 text-amber-400" />
                          Доезд: {stop.travel_km} км (~{stop.travel_min} мин)
                        </span>
                        <span className="text-[9px] text-amber-400 underline font-semibold">На карту →</span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className={`font-bold text-xs ${isTaskCancelled ? 'line-through text-slate-400' : 'text-white'}`}>
                          Заявка #{stop.task_id} {isTaskCancelled && <span className="text-rose-400 font-normal">[Отменена]</span>}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-beeline-yellow">
                          Прибытие {stop.arrival_time}
                        </span>
                      </div>

                    <div className="text-slate-300 text-[11px] flex items-start gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <span>{stop.address}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Окно: <strong>{stop.start_time} – {stop.end_time}</strong></span>
                      <span className="text-slate-300 font-medium">{stop.required_skill}</span>
                    </div>

                    {/* Action buttons inside stop card */}
                    <div className="pt-1.5 border-t border-slate-800/60 flex items-center gap-1">
                      {onOpenExplanation && (
                        <button
                          onClick={() => onOpenExplanation(stop.task_id)}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-yellow-300 text-[10px] py-1 px-2 rounded font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-800"
                        >
                          <Sparkles className="w-3 h-3 text-yellow-400" />
                          <span>ИИ заявки</span>
                        </button>
                      )}

                      {onCancelTask && (
                        <button
                          onClick={() => onCancelTask(stop.task_id)}
                          title="Отменить заявку"
                          className="bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-[10px] px-2 py-1 rounded flex items-center gap-0.5 cursor-pointer"
                        >
                          <XCircle className="w-3 h-3 text-amber-400" />
                          <span>Отмена</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

              {/* Event End: Shift Finished */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-800 border-2 border-slate-700 text-white flex items-center justify-center text-[10px]">
                  🏁
                </div>
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span>{shiftEnd}</span>
                    <span className="text-slate-400 font-semibold">Окончание смены</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Завершение рабочего дня</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions: Take Engineer Off-Line (IRREVERSIBLE) & Delete */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          {onToggleEngineerStatus && (
            isUnavailable ? (
              <div className="w-full text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border bg-rose-950/30 text-rose-300 border-rose-900/60 shadow-inner">
                <UserX className="w-3.5 h-3.5 text-rose-400" />
                <span>Сход с линии необратим (инженер недоступен)</span>
              </div>
            ) : (
              <button
                onClick={() => onToggleEngineerStatus(engId)}
                className="w-full text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 cursor-pointer shadow-sm hover:border-rose-600"
              >
                <UserX className="w-3.5 h-3.5 text-rose-300" />
                <span>Снять с линии (необратимо, задачи в неразмеченные)</span>
              </button>
            )
          )}

          {onDeleteEngineer && (
            <button
              onClick={() => onDeleteEngineer(engId)}
              className="w-full bg-slate-950/40 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
              <span>Удалить инженера из базы</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
