import React, { useState } from 'react';
import { EngineerRoute, Engineer, Task, TravelSegmentFocus, ScheduleStop } from '../types';
import { 
  Clock, Navigation, Shield, Zap, Sparkles, 
  Car, Bus, Bike, Footprints, AlertTriangle, ChevronDown, ChevronUp, MapPin 
} from 'lucide-react';

export interface VerticalTimelineProps {
  route?: EngineerRoute;
  engineer?: Engineer;
  tasks?: Task[];
  mode?: 'detailed' | 'compact';
  defaultExpanded?: boolean;
  highlightedTaskId?: string | null;
  showGridLabels?: boolean;
  standalone?: boolean;
  onSelectTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onFocusTravelSegment?: (seg: TravelSegmentFocus) => void;
  onCancelTask?: (taskId: string) => void;
}

// Convert "HH:MM" to minutes from midnight
export function parseTimeToMinutes(t?: string, defaultMin = 480): number {
  if (!t) return defaultMin;
  const parts = t.split(':');
  if (parts.length < 2) return defaultMin;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Format minutes from midnight to "HH:MM"
export function formatMinutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Fixed pixel height per hour for the grid (longer vertical layout: 80px per hour)
export const HOUR_HEIGHT_PX = 80;
// Schedule range strictly 08:00 to 22:00 (14 hours, ending strictly at 22:00)
export const SCHEDULE_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
export const SCHEDULE_START_MIN = 480; // 08:00
export const SCHEDULE_END_MIN = 1320; // 22:00
export const TOTAL_HEIGHT_PX = (SCHEDULE_HOURS.length - 1) * HOUR_HEIGHT_PX; // 14 * 80 = 1120px

// Convert minutes to pixel Y position
export function minutesToPx(min: number): number {
  const clamped = Math.max(SCHEDULE_START_MIN, Math.min(SCHEDULE_END_MIN, min));
  return ((clamped - SCHEDULE_START_MIN) / (SCHEDULE_END_MIN - SCHEDULE_START_MIN)) * TOTAL_HEIGHT_PX;
}

export interface TimelineEvent {
  id: string;
  type: 'shift_start' | 'travel' | 'task' | 'shift_end';
  startMin: number;
  endMin: number;
  startTime: string;
  endTime: string;
  stop?: ScheduleStop;
  fullTask?: Task;
  travelKm?: number;
  travelMin?: number;
  fromCoords?: [number, number];
  toCoords?: [number, number];
  fromTitle?: string;
  toTitle?: string;
}

export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
  route,
  engineer,
  tasks = [],
  mode = 'detailed',
  defaultExpanded = true,
  highlightedTaskId = null,
  showGridLabels = true,
  standalone = true,
  onSelectTask,
  onOpenExplanation,
  onFocusTravelSegment,
  onCancelTask
}) => {
  // In compact mode (master schedule board), timeline is NEVER collapsible under an arrow
  const isCompact = mode === 'compact';
  const [isExpanded, setIsExpanded] = useState<boolean>(isCompact ? true : defaultExpanded);

  const stops = route?.stops || [];
  const shiftStart = route?.shift_start || engineer?.shift_start || '09:00';
  const shiftEnd = '22:00'; // Strict canonical shift end at 22:00
  const isUnavailable = engineer?.status === 'unavailable';
  const isPendingUnavailable = engineer?.status === 'pending_unavailable';
  const isIdle = stops.length === 0;

  // Build chronologically ordered events
  const events: TimelineEvent[] = [];
  const shiftStartMin = parseTimeToMinutes(shiftStart, 540);
  const shiftEndMin = parseTimeToMinutes(shiftEnd, 1320);

  // Sort stops strictly by order
  const sortedStops = [...stops].sort((a, b) => (a.order || 0) - (b.order || 0));

  // 2. Sequential stops & travel segments
  sortedStops.forEach((stop, sIdx) => {
    const fullTask = tasks.find((t) => t.id === stop.task_id);
    const startMin = parseTimeToMinutes(stop.start_time, shiftStartMin + 30);
    const taskDuration = fullTask?.duration_min || 45;
    const endMin = parseTimeToMinutes(stop.end_time, startMin + taskDuration);

    const travelDuration = Math.max(1, stop.travel_min || 15);
    const depMin = Math.max(0, startMin - travelDuration);
    const depTime = formatMinutesToTime(depMin);

    const prevCoords: [number, number] = sIdx === 0
      ? [engineer?.start_lon || 37.6, engineer?.start_lat || 55.75]
      : [sortedStops[sIdx - 1].lon, sortedStops[sIdx - 1].lat];

    const prevTitle = sIdx === 0
      ? `База (${route?.engineer_name || engineer?.name || 'Инженер'})`
      : `Остановка #${sortedStops[sIdx - 1].order} (Заявка #${sortedStops[sIdx - 1].task_id})`;

    const toTitle = `Остановка #${stop.order} (Заявка #${stop.task_id}: ${stop.address})`;

    // Travel event
    events.push({
      id: `travel_${stop.task_id}`,
      type: 'travel',
      startMin: depMin,
      endMin: startMin,
      startTime: depTime,
      endTime: stop.start_time,
      travelKm: stop.travel_km,
      travelMin: stop.travel_min,
      fromCoords: prevCoords,
      toCoords: [stop.lon, stop.lat],
      fromTitle: prevTitle,
      toTitle: toTitle,
      stop
    });

    // Task work execution event
    events.push({
      id: `task_${stop.task_id}`,
      type: 'task',
      startMin: startMin,
      endMin: endMin,
      startTime: stop.start_time,
      endTime: stop.end_time,
      stop,
      fullTask
    });
  });

  // Sort chronologically
  events.sort((a, b) => a.startMin - b.startMin);

  // Render a single event block (Unified card for both Engineer Drawer and Master Schedule Board)
  const renderEvent = (ev: TimelineEvent, naturalHeight: number) => {
    // 1. Travel Segment
    if (ev.type === 'travel') {
      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onFocusTravelSegment && ev.fromCoords && ev.toCoords) {
              onFocusTravelSegment({
                from: ev.fromCoords,
                to: ev.toCoords,
                fromTitle: ev.fromTitle,
                toTitle: ev.toTitle,
                engineerId: route?.engineer_id || engineer?.id,
                engineerName: route?.engineer_name || engineer?.name,
                travelMin: ev.travelMin,
                travelKm: ev.travelKm
              });
            }
          }}
          className="w-full h-full rounded-lg cursor-pointer transition-all flex items-center justify-between border shadow-sm select-none overflow-hidden px-2 py-0.5 bg-sky-950/60 hover:bg-sky-900/90 border-sky-800/60 text-[10px] text-sky-200 group-hover:z-50 group-hover:h-auto group-hover:min-h-[32px] group-hover:shadow-lg group-hover:border-amber-400"
          title="Нажмите, чтобы выделить участок пути на карте"
        >
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Navigation className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">
              Переезд к ост. #{ev.stop?.order}: {ev.travelKm} км
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span className="font-mono font-bold text-sky-300 text-[10px]">~{ev.travelMin} мин</span>
          </div>
        </div>
      );
    }

    // 2. Task Stop (Unified card: exact same colors, height, badges, and layout across both views)
    if (ev.type === 'task' && ev.stop) {
      const isTaskCancelled = ev.fullTask?.status === 'cancelled';
      const isUrgent = ev.stop.priority === 'Срочная' && !isTaskCancelled;
      const isCurrentActive = highlightedTaskId === ev.stop.task_id;

      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectTask?.(ev.stop!.task_id);
          }}
          className={`w-full h-full rounded-xl border text-[11px] cursor-pointer transition-all flex flex-col justify-between shadow select-none overflow-hidden p-2 group-hover:h-auto group-hover:min-h-[85px] group-hover:z-50 group-hover:shadow-2xl group-hover:ring-2 group-hover:ring-beeline-yellow/80 group-hover:bg-slate-900 ${
            isCurrentActive
              ? 'bg-yellow-500/20 border-yellow-400 shadow-md ring-2 ring-yellow-400/50'
              : isTaskCancelled
              ? 'bg-slate-950/40 border-slate-800/60 text-slate-500 line-through opacity-50'
              : isUrgent
              ? 'bg-amber-950/60 border-amber-600/80 hover:bg-amber-900/80 text-amber-200'
              : 'bg-slate-900/95 border-slate-800 hover:border-slate-700 text-slate-200'
          }`}
        >
          {/* Row 1: Order badge, Task ID, Urgency, Time Range */}
          <div className="flex items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <div
                className={`w-4 h-4 rounded-full font-black text-[9px] flex items-center justify-center shrink-0 shadow ${
                  isTaskCancelled
                    ? 'bg-slate-700 text-slate-300'
                    : isUrgent
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-beeline-yellow text-slate-950'
                }`}
              >
                {isTaskCancelled ? '✕' : ev.stop.order}
              </div>
              <span className="font-bold text-white truncate text-[11px] hover:text-beeline-yellow transition-colors">
                Заявка #{ev.stop.task_id}
              </span>
              {isUrgent && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-bold shrink-0 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>Срочная</span>
                </span>
              )}
            </div>

            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] font-bold text-beeline-yellow">
                {ev.startTime}–{ev.endTime}
              </span>
            </div>
          </div>

          {/* Row 2: Address with map pin (Always visible on hover, or when naturalHeight >= 45px) */}
          <div className={`text-[10px] text-slate-300 flex items-start gap-1 my-0.5 leading-tight ${
            naturalHeight < 45 ? 'hidden group-hover:flex' : 'flex'
          }`}>
            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            <span className="truncate group-hover:whitespace-normal group-hover:line-clamp-2">{ev.stop.address}</span>
          </div>

          {/* Row 3: Skill & Actions (Visible on hover, or when naturalHeight >= 65px) */}
          <div className={`items-center justify-between pt-1 border-t border-slate-800/60 text-[9px] mt-0.5 ${
            naturalHeight < 65 ? 'hidden group-hover:flex' : 'flex'
          }`}>
            <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.2 rounded font-medium flex items-center gap-1 truncate max-w-[140px]">
              <Shield className="w-2.5 h-2.5 text-blue-400 shrink-0" />
              <span className="truncate">{ev.stop.required_skill}</span>
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenExplanation && !isTaskCancelled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenExplanation(ev.stop!.task_id);
                  }}
                  className="text-[9px] bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-0.5 cursor-pointer transition-colors"
                  title="ИИ-обоснование"
                >
                  <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
                  <span>ИИ</span>
                </button>
              )}

              {onCancelTask && !isTaskCancelled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelTask(ev.stop!.task_id);
                  }}
                  className="text-[9px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                  title="Отменить заявку"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const containerContent = (
    <>
      {/* Detailed Mode Header with Expand Toggle (Compact mode never collapses) */}
      {!isCompact && standalone && (
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 text-xs">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 font-bold text-white hover:text-beeline-yellow transition-colors cursor-pointer text-left"
          >
            <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>Расписание (08:00 – 22:00)</span>
            <span className="text-slate-400 ml-0.5">
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>

          <span className="text-[10px] text-slate-400 font-mono">
            Смена: <strong className="text-beeline-yellow">{shiftStart}–{shiftEnd}</strong>
          </span>
        </div>
      )}

      {(isCompact || isExpanded) && (
        <div className="space-y-1 pt-1">
          {/* Status notices for unavailable or idle engineer */}
          {isUnavailable ? (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-center space-y-1">
              <div className="text-xs font-bold text-rose-300 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Сход с линии</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Инженер снят с дежурства.
              </div>
            </div>
          ) : isPendingUnavailable ? (
            <div className="p-2 bg-amber-950/40 border border-amber-800/80 rounded-lg text-center space-y-1">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Изменения: Сход (ожидает распланирования)</span>
              </div>
            </div>
          ) : isIdle ? (
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-1">
              <Clock className="w-4 h-4 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">Оперативный резерв</div>
              <div className="text-[10px] text-slate-400">
                0 выездов. Дежурство на базе.
              </div>
            </div>
          ) : null}

          {/* Fixed-height vertical grid strictly 08:00 - 22:00 with duration-scaled events */}
          {!isUnavailable && (
            <div className="relative select-none" style={{ height: `${TOTAL_HEIGHT_PX}px` }}>
              {/* Hour grid lines (fixed positions at 80px intervals) */}
              {SCHEDULE_HOURS.map((hour, idx) => {
                const topPx = idx * HOUR_HEIGHT_PX;
                const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 flex items-center gap-2 pointer-events-none"
                    style={{ top: `${topPx}px` }}
                  >
                    {showGridLabels && (
                      <span className="font-mono text-[10px] font-bold text-slate-500 w-10 shrink-0 text-right">
                        {hourLabel}
                      </span>
                    )}
                    <div className="flex-1 flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full border border-slate-700 bg-slate-900" />
                      <div className="flex-1 border-t border-slate-800/60" />
                    </div>
                  </div>
                );
              })}

              {/* Shift Start Side Marker: shifted to side, zero overlap with events */}
              <div
                className="absolute z-20 pointer-events-none flex items-center"
                style={{
                  top: `${minutesToPx(shiftStartMin)}px`,
                  left: showGridLabels ? '52px' : '4px',
                  transform: 'translateY(-100%)'
                }}
              >
                <div className="flex items-center gap-1 bg-emerald-950/95 text-emerald-300 border border-emerald-600/80 rounded px-1.5 py-0.5 shadow text-[9px] font-bold mb-0.5">
                  <span>🏠</span>
                  <span>Начало {shiftStart}</span>
                </div>
              </div>

              {/* Shift End Side Marker: strictly 22:00, shifted to side, zero overlap */}
              <div
                className="absolute z-20 pointer-events-none flex items-center"
                style={{
                  top: `${minutesToPx(shiftEndMin)}px`,
                  left: showGridLabels ? '52px' : '4px',
                  transform: 'translateY(2px)'
                }}
              >
                <div className="flex items-center gap-1 bg-slate-900/95 text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 shadow text-[9px] font-bold mt-0.5">
                  <span>🏁</span>
                  <span>Конец 22:00</span>
                </div>
              </div>

              {/* Events positioned absolutely over the grid without overlapping before hover, expanding on hover */}
              {events.map((ev) => {
                const topPx = minutesToPx(ev.startMin);
                const bottomPx = minutesToPx(ev.endMin);
                const rawHeight = Math.max(12, bottomPx - topPx);
                const naturalHeight = Math.max(12, rawHeight - 2);

                const leftOffset = showGridLabels ? '52px' : '4px';

                return (
                  <div
                    key={ev.id}
                    className="absolute z-10 group transition-all"
                    style={{
                      top: `${topPx}px`,
                      left: leftOffset,
                      right: '4px',
                      height: `${naturalHeight}px`
                    }}
                  >
                    {renderEvent(ev, naturalHeight)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (!standalone) {
    return containerContent;
  }

  return (
    <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-2.5 space-y-2 font-sans">
      {containerContent}
    </div>
  );
};
