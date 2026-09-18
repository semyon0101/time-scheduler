import React from 'react';
import { Engineer, EngineerRoute, Task, TravelSegmentFocus } from '../types';
import { 
  Clock, Navigation, Zap, 
  Car, Bus, Bike, Footprints, ArrowUp 
} from 'lucide-react';
import { 
  VerticalTimeline, 
  HOUR_HEIGHT_PX, 
  SCHEDULE_HOURS, 
  TOTAL_HEIGHT_PX 
} from './VerticalTimeline';

interface FullScheduleBoardProps {
  engineers: Engineer[];
  routes: EngineerRoute[];
  tasks: Task[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask: (taskId: string) => void;
  onFocusTravelSegment: (seg: TravelSegmentFocus) => void;
  onScrollToTop: () => void;
}

export const FullScheduleBoard: React.FC<FullScheduleBoardProps> = ({
  engineers,
  routes,
  tasks,
  selectedEngineerId,
  selectedTaskId,
  onSelectEngineer,
  onSelectTask,
  onFocusTravelSegment,
  onScrollToTop
}) => {
  const getTransportIcon = (t?: string) => {
    switch (t) {
      case 'Автомобиль': return <Car className="w-3 h-3 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3 h-3 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3 h-3 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3 h-3 text-amber-400" />;
      default: return <Car className="w-3 h-3 text-slate-400" />;
    }
  };

  const routeByEngId = new Map(routes.map((r) => [r.engineer_id, r]));

  return (
    <div className="w-full space-y-3 pb-8">
      {/* Top Banner & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-beeline-yellow">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <span>Сводный график всех инженеров</span>
              <span className="text-[11px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-md border border-slate-700">
                08:00 – 22:00
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Единая сетка расписания по колонкам для {engineers.length} инженеров
            </p>
          </div>
        </div>

        {/* Legend & Scroll to Top button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400 bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="flex items-center gap-1 font-medium text-emerald-300">
              <span>🏠</span> Выезд
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium text-sky-300">
              <Navigation className="w-2.5 h-2.5 text-amber-400" /> Переезд
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium text-amber-300">
              <Zap className="w-2.5 h-2.5 text-amber-400" /> Срочная
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium text-white">
              <span>✓</span> Обычная
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium text-slate-400">
              <span>🏁</span> Конец смены (22:00)
            </span>
          </div>

          <button
            type="button"
            onClick={onScrollToTop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            <ArrowUp className="w-4 h-4 text-beeline-yellow" />
            <span>К карте и управлению</span>
          </button>
        </div>
      </div>

      {/* Synchronized Multi-Column Timeline Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
        <div className="overflow-x-auto overflow-y-hidden">
          <div className="flex min-w-max relative" style={{ minHeight: `${TOTAL_HEIGHT_PX + 90}px` }}>
            
            {/* Left Sticky Time Ruler */}
            <div className="sticky left-0 z-30 w-16 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 select-none">
              {/* Top Ruler Header */}
              <div className="h-[76px] border-b border-slate-800 bg-slate-950 flex items-center justify-center text-[11px] font-bold text-slate-400 font-mono">
                Время
              </div>

              {/* Hour Notches strictly 08:00 - 22:00 */}
              <div className="relative w-full" style={{ height: `${TOTAL_HEIGHT_PX}px` }}>
                {SCHEDULE_HOURS.map((hour, idx) => {
                  const topPx = idx * HOUR_HEIGHT_PX;
                  const label = `${hour.toString().padStart(2, '0')}:00`;
                  return (
                    <div
                      key={hour}
                      className="absolute right-2 font-mono text-[11px] font-bold text-slate-500 transform -translate-y-1/2"
                      style={{ top: `${topPx}px` }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Engineer Columns */}
            <div className="flex flex-1">
              {engineers.map((eng) => {
                const route = routeByEngId.get(eng.id);
                const isSelected = selectedEngineerId === eng.id;
                const isUnavailable = eng.status === 'unavailable';
                const isPendingUnavailable = eng.status === 'pending_unavailable';
                const stopsCount = route?.stops?.length || 0;

                return (
                  <div
                    key={eng.id}
                    className={`w-[260px] md:w-[280px] shrink-0 border-r border-slate-800 flex flex-col transition-colors ${
                      isSelected ? 'bg-yellow-500/5 ring-1 ring-inset ring-yellow-400/30' : 'bg-slate-900/60'
                    }`}
                  >
                    {/* Column Header (Sticky top) */}
                    <div
                      onClick={() => onSelectEngineer(eng.id)}
                      className={`h-[76px] p-2.5 border-b border-slate-800 cursor-pointer transition-colors flex flex-col justify-between ${
                        isSelected ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs text-white truncate hover:text-beeline-yellow transition-colors">
                          {eng.name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                          isUnavailable
                            ? 'bg-rose-900/40 text-rose-400 border border-rose-800/50'
                            : isPendingUnavailable
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                            : stopsCount > 0
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {isUnavailable ? 'Сход' : isPendingUnavailable ? 'Изменения' : stopsCount > 0 ? `${stopsCount} заяв.` : 'Резерв'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50 font-medium flex items-center gap-1">
                          {getTransportIcon(eng.transport_type)}
                          <span className="truncate max-w-[85px]">{eng.transport_type}</span>
                        </span>
                        <span className="font-mono text-[9px] text-slate-400">
                          {eng.shift_start}–22:00
                        </span>
                      </div>
                    </div>

                    {/* Unified Single VerticalTimeline Component in Compact Mode */}
                    <div className="relative w-full flex-1">
                      <VerticalTimeline
                        route={route}
                        engineer={eng}
                        tasks={tasks}
                        mode="compact"
                        standalone={false}
                        showGridLabels={false}
                        highlightedTaskId={selectedTaskId}
                        onSelectTask={(taskId) => {
                          onSelectTask(taskId);
                          onScrollToTop();
                        }}
                        onFocusTravelSegment={(seg) => {
                          onFocusTravelSegment(seg);
                          onScrollToTop();
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
