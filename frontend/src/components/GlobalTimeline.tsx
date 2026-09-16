import React, { useState } from 'react';
import { Engineer, EngineerRoute, Task } from '../types';
import { Clock, ChevronDown, ChevronUp, Car, Bus, Bike, Footprints } from 'lucide-react';

interface GlobalTimelineProps {
  engineers: Engineer[];
  routes: EngineerRoute[];
  tasks?: Task[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
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

export const GlobalTimeline: React.FC<GlobalTimelineProps> = ({
  engineers,
  routes,
  tasks = [],
  selectedEngineerId,
  selectedTaskId,
  onSelectEngineer,
  onSelectTask,
  onFocusTravelSegment
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // 2-hour interval marks
  const hourMarks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  const getTransportIcon = (type: string) => {
    switch (type) {
      case 'Автомобиль': return <Car className="w-3 h-3 text-sky-400" />;
      case 'Общественный транспорт': return <Bus className="w-3 h-3 text-amber-400" />;
      case 'Велосипед': return <Bike className="w-3 h-3 text-emerald-400" />;
      default: return <Footprints className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* Header bar */}
      <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
          <span className="font-bold text-white">Глобальная шкала времени (00:00 – 24:00)</span>
          <span className="text-[11px] text-slate-400">({engineers.length} инженеров)</span>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-2.5 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
            <span className="text-slate-300">В пути</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span className="text-slate-300">Работы</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 ring-1 ring-yellow-300"></span>
            <span className="text-yellow-300 font-bold">Выбрана</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-600"></span>
            <span className="text-slate-400 line-through">Отменена</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500"></span>
            <span className="text-slate-300">Недоступен</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700"></span>
            <span className="text-slate-300">Резерв</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="overflow-x-auto">
          <div className="min-w-[700px] p-2 space-y-1.5">
            {/* Hour labels header */}
            <div className="flex text-[10px] text-slate-400 pb-1 border-b border-slate-800/80">
              <div className="w-48 shrink-0 font-semibold text-slate-300 px-1">Инженер / Транспорт</div>
              <div className="flex-1 relative h-4">
                {hourMarks.map((h) => {
                  const pct = (h / 24) * 100;
                  return (
                    <div
                      key={h}
                      className="absolute transform -translate-x-1/2 font-mono text-[9px]"
                      style={{ left: `${pct}%` }}
                    >
                      {h < 10 ? `0${h}:00` : `${h}:00`}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Engineer rows */}
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {engineers.map((eng) => {
                const route = routes.find((r) => r.engineer_id === eng.id);
                const stops = route?.stops || [];
                const isSelected = selectedEngineerId === eng.id;
                const isUnavailable = eng.status === 'unavailable';
                const isIdle = stops.length === 0;
                const hasSelectedTask = selectedTaskId ? stops.some(s => s.task_id === selectedTaskId) : false;

                const shiftStartMin = timeToMin(eng.shift_start || '09:00');
                const shiftEndMin = timeToMin(eng.shift_end || '22:00');
                const shiftLeftPct = (shiftStartMin / 1440) * 100;
                const shiftWidthPct = Math.max(0, ((shiftEndMin - shiftStartMin) / 1440) * 100);

                return (
                  <div
                    key={eng.id}
                    className={`flex items-center text-xs rounded-lg p-1 transition-all ${
                      isSelected
                        ? 'bg-yellow-500/20 border-2 border-yellow-400 shadow-lg ring-2 ring-yellow-400/40 z-20'
                        : hasSelectedTask
                        ? 'bg-yellow-500/10 border-2 border-yellow-500/60 shadow ring-1 ring-yellow-400/30'
                        : selectedEngineerId
                        ? 'bg-slate-950/30 border border-slate-800/30 opacity-40 hover:opacity-85'
                        : 'bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/40'
                    }`}
                  >
                    {/* Left Column: Engineer info */}
                    <div
                      onClick={() => onSelectEngineer(eng.id)}
                      className="w-48 shrink-0 flex items-center justify-between pr-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {getTransportIcon(eng.transport_type)}
                        <span className={`font-semibold truncate text-[11px] ${
                          isSelected ? 'text-beeline-yellow font-extrabold' : 'text-slate-200'
                        }`} title={eng.name}>
                          {eng.name.replace('Бригада ', '')}
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="text-[9px] bg-yellow-400 text-slate-950 font-black px-1.5 py-0.5 rounded shrink-0 shadow">
                          ВЫБРАН
                        </span>
                      ) : isUnavailable ? (
                        <span className="text-[9px] bg-rose-950/60 text-rose-300 border border-rose-800/60 px-1 rounded shrink-0">
                          Сход
                        </span>
                      ) : isIdle ? (
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded shrink-0">
                          Резерв
                        </span>
                      ) : (
                        <span className="text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-1 rounded shrink-0">
                          {stops.length} заявок
                        </span>
                      )}
                    </div>

                    {/* Right Column: Timeline track */}
                    <div className="flex-1 relative h-6 bg-slate-950/60 rounded overflow-hidden border border-slate-800/60">
                      {/* Grid hour lines */}
                      {hourMarks.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-r border-slate-800/40 pointer-events-none"
                          style={{ left: `${(h / 24) * 100}%` }}
                        />
                      ))}

                      {/* Shift window boundary */}
                      <div
                        className="absolute top-0 bottom-0 bg-slate-800/20 border-l border-r border-slate-700/30 pointer-events-none"
                        style={{ left: `${shiftLeftPct}%`, width: `${shiftWidthPct}%` }}
                        title={`Смена: ${eng.shift_start} - ${eng.shift_end}`}
                      />

                      {/* Unavailable state */}
                      {isUnavailable && (
                        <div className="absolute inset-0 bg-red-950/70 border border-red-500/40 text-red-300 text-[10px] font-semibold flex items-center justify-center">
                          Инженер сошел с линии (недоступен)
                        </div>
                      )}

                      {/* Idle state */}
                      {!isUnavailable && isIdle && (
                        <div className="absolute inset-0 text-slate-500 text-[10px] flex items-center justify-center font-medium">
                          Оперативный резерв (0 выездов)
                        </div>
                      )}

                      {/* Active stops & travel blocks */}
                      {!isUnavailable && !isIdle && (
                        <>
                          {route.stops.map((stop, sIdx) => {
                            const startTimeMin = timeToMin(stop.start_time);
                            const endTimeMin = timeToMin(stop.end_time);

                            // Travel occurs directly before work begins
                            const travelDurationMin = Math.max(1, stop.travel_min || 15);
                            const depTimeMin = Math.max(0, startTimeMin - travelDurationMin);
                            const travelLeftPct = (depTimeMin / 1440) * 100;
                            const travelWidthPct = Math.max(0.6, (travelDurationMin / 1440) * 100);

                            // Work block
                            const workLeftPct = (startTimeMin / 1440) * 100;
                            const workWidthPct = Math.max(0.8, ((endTimeMin - startTimeMin) / 1440) * 100);

                            // POINT 7: Check if task was cancelled
                            const fullTask = tasks.find((t) => t.id === stop.task_id);
                            const isTaskCancelled = fullTask?.status === 'cancelled';

                            // POINT 6: Check if task is currently selected
                            const isTaskSelected = selectedTaskId === stop.task_id;

                            // Coordinates for travel focus (Requirement 8)
                            const prevCoords = sIdx === 0
                              ? [eng.start_lon, eng.start_lat]
                              : [route.stops[sIdx - 1].lon, route.stops[sIdx - 1].lat];

                            return (
                              <React.Fragment key={stop.task_id || sIdx}>
                                {/* Travel Segment directly prior to work (Requirement 8: Focus on Map without menu change) */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onFocusTravelSegment) {
                                      onFocusTravelSegment({
                                        from: prevCoords as [number, number],
                                        to: [stop.lon, stop.lat],
                                        travelMin: stop.travel_min,
                                        travelKm: stop.travel_km,
                                        engineerName: eng.name
                                      });
                                    }
                                  }}
                                  className="absolute top-1 bottom-1 bg-sky-500/80 hover:bg-sky-400 hover:ring-2 hover:ring-amber-400 rounded-[2px] transition-all cursor-pointer z-10"
                                  style={{ left: `${travelLeftPct}%`, width: `${travelWidthPct}%` }}
                                  title={`Кликните, чтобы показать путь на карте: ${stop.travel_min} мин (${stop.travel_km} км) к #${stop.task_id}`}
                                />

                                {/* Work Execution Segment (Points 6 & 7) */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectTask) onSelectTask(stop.task_id);
                                  }}
                                  className={`absolute top-0.5 bottom-0.5 font-bold text-[9px] rounded flex items-center justify-center overflow-hidden transition-all cursor-pointer px-0.5 ${
                                    isTaskSelected
                                      ? 'bg-yellow-400 text-slate-950 font-black ring-4 ring-yellow-400/90 ring-offset-2 ring-offset-slate-900 border-2 border-white scale-110 z-30 shadow-2xl'
                                      : isTaskCancelled
                                      ? 'bg-slate-600 hover:bg-slate-500 text-slate-300 border border-slate-500 line-through opacity-75 z-10'
                                      : `bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300 shadow-sm z-10 ${
                                          selectedTaskId ? 'opacity-40 hover:opacity-100' : 'opacity-100'
                                        }`
                                  }`}
                                  style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                                  title={
                                    isTaskCancelled
                                      ? `Заявка #${stop.task_id} ОТМЕНЕНА (будет удалена при пересчете)`
                                      : `Заявка #${stop.task_id}: ${stop.address} (${stop.start_time} - ${stop.end_time})`
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
