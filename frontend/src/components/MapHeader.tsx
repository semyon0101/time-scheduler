import React from 'react';
import { Focus } from '../types';
import { dataStore } from '../utils/DataStore';

export interface MapHeaderProps {
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  focus?: Focus;
  focusedSegment?: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  } | null;
  onClearSelection: () => void;
}

export const MapHeader: React.FC<MapHeaderProps> = ({
  selectedEngineerId,
  selectedTaskId,
  selectedRoadId,
  focus,
  focusedSegment,
  onClearSelection,
}) => {
  const effectiveEngId =
    focus?.kind === 'engineer'
      ? focus.id
      : focus?.kind === 'road'
      ? dataStore.find_by_id_roads(focus.id)?.engineer_id || null
      : selectedEngineerId;

  const effectiveTaskId = focus?.kind === 'task' ? focus.id : selectedTaskId;
  const effectiveRoadId = focus?.kind === 'road' ? focus.id : selectedRoadId;

  const selectedEngineer = effectiveEngId ? dataStore.find_by_id_engineer(effectiveEngId) : null;
  const selectedRoad = effectiveRoadId ? dataStore.find_by_id_roads(effectiveRoadId) : null;

  return (
    <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Карта маршрутов
        </span>
        {effectiveEngId && selectedEngineer && (
          <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] px-2 py-0.5 rounded font-medium">
            Инженер: {selectedEngineer.name.replace('Бригада ', '')}
          </span>
        )}
        {effectiveTaskId && (
          <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] px-2 py-0.5 rounded font-medium">
            Заявка #{effectiveTaskId}
          </span>
        )}
        {effectiveRoadId && selectedRoad && (
          <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] px-2 py-0.5 rounded font-medium">
            Путь: {selectedRoad.travel_min} мин ({selectedRoad.travel_km} км)
          </span>
        )}
      </div>

      {(effectiveEngId || effectiveTaskId || effectiveRoadId || focusedSegment) && (
        <button
          onClick={onClearSelection}
          className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
        >
          Сбросить фильтр
        </button>
      )}
    </div>
  );
};
