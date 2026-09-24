import React from 'react';
import { ScheduleStop, Time, EngineerStatusEnum, Road, PriorityEnum } from '../types';
import { getTimeAbsoluteMinutes, getTimePercentageOfDay } from '../utils/formatters';
import { dataStore } from '../utils/DataStore';

export interface TimelineProps {
  taskIds?: string[];
  roadIds?: string[];
  routes?: ScheduleStop[];
  shift_start?: Time;
  shift_end?: Time;
  status?: EngineerStatusEnum;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  engineerPosition?: { lat: number; lon: number };
  engineerName?: string;
  onSelectTask?: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
  onSetFocus?: (focus: { kind: 'engineer' | 'task' | 'road'; id: string } | null) => void;
  showHourMarks?: boolean;
  compact?: boolean;
  orientation?: 'vertical' | 'horizontal';
  height?: number | string; // default: '100%'
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  taskIds,
  roadIds,
  routes = [],
  shift_start,
  shift_end,
  status,
  selectedTaskId,
  selectedRoadId,
  engineerPosition,
  engineerName,
  onSelectTask,
  onSelectRoad,
  onFocusTravelSegment,
  onSetFocus,
  showHourMarks = false,
  compact = false,
  orientation = 'vertical',
  height = '100%',
  className = '',
}) => {
  const isUnavailable = status === EngineerStatusEnum.UNAVAILABLE;

  // Resolve roads via dataStore
  const resolvedRoads: Road[] = React.useMemo(() => {
    if (roadIds && roadIds.length > 0) {
      return roadIds
        .map((rId) => dataStore.find_by_id_roads(rId))
        .filter((r): r is Road => r !== undefined);
    }
    return [];
  }, [roadIds]);

  const hasRoads = resolvedRoads.length > 0;
  const hasRoutes = routes.length > 0;
  const hasTasks = !!(taskIds && taskIds.length > 0);
  const isIdle = !hasRoads && !hasRoutes && !hasTasks;

  // 2-hour interval marks for 24h
  const hourMarks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  // Shift boundaries calculation
  const shiftTopPct = shift_start ? getTimePercentageOfDay(shift_start) : null;
  const shiftHeightPct =
    shift_start && shift_end
      ? Math.max(0, ((getTimeAbsoluteMinutes(shift_end) - getTimeAbsoluteMinutes(shift_start)) / 1440) * 100)
      : null;

  // ==========================================
  // 1. VERTICAL TIMELINE (Primary Mode)
  // ==========================================
  if (orientation === 'vertical') {
    const containerStyle: React.CSSProperties = {
      height: typeof height === 'number' ? `${height}px` : height || '100%',
    };
    const totalHeightPx = typeof height === 'number' ? height : 750;

    return (
      <div className={`relative flex flex-row w-full h-full ${className}`} style={containerStyle}>
        {/* Optional left hour scale */}
        {showHourMarks && (
          <div className="w-10 shrink-0 relative select-none font-mono text-[9px] text-slate-500 h-full">
            {hourMarks.map((h) => {
              const pct = (h / 24) * 100;
              return (
                <div
                  key={h}
                  className="absolute left-0 transform -translate-y-1/2"
                  style={{ top: `${pct}%` }}
                >
                  {h < 10 ? `0${h}:00` : `${h}:00`}
                </div>
              );
            })}
          </div>
        )}

        {/* Main Vertical Track */}
        <div className="relative flex-1 bg-slate-950/70 rounded-lg border border-slate-800/80 overflow-visible select-none h-full">
          {/* Horizontal Grid lines across 24h */}
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-b border-slate-800/40 pointer-events-none"
              style={{ top: `${(h / 24) * 100}%` }}
            />
          ))}

          {/* Shift window boundary */}
          {shiftTopPct !== null && shiftHeightPct !== null && (
            <div
              className="absolute left-0 right-0 bg-slate-800/20 border-t border-b border-slate-700/40 pointer-events-none"
              style={{ top: `${shiftTopPct}%`, height: `${shiftHeightPct}%` }}
              title={`Смена/Окно: ${shift_start?.time} - ${shift_end?.time}`}
            />
          )}

          {/* Unavailable overlay */}
          {isUnavailable && (
            <div className="absolute inset-0 bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-center p-3 text-center z-20">
              Инженер сошел с линии (недоступен)
            </div>
          )}

          {/* Idle overlay */}
          {!isUnavailable && isIdle && (
            <div className="absolute inset-0 text-slate-500 text-xs flex items-center justify-center font-medium">
              Резерв (0 выездов)
            </div>
          )}

          {/* Mode A: Active roads rendering */}
          {!isUnavailable && hasRoads && (
            <>
              {resolvedRoads.map((road, rIdx) => {
                const depTimeMin = getTimeAbsoluteMinutes(road.start_time);
                const arrTimeMin = getTimeAbsoluteMinutes(road.end_time);
                const travelDurationMin = Math.max(0, road.travel_min || (arrTimeMin - depTimeMin) || 0);

                // Strictly proportional height: (duration / 1440) * 100%, NO minHeight!
                const roadTopPct = (depTimeMin / 1440) * 100;
                const roadHeightPct = (travelDurationMin / 1440) * 100;

                const roadPixelHeight = (travelDurationMin / 1440) * totalHeightPx;
                const canFitRoadText = roadPixelHeight >= 16;

                const taskId = road.task_second_id;
                const targetTask = taskId ? dataStore.find_by_id_task(taskId) : null;
                const isTaskCancelled = targetTask?.status === 'cancelled';
                const isTaskSelected = !!taskId && selectedTaskId === taskId;
                const isRoadSelected = !!road.id && selectedRoadId === road.id;
                const isUrgent = targetTask?.priority === PriorityEnum.URGENT;

                const taskDurationMin = targetTask?.duration_time?.absolute_time || 30;
                // Strictly proportional height: (duration / 1440) * 100%, NO minHeight!
                const taskTopPct = (arrTimeMin / 1440) * 100;
                const taskHeightPct = (taskDurationMin / 1440) * 100;

                const taskPixelHeight = (taskDurationMin / 1440) * totalHeightPx;
                const canFitTaskText = taskPixelHeight >= 16;

                return (
                  <React.Fragment key={road.id || rIdx}>
                    {/* Travel segment */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetFocus && road.id) onSetFocus({ kind: 'road', id: road.id });
                        if (onSelectRoad && road.id) onSelectRoad(road.id);
                        if (onFocusTravelSegment && road.from_pos && road.to_pos) {
                          onFocusTravelSegment({
                            from: [road.from_pos.lon, road.from_pos.lat],
                            to: [road.to_pos.lon, road.to_pos.lat],
                            travelMin: road.travel_min,
                            travelKm: road.travel_km,
                            engineerName,
                          });
                        }
                      }}
                      style={{
                        top: `${roadTopPct}%`,
                        height: `${roadHeightPct}%`,
                      }}
                      className="group absolute left-1.5 right-1.5 cursor-pointer z-10 hover:z-50"
                    >
                      {/* Compact colored stripe with overflow-hidden */}
                      <div
                        className={`w-full h-full rounded-[2px] overflow-hidden flex items-center justify-between px-1 text-[9px] font-semibold transition-colors ${
                          isRoadSelected
                            ? 'bg-cyan-400 border-2 border-white ring-2 ring-white/60 shadow-lg text-slate-950 font-bold'
                            : 'bg-sky-500/90 hover:bg-cyan-400 text-sky-100 hover:text-slate-950'
                        }`}
                      >
                        {canFitRoadText && (
                          <>
                            <span className="truncate">🚗 {road.travel_min}м</span>
                            {roadPixelHeight >= 22 && (
                              <span className="font-mono text-[8px] opacity-80 shrink-0">{road.travel_km}км</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* 100% OPAQUE Floating Expansion Card with smooth CSS transition */}
                      <div className="absolute top-0 left-0 min-w-[270px] w-max max-w-xs p-3 rounded-xl bg-slate-950 border border-cyan-500/80 shadow-2xl shadow-black z-50 opacity-0 pointer-events-none scale-95 origin-top-left transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 text-slate-100">
                        <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-slate-800 pb-1 text-xs">
                          <span>🚗 В пути</span>
                          <span className="font-mono shrink-0">{road.travel_min} мин ({road.travel_km} км)</span>
                        </div>
                        <div className="text-[11px] text-slate-300 space-y-1.5 pt-1.5 leading-snug">
                          {road.from_pos?.address && (
                            <div className="break-words whitespace-normal">
                              <strong className="text-slate-400">От:</strong> {road.from_pos.address}
                            </div>
                          )}
                          {(road.to_pos?.address || targetTask?.position?.address) && (
                            <div className="break-words whitespace-normal">
                              <strong className="text-slate-400">До:</strong> {road.to_pos?.address || targetTask?.position?.address}
                            </div>
                          )}
                          {road.start_time?.time && road.end_time?.time && (
                            <div className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 w-fit">
                              {road.start_time.time} – {road.end_time.time}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Task execution segment */}
                    {taskId && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSetFocus) onSetFocus({ kind: 'task', id: taskId });
                          if (onSelectTask) onSelectTask(taskId);
                        }}
                        style={{
                          top: `${taskTopPct}%`,
                          height: `${taskHeightPct}%`,
                        }}
                        className="group absolute left-1 right-1 cursor-pointer z-10 hover:z-50"
                      >
                        {/* Compact colored task bar with overflow-hidden */}
                        <div
                          className={`w-full h-full rounded overflow-hidden flex items-center justify-between px-1 text-[10px] font-bold border transition-colors ${
                            isTaskCancelled
                              ? 'bg-slate-700 text-slate-400 border-slate-600 line-through'
                              : isUrgent
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow'
                          } ${
                            isTaskSelected
                              ? 'border-2 border-white ring-2 ring-white/60 shadow-xl scale-[1.02]'
                              : selectedTaskId
                              ? 'opacity-60 hover:opacity-100'
                              : 'opacity-100'
                          }`}
                        >
                          {canFitTaskText && (
                            <>
                              <span className="truncate">
                                {isTaskCancelled ? `✕ #${taskId}` : isUrgent ? `⚡ #${taskId}` : `#${taskId}`}
                              </span>
                              {taskPixelHeight >= 22 && (
                                <span className="text-[9px] font-mono opacity-80 shrink-0">
                                  {taskDurationMin}м
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* 100% OPAQUE Floating Expansion Card with smooth CSS transition */}
                        <div className="absolute top-0 left-0 min-w-[270px] w-max max-w-xs p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl shadow-black z-50 opacity-0 pointer-events-none scale-95 origin-top-left transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 text-slate-100">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                            <span className="font-extrabold text-white text-sm break-words">
                              #{taskId} {isUrgent ? '⚡ Срочная' : 'Заявка'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              isTaskCancelled
                                ? 'bg-slate-800 text-slate-400'
                                : isUrgent
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {isTaskCancelled ? 'Отменена' : targetTask?.engineer_id ? 'Назначена' : 'Новая'}
                            </span>
                          </div>

                          <div className="text-[11px] space-y-1.5 pt-2 text-slate-300 leading-snug">
                            {targetTask?.position?.address && (
                              <div className="flex items-start gap-1.5 break-words whitespace-normal">
                                <span className="text-slate-400 shrink-0">📍</span>
                                <span className="font-medium text-slate-100">
                                  {targetTask.position.address}
                                </span>
                              </div>
                            )}
                            {targetTask?.district && (
                              <div className="text-[10px] text-slate-400 break-words whitespace-normal">
                                Округ: <strong className="text-slate-300">{targetTask.district}</strong>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                              <span>Окно: {targetTask?.window_start?.time || '—'} – {targetTask?.window_end?.time || '—'}</span>
                              <span className="shrink-0">{taskDurationMin} мин</span>
                            </div>
                            {targetTask?.required_skill && (
                              <div className="flex items-center gap-1.5 text-[10px] pt-0.5 border-t border-slate-800/80">
                                <span className="text-slate-400 shrink-0">Навык:</span>
                                <span className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 font-medium break-words">
                                  {targetTask.required_skill}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}

          {/* Mode B: Standalone tasks (fallback or unassigned) */}
          {!isUnavailable && !hasRoads && hasTasks && (
            <>
              {taskIds!.map((tId) => {
                const targetTask = dataStore.find_by_id_task(tId);
                if (!targetTask) return null;
                const isTaskCancelled = targetTask.status === 'cancelled';
                const isTaskSelected = selectedTaskId === tId;
                const isUrgent = targetTask.priority === PriorityEnum.URGENT;
                const startMin = targetTask.window_start
                  ? getTimeAbsoluteMinutes(targetTask.window_start)
                  : 540;
                const durationMin = targetTask.duration_time?.absolute_time || 60;
                // Strictly proportional height: (duration / 1440) * 100%, NO minHeight!
                const taskTopPct = (startMin / 1440) * 100;
                const taskHeightPct = (durationMin / 1440) * 100;

                const taskPixelHeight = (durationMin / 1440) * totalHeightPx;
                const canFitTaskText = taskPixelHeight >= 16;

                return (
                  <div
                    key={tId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSetFocus) onSetFocus({ kind: 'task', id: tId });
                      if (onSelectTask) onSelectTask(tId);
                    }}
                    style={{
                      top: `${taskTopPct}%`,
                      height: `${taskHeightPct}%`,
                    }}
                    className="group absolute left-1 right-1 cursor-pointer z-10 hover:z-50"
                  >
                    <div
                      className={`w-full h-full rounded overflow-hidden flex items-center justify-between px-1 text-[10px] font-bold border transition-colors ${
                        isTaskCancelled
                          ? 'bg-slate-700 text-slate-400 border-slate-600 line-through'
                          : isUrgent
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow'
                      } ${
                        isTaskSelected
                          ? 'border-2 border-white ring-2 ring-white/60 shadow-xl scale-[1.02]'
                          : selectedTaskId
                          ? 'opacity-60 hover:opacity-100'
                          : 'opacity-100'
                      }`}
                    >
                      {canFitTaskText && (
                        <>
                          <span className="truncate">#{tId}</span>
                          {taskPixelHeight >= 22 && (
                            <span className="text-[9px] font-mono opacity-80 shrink-0">{durationMin}м</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* 100% OPAQUE Floating Expansion Card with smooth CSS transition */}
                    <div className="absolute top-0 left-0 min-w-[270px] w-max max-w-xs p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl shadow-black z-50 opacity-0 pointer-events-none scale-95 origin-top-left transition-all duration-200 ease-out group-hover:opacity-100 group-hover:scale-100 text-slate-100">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 gap-2">
                        <span className="font-extrabold text-white text-xs break-words">#{tId}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                          {isUrgent ? 'Срочная' : 'Заявка'}
                        </span>
                      </div>
                      <div className="text-[11px] space-y-1.5 pt-1.5 text-slate-300 leading-snug">
                        {targetTask.position?.address && (
                          <div className="flex items-start gap-1.5 break-words whitespace-normal">
                            <span className="text-slate-400 shrink-0">📍</span>
                            <span className="font-medium text-slate-100">
                              {targetTask.position.address}
                            </span>
                          </div>
                        )}
                        {targetTask.district && (
                          <div className="text-[10px] text-slate-400 break-words whitespace-normal">
                            Округ: <strong className="text-slate-300">{targetTask.district}</strong>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                          Окно: {targetTask.window_start?.time || '—'} – {targetTask.window_end?.time || '—'} ({durationMin} мин)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. HORIZONTAL TIMELINE (Compact Ribbon)
  // ==========================================
  const shiftLeftPct = shiftTopPct;
  const shiftWidthPct = shiftHeightPct;

  return (
    <div className={`w-full flex flex-col gap-1 ${className}`}>
      {showHourMarks && (
        <div className="relative h-4 text-[9px] text-slate-400 select-none">
          {hourMarks.map((h) => {
            const pct = (h / 24) * 100;
            return (
              <div
                key={h}
                className="absolute transform -translate-x-1/2 font-mono text-[9px] text-slate-500"
                style={{ left: `${pct}%` }}
              >
                {h < 10 ? `0${h}:00` : `${h}:00`}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`relative ${
          compact ? 'h-5' : 'h-6'
        } bg-slate-950/70 rounded overflow-hidden border border-slate-800/80 w-full`}
      >
        {/* Grid lines */}
        {hourMarks.map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-r border-slate-800/40 pointer-events-none"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}

        {/* Shift window boundary background */}
        {shiftLeftPct !== null && shiftWidthPct !== null && (
          <div
            className="absolute top-0 bottom-0 bg-slate-800/25 border-l border-r border-slate-700/40 pointer-events-none"
            style={{ left: `${shiftLeftPct}%`, width: `${shiftWidthPct}%` }}
            title={`Смена/Окно: ${shift_start?.time} - ${shift_end?.time}`}
          />
        )}

        {/* Unavailable overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[10px] font-semibold flex items-center justify-center z-20">
            Инженер сошел с линии (недоступен)
          </div>
        )}

        {/* Idle overlay */}
        {!isUnavailable && isIdle && (
          <div className="absolute inset-0 text-slate-500 text-[10px] flex items-center justify-center font-medium">
            Резерв (0 выездов)
          </div>
        )}

        {/* Mode A: Active roads rendering */}
        {!isUnavailable && hasRoads && (
          <>
            {resolvedRoads.map((road, rIdx) => {
              const depTimeMin = getTimeAbsoluteMinutes(road.start_time);
              const arrTimeMin = getTimeAbsoluteMinutes(road.end_time);
              const travelDurationMin = Math.max(0, road.travel_min || (arrTimeMin - depTimeMin) || 0);
              const travelLeftPct = (depTimeMin / 1440) * 100;
              const travelWidthPct = (travelDurationMin / 1440) * 100;

              const taskId = road.task_second_id;
              const targetTask = taskId ? dataStore.find_by_id_task(taskId) : null;
              const isTaskCancelled = targetTask?.status === 'cancelled';
              const isTaskSelected = !!taskId && selectedTaskId === taskId;
              const isRoadSelected = !!road.id && selectedRoadId === road.id;

              const taskDurationMin = targetTask?.duration_time?.absolute_time || 30;
              const workLeftPct = (arrTimeMin / 1440) * 100;
              const workWidthPct = (taskDurationMin / 1440) * 100;

              return (
                <React.Fragment key={road.id || rIdx}>
                  {/* Travel segment */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSetFocus && road.id) onSetFocus({ kind: 'road', id: road.id });
                      if (onSelectRoad && road.id) onSelectRoad(road.id);
                      if (onFocusTravelSegment && road.from_pos && road.to_pos) {
                        onFocusTravelSegment({
                          from: [road.from_pos.lon, road.from_pos.lat],
                          to: [road.to_pos.lon, road.to_pos.lat],
                          travelMin: road.travel_min,
                          travelKm: road.travel_km,
                          engineerName,
                        });
                      }
                    }}
                    className={`absolute top-1 bottom-1 rounded-[2px] transition-all cursor-pointer z-10 ${
                      isRoadSelected
                        ? 'bg-cyan-400 ring-2 ring-cyan-300 z-30 shadow-lg scale-y-125'
                        : 'bg-sky-500/80 hover:bg-sky-400 hover:ring-1 hover:ring-sky-300'
                    }`}
                    style={{ left: `${travelLeftPct}%`, width: `${travelWidthPct}%` }}
                    title={`Дорога: ${road.travel_min} мин (${road.travel_km} км) к #${taskId || 'точке'}`}
                  />

                  {/* Work execution segment */}
                  {taskId && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetFocus) onSetFocus({ kind: 'task', id: taskId });
                        if (onSelectTask) onSelectTask(taskId);
                      }}
                      className={`absolute top-0.5 bottom-0.5 font-bold text-[9px] rounded flex items-center justify-center overflow-hidden transition-all cursor-pointer px-0.5 ${
                        isTaskCancelled
                          ? 'bg-slate-600 hover:bg-slate-500 text-slate-300 border border-slate-500 line-through opacity-75'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300 shadow-sm'
                      } ${
                        isTaskSelected
                          ? 'border-2 border-white ring-2 ring-white/60 scale-105 z-30 shadow-md'
                          : selectedTaskId
                          ? 'opacity-40 hover:opacity-100 z-10'
                          : 'opacity-100 z-10'
                      }`}
                      style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                      title={
                        isTaskCancelled
                          ? `Заявка #${taskId} ОТМЕНЕНА (будет удалена при пересчете)`
                          : `Заявка #${taskId}: ${targetTask?.position?.address || road.to_pos.address || ''} (${road.end_time.time})`
                      }
                    >
                      <span className="truncate">
                        {isTaskCancelled ? `✕ #${taskId}` : `#${taskId}`}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* Mode B: Fallback ScheduleStop[] rendering */}
        {!isUnavailable && !hasRoads && hasRoutes && (
          <>
            {routes.map((stop, sIdx) => {
              const startTimeMin = getTimeAbsoluteMinutes(stop.start_time);
              const endTimeMin = getTimeAbsoluteMinutes(stop.end_time);

              const travelDurationMin = Math.max(0, stop.travel_min || 0);
              const depTimeMin = Math.max(0, startTimeMin - travelDurationMin);
              const travelLeftPct = (depTimeMin / 1440) * 100;
              const travelWidthPct = (travelDurationMin / 1440) * 100;

              const workLeftPct = (startTimeMin / 1440) * 100;
              const workWidthPct = ((endTimeMin - startTimeMin) / 1440) * 100;

              const fullTask = stop.task_id ? dataStore.find_by_id_task(stop.task_id) : undefined;
              const isTaskCancelled = fullTask?.status === 'cancelled';
              const isTaskSelected = selectedTaskId === stop.task_id;

              const prevCoords: [number, number] =
                sIdx === 0 && engineerPosition
                  ? [engineerPosition.lon, engineerPosition.lat]
                  : sIdx > 0
                  ? [routes[sIdx - 1].position.lon, routes[sIdx - 1].position.lat]
                  : [stop.position.lon, stop.position.lat];

              return (
                <React.Fragment key={stop.task_id || sIdx}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onFocusTravelSegment) {
                        onFocusTravelSegment({
                          from: prevCoords,
                          to: [stop.position.lon, stop.position.lat],
                          travelMin: stop.travel_min,
                          travelKm: stop.travel_km,
                          engineerName,
                        });
                      }
                    }}
                    className="absolute top-1 bottom-1 bg-sky-500/80 hover:bg-sky-400 hover:ring-1 hover:ring-sky-300 rounded-[2px] transition-all cursor-pointer z-10"
                    style={{ left: `${travelLeftPct}%`, width: `${travelWidthPct}%` }}
                    title={`Кликните, чтобы показать путь на карте: ${stop.travel_min} мин (${stop.travel_km} км) к #${stop.task_id}`}
                  />

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSetFocus) onSetFocus({ kind: 'task', id: stop.task_id });
                      if (onSelectTask) onSelectTask(stop.task_id);
                    }}
                    className={`absolute top-0.5 bottom-0.5 font-bold text-[9px] rounded flex items-center justify-center overflow-hidden transition-all cursor-pointer px-0.5 ${
                      isTaskCancelled
                        ? 'bg-slate-600 hover:bg-slate-500 text-slate-300 border border-slate-500 line-through opacity-75'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300 shadow-sm'
                    } ${
                      isTaskSelected
                        ? 'border-2 border-white ring-2 ring-white/60 scale-105 z-30 shadow-md'
                        : selectedTaskId
                        ? 'opacity-40 hover:opacity-100 z-10'
                        : 'opacity-100 z-10'
                    }`}
                    style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                    title={
                      isTaskCancelled
                        ? `Заявка #${stop.task_id} ОТМЕНЕНА (будет удалена при пересчете)`
                        : `Заявка #${stop.task_id}: ${stop.position.address} (${stop.start_time.time} - ${stop.end_time.time})`
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

        {/* Mode C: Standalone tasks */}
        {!isUnavailable && !hasRoads && !hasRoutes && hasTasks && (
          <>
            {taskIds!.map((tId) => {
              const targetTask = dataStore.find_by_id_task(tId);
              if (!targetTask) return null;
              const isTaskCancelled = targetTask.status === 'cancelled';
              const isTaskSelected = selectedTaskId === tId;
              const startMin = targetTask.window_start
                ? getTimeAbsoluteMinutes(targetTask.window_start)
                : 540;
              const durationMin = targetTask.duration_time?.absolute_time || 60;
              const workLeftPct = (startMin / 1440) * 100;
              const workWidthPct = (durationMin / 1440) * 100;

              return (
                <div
                  key={tId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSetFocus) onSetFocus({ kind: 'task', id: tId });
                    if (onSelectTask) onSelectTask(tId);
                  }}
                  className={`absolute top-0.5 bottom-0.5 font-bold text-[9px] rounded flex items-center justify-center overflow-hidden transition-all cursor-pointer px-1 ${
                    isTaskCancelled
                      ? 'bg-slate-600 hover:bg-slate-500 text-slate-300 border border-slate-500 line-through opacity-75'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300 shadow-sm'
                  } ${
                    isTaskSelected
                      ? 'border-2 border-white ring-2 ring-white/60 scale-105 z-30 shadow-md'
                      : selectedTaskId
                      ? 'opacity-40 hover:opacity-100 z-10'
                      : 'opacity-100 z-10'
                  }`}
                  style={{ left: `${workLeftPct}%`, width: `${workWidthPct}%` }}
                  title={`Заявка #${tId}: ${targetTask.position?.address || ''}`}
                >
                  <span className="truncate">#{tId}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
