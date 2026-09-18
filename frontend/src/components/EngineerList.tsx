import React, { useState } from 'react';
import { EngineerRoute, Engineer, Task } from '../types';
import { 
  Car, Bus, Bike, Footprints, CheckCircle2, 
  Clock, Navigation, Sparkles, Search, Shield, UserX 
} from 'lucide-react';

interface EngineerListProps {
  routes: EngineerRoute[];
  allEngineers: Engineer[];
  tasks?: Task[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  onSelectEngineer: (engineerId: string) => void;
}

const ROUTE_COLORS = [
  '#38bdf8', '#34d399', '#fbbf24', '#a78bfa',
  '#f472b6', '#22d3ee', '#fb923c', '#a3e635',
  '#2dd4bf', '#c084fc', '#f87171', '#818cf8'
];

export const EngineerList: React.FC<EngineerListProps> = ({
  routes,
  allEngineers,
  tasks = [],
  selectedEngineerId,
  selectedTaskId,
  onSelectEngineer
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'idle' | 'unavailable' | 'new' | 'task_assigned'>('all');
  const [skillFilter, setSkillFilter] = useState<string | null>(null);

  const routeByEngId = new Map(routes.map(r => [r.engineer_id, r]));
  const assignedRoute = selectedTaskId ? routes.find(r => r.stops.some(s => s.task_id === selectedTaskId)) : null;

  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'Автомобиль': return <Car className="w-3.5 h-3.5 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3.5 h-3.5 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Car className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filteredEngineers = allEngineers.filter((eng) => {
    const route = routeByEngId.get(eng.id);
    const stopsCount = route?.stops.length || 0;
    const isUnavailable = eng.status === 'unavailable';
    const isNew = eng.status === 'new';
    const isIdle = stopsCount === 0 && !isUnavailable;

    // Search filter
    const searchLower = search.toLowerCase().trim();
    const matchesSearch =
      (eng.name || '').toLowerCase().includes(searchLower) ||
      (eng.id || '').toLowerCase().includes(searchLower) ||
      (eng.transport_type || '').toLowerCase().includes(searchLower) ||
      (eng.skills && eng.skills.some(s => (s || '').toLowerCase().includes(searchLower)));

    if (!matchesSearch) return false;

    if (skillFilter && (!eng.skills || !eng.skills.includes(skillFilter))) return false;

    // Tag filter
    if (filter === 'task_assigned') return assignedRoute ? eng.id === assignedRoute.engineer_id : false;
    if (filter === 'unavailable') return isUnavailable;
    if (filter === 'new') return isNew;
    if (filter === 'idle') return isIdle;
    if (filter === 'active') return stopsCount > 0 && !isUnavailable;

    return true;
  });

  return (
    <div className="space-y-2 flex flex-col h-full">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск инженера по имени, навыку или транспорту..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-beeline-yellow transition-colors"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5">
        {assignedRoute && (
          <button
            onClick={() => setFilter(filter === 'task_assigned' ? 'all' : 'task_assigned')}
            className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors flex items-center gap-1 shrink-0 ${
              filter === 'task_assigned'
                ? 'bg-amber-400 text-slate-950 font-bold ring-2 ring-amber-400/50'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <span>🎯 #{selectedTaskId} ({assignedRoute.engineer_name.replace('Бригада ', '')})</span>
            {filter === 'task_assigned' && <span className="text-[9px]">✕</span>}
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
          Все ({allEngineers.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            filter === 'active'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          В работе ({allEngineers.filter(e => (routeByEngId.get(e.id)?.stops.length || 0) > 0 && e.status !== 'unavailable').length})
        </button>
        <button
          onClick={() => setFilter('idle')}
          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            filter === 'idle'
              ? 'bg-slate-600 text-white font-bold'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Резерв ({allEngineers.filter(e => (routeByEngId.get(e.id)?.stops.length || 0) === 0 && e.status !== 'unavailable').length})
        </button>
        <button
          onClick={() => setFilter('unavailable')}
          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            filter === 'unavailable'
              ? 'bg-rose-500 text-white font-bold'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Сход ({allEngineers.filter(e => e.status === 'unavailable').length})
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
            filter === 'new'
              ? 'bg-sky-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Измененные ({allEngineers.filter(e => e.status === 'new').length})
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

      {/* Engineers scrollable list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredEngineers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Инженеры по заданному фильтру не найдены
          </div>
        ) : (
          filteredEngineers.map((eng) => {
            const route = routeByEngId.get(eng.id);
            const stopsCount = route?.stops?.length || 0;
            const isIdle = stopsCount === 0;
            const isUnavailable = eng.status === 'unavailable';
            const isNew = eng.status === 'new';
            const isSelected = selectedEngineerId === eng.id;

            return (
              <div
                key={eng.id}
                onClick={() => onSelectEngineer(eng.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-500/15 border-yellow-500/50 shadow-md ring-1 ring-yellow-400/40'
                    : isUnavailable
                    ? 'bg-rose-950/20 border-rose-900/30 opacity-60'
                    : isIdle
                    ? 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60'
                    : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                }`}
              >
                {/* Header: Name, Transport, Status */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-xs text-white truncate">
                      {eng.name}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                      {getTransportIcon(eng.transport_type)}
                      <span className="truncate max-w-[80px]">{eng.transport_type}</span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-1">
                    {isUnavailable ? (
                      <span className="bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <UserX className="w-2.5 h-2.5 text-rose-400" />
                        Сход с линии
                      </span>
                    ) : isNew ? (
                      <span className="bg-sky-950 text-sky-300 border border-sky-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                        Изменен (ожидает план)
                      </span>
                    ) : stopsCount > 0 ? (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        {stopsCount} заявок
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                        В резерве
                      </span>
                    )}
                  </div>
                </div>

                {/* Skills tags */}
                {eng.skills && eng.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {eng.skills.map((s, sIdx) => {
                      const isSkillActive = skillFilter === s;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSkillFilter(isSkillActive ? null : s);
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-0.5 cursor-pointer ${
                            isSkillActive
                              ? 'bg-sky-500/20 text-sky-200 border-sky-400 font-medium ring-1 ring-sky-400'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-sky-500/50 hover:text-sky-300'
                          }`}
                          title={`Фильтровать по навыку: ${s}`}
                        >
                          <Shield className="w-2 h-2 text-sky-400" />
                          <span className="truncate max-w-[120px]">{s}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Mileage and travel stats if active */}
                {!isIdle && !isUnavailable && route && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-2.5 h-2.5 text-amber-400" />
                      <span>{route.total_distance_km} км пробег</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-blue-400" />
                      <span>{route.total_travel_min} мин в пути</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
