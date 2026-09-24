import React from 'react';
import { EngineerStatusEnum, Focus } from '../types';
import { dataStore } from '../utils/DataStore';
import { Clock, Users, ArrowRight } from 'lucide-react';
import { getTransportProps } from '../utils/formatters';
import { Timeline } from './Timeline';

export interface GlobalTimelineProps {
  engineerIds: string[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  focus?: Focus;
  onSetFocus?: (focus: Focus) => void;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
}

const ENGINEER_COLORS = [
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#6366f1', // Indigo
];

export const GlobalTimeline: React.FC<GlobalTimelineProps> = ({
  engineerIds,
  selectedEngineerId,
  selectedTaskId,
  selectedRoadId,
  focus,
  onSetFocus,
  onSelectEngineer,
  onSelectTask,
  onSelectRoad,
  onFocusTravelSegment,
}) => {
  // 2-hour interval marks for 24h
  const hourMarks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  // Derive active focus entities
  const effectiveEngineerId =
    focus?.kind === 'engineer'
      ? focus.id
      : focus?.kind === 'road'
      ? dataStore.find_by_id_roads(focus.id)?.engineer_id || null
      : selectedEngineerId;

  const effectiveTaskId =
    focus?.kind === 'task'
      ? focus.id
      : selectedTaskId;

  const effectiveRoadId =
    focus?.kind === 'road'
      ? focus.id
      : selectedRoadId;

  const handleSelectEngineer = (engId: string) => {
    if (onSetFocus) onSetFocus({ kind: 'engineer', id: engId });
    onSelectEngineer(engId);
  };

  const handleSelectTask = (taskId: string) => {
    if (onSetFocus) onSetFocus({ kind: 'task', id: taskId });
    if (onSelectTask) onSelectTask(taskId);
  };

  const handleSelectRoad = (roadId: string) => {
    if (onSetFocus) onSetFocus({ kind: 'road', id: roadId });
    if (onSelectRoad) onSelectRoad(roadId);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col w-full h-full max-h-full overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-5 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">Доска расписания инженеров</span>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">
                00:00 – 24:00
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Users className="w-3 h-3 text-slate-500" />
              <span>{engineerIds.length} инженеров на линии</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Горизонтальный скролл доски</span>
              <ArrowRight className="w-3 h-3 text-slate-500 inline" />
            </div>
          </div>
        </div>

        {/* Clean High-Contrast Legend */}
        <div className="flex items-center gap-3 text-[11px] bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
            <span className="text-slate-300">В пути</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span className="text-slate-300">Работы</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span className="text-amber-300">Срочно</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 ring-2 ring-white"></span>
            <span className="text-cyan-200 font-bold">Выбрано</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 line-through"></span>
            <span className="text-slate-400">Отмена</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/60 border border-rose-500"></span>
            <span className="text-rose-300">Сход</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700"></span>
            <span className="text-slate-400">Резерв</span>
          </div>
        </div>
      </div>

      {/* Main Horizontally Scrollable Columns Board (stretches to remaining vertical height) */}
      <div className="flex-1 min-h-0 flex flex-row overflow-x-auto overflow-y-hidden p-3 gap-3 items-stretch select-none">
        {/* Sticky Left Shared Vertical Time Scale */}
        <div className="w-12 shrink-0 sticky left-0 z-30 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 flex flex-col h-full select-none">
          {/* Header Spacer matching engineer cards */}
          <div className="h-[76px] shrink-0 border-b border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Время
          </div>

          {/* Time axis scale (00:00 – 24:00) */}
          <div className="flex-1 relative w-full">
            {hourMarks.map((h) => {
              const pct = (h / 24) * 100;
              return (
                <div
                  key={h}
                  className="absolute left-0 right-0 transform -translate-y-1/2 flex items-center justify-end pr-1.5 gap-1"
                  style={{ top: `${pct}%` }}
                >
                  <span className="font-mono text-[9px] text-slate-400">
                    {h < 10 ? `0${h}:00` : `${h}:00`}
                  </span>
                  <span className="w-1 h-[1px] bg-slate-600 shrink-0"></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Horizontal Tape of Engineer Columns */}
        <div className="flex flex-row gap-3 h-full items-stretch">
          {engineerIds.map((engId, engIdx) => {
            const eng = dataStore.find_by_id_engineer(engId);
            if (!eng) return null;

            const stopsCount = eng.tasks?.length || 0;
            const isSelected = effectiveEngineerId === eng.id;
            const isUnavailable = eng.status === EngineerStatusEnum.UNAVAILABLE;
            const isIdle = stopsCount === 0;
            const hasSelectedTask = effectiveTaskId ? eng.tasks?.includes(effectiveTaskId) : false;
            const hasSelectedRoad = effectiveRoadId ? eng.roads?.includes(effectiveRoadId) : false;

            const color = ENGINEER_COLORS[engIdx % ENGINEER_COLORS.length];
            const transportProps = getTransportProps(eng.transport_type);
            const TransportIcon = transportProps.icon;

            return (
              <div
                key={eng.id}
                className={`w-56 shrink-0 flex flex-col h-full rounded-xl border transition-all duration-200 overflow-visible ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-400/50 shadow-2xl bg-cyan-950/20'
                    : hasSelectedTask || hasSelectedRoad
                    ? 'border-cyan-500/70 ring-1 ring-cyan-500/40 bg-slate-900 shadow-lg'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                {/* Column Header: Sticky Engineer Card */}
                <div
                  onClick={() => handleSelectEngineer(eng.id)}
                  className={`h-[76px] shrink-0 p-2 rounded-t-xl border-b border-slate-800 flex flex-col justify-between cursor-pointer select-none transition-colors ${
                    isSelected
                      ? 'bg-cyan-950/40'
                      : 'bg-slate-950/90 hover:bg-slate-900/90'
                  }`}
                  title={`Выбрать инженера: ${eng.name}`}
                >
                  {/* Top row: color dot, name, transport */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-700 shadow-sm"
                        style={{ backgroundColor: isSelected ? '#00f0ff' : color }}
                      />
                      <span
                        className={`font-bold text-xs truncate ${
                          isSelected ? 'text-cyan-300 font-extrabold' : 'text-slate-100'
                        }`}
                      >
                        {eng.name.replace('Бригада ', '')}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 shrink-0 ${transportProps.colorClass}`}
                      title={transportProps.label}
                    >
                      <TransportIcon className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Bottom row: status pill and shift time */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    {isSelected ? (
                      <span className="font-extrabold text-[9px] bg-cyan-400 text-slate-950 px-1.5 py-0.5 rounded shadow">
                        ВЫБРАН
                      </span>
                    ) : isUnavailable ? (
                      <span className="font-bold text-[9px] bg-rose-950/60 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded">
                        Сход
                      </span>
                    ) : isIdle ? (
                      <span className="font-bold text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        Резерв
                      </span>
                    ) : (
                      <span className="font-bold text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                        {stopsCount} {stopsCount === 1 ? 'выезд' : 'выездов'}
                      </span>
                    )}

                    <span className="text-slate-400 font-mono text-[9px]">
                      {eng.shift_start?.time || '09:00'} – {eng.shift_end?.time || '21:00'}
                    </span>
                  </div>
                </div>

                {/* Column Body: Vertical Timeline stretching to full height */}
                <div className="flex-1 min-h-0 p-1 relative overflow-visible">
                  <Timeline
                    roadIds={eng.roads}
                    taskIds={eng.tasks}
                    shift_start={eng.shift_start}
                    shift_end={eng.shift_end}
                    status={eng.status}
                    selectedTaskId={effectiveTaskId}
                    selectedRoadId={effectiveRoadId}
                    engineerPosition={{ lat: eng.position.lat, lon: eng.position.lon }}
                    engineerName={eng.name}
                    onSelectTask={handleSelectTask}
                    onSelectRoad={handleSelectRoad}
                    onSetFocus={onSetFocus}
                    onFocusTravelSegment={onFocusTravelSegment}
                    orientation="vertical"
                    height="100%"
                    showHourMarks={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
