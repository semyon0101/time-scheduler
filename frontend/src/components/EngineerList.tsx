import React, { useState } from 'react';
import { Engineer, EngineerRoute, TravelSegmentFocus } from '../types';
import { 
  Users, Search, Shield, Clock, MapPin, Car, Bus, Bike, 
  Footprints, AlertTriangle, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { 
  ENGINEER_SEARCH_MODIFIERS, 
  EngineerModifier, 
  CANONICAL_SKILLS, 
  ENGINEER_TAG_TRANSPORTS,
  getEngineerModifierState, 
  getEngineerTags, 
  matchesSearchQuery, 
  matchesSelectedTags 
} from '../utils/tags';

interface EngineerListProps {
  engineers: Engineer[];
  routes: EngineerRoute[];
  selectedEngineerId: string | null;
  selectedTaskId: string | null;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask: (taskId: string) => void;
  onFocusTravelSegment?: (segment: TravelSegmentFocus) => void;
}

export const EngineerList: React.FC<EngineerListProps> = ({
  engineers,
  routes,
  selectedEngineerId,
  selectedTaskId,
  onSelectEngineer,
  onSelectTask,
  onFocusTravelSegment
}) => {
  const [search, setSearch] = useState('');
  const [activeModifier, setActiveModifier] = useState<EngineerModifier>('Все');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTransports, setSelectedTransports] = useState<string[]>([]);

  const routeByEngId = new Map(routes.map((r) => [r.engineer_id, r]));

  // Auto-bring assigned engineer to top if a task is selected
  let assignedRoute: EngineerRoute | undefined;
  if (selectedTaskId) {
    assignedRoute = routes.find((r) => r.stops.some((s) => s.task_id === selectedTaskId));
  }

  const allEngineers = [...engineers];
  if (assignedRoute) {
    const idx = allEngineers.findIndex((e) => e.id === assignedRoute!.engineer_id);
    if (idx > 0) {
      const [fav] = allEngineers.splice(idx, 1);
      allEngineers.unshift(fav);
    }
  }

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const toggleTransport = (transport: string) => {
    if (selectedTransports.includes(transport)) {
      setSelectedTransports(selectedTransports.filter((t) => t !== transport));
    } else {
      setSelectedTransports([...selectedTransports, transport]);
    }
  };

  const getTransportIcon = (type?: string) => {
    switch (type) {
      case 'Автомобиль': return <Car className="w-3 h-3 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3 h-3 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3 h-3 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3 h-3 text-amber-400" />;
      default: return <Car className="w-3 h-3 text-slate-400" />;
    }
  };

  // Modifier counters
  const counts = {
    'Все': allEngineers.length,
    'На линии': allEngineers.filter((e) => (routeByEngId.get(e.id)?.stops.length || 0) > 0 && e.status !== 'unavailable' && e.status !== 'pending_unavailable').length,
    'Резерв': allEngineers.filter((e) => (routeByEngId.get(e.id)?.stops.length || 0) === 0 && e.status !== 'unavailable' && e.status !== 'new' && e.status !== 'pending_unavailable').length,
    'Сход': allEngineers.filter((e) => e.status === 'unavailable').length,
    'Изменения': allEngineers.filter((e) => e.status === 'new' || e.status === 'pending_unavailable').length
  };

  const allSelectedTags = [...selectedSkills, ...selectedTransports];

  const filteredEngineers = allEngineers.filter((eng) => {
    const route = routeByEngId.get(eng.id);
    const stopsCount = route?.stops.length || 0;
    const modifierState = getEngineerModifierState(eng, stopsCount);
    const tags = getEngineerTags(eng);

    // 1. Match active modifier (single select)
    if (activeModifier !== 'Все' && modifierState !== activeModifier) {
      return false;
    }

    // 2. Match multi-select filter tags (skills and transport)
    if (allSelectedTags.length > 0) {
      if (!matchesSelectedTags(tags, allSelectedTags)) {
        return false;
      }
    }

    // 3. Match text search (by name, ID, transport OR by tag label!)
    return matchesSearchQuery(
      search,
      eng.name,
      `#${eng.id} ${eng.transport_type || ''}`,
      tags
    );
  });

  return (
    <div className="space-y-2 flex flex-col h-full font-sans">
      {/* Search Input: Matches by name, transport or by tag */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по имени, транспорту, ID или тегу работы..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-beeline-yellow transition-colors"
        />
      </div>

      {/* Tier 1: Search Modifiers (Single Select: Все, На линии, Резерв, Сход, Изменения) */}
      <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-0.5 scrollbar-none">
        {ENGINEER_SEARCH_MODIFIERS.map((mod) => {
          const isActive = activeModifier === mod;
          return (
            <button
              key={mod}
              type="button"
              onClick={() => setActiveModifier(mod)}
              className={`px-2 py-0.5 rounded-md font-semibold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                isActive
                  ? mod === 'Сход'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-beeline-yellow text-slate-950 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{mod}</span>
              <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-black/20 text-current' : 'bg-slate-800 text-slate-400'
              }`}>
                {counts[mod]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tier 2: Filter Tags (Skills + Transport Tags) */}
      <div className="flex flex-wrap gap-1 text-[11px]">
        {/* Skills */}
        {CANONICAL_SKILLS.map((skill) => {
          const isSelected = selectedSkills.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              <Shield className="w-2.5 h-2.5 text-blue-400" />
              <span>{skill}</span>
              {isSelected && <span className="text-[9px]">✕</span>}
            </button>
          );
        })}

        {/* Transport Tags (Requirement 6) */}
        {ENGINEER_TAG_TRANSPORTS.map((trans) => {
          const isSelected = selectedTransports.includes(trans);
          return (
            <button
              key={trans}
              type="button"
              onClick={() => toggleTransport(trans)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
                isSelected
                  ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-sm'
                  : 'bg-purple-950/40 text-purple-300 border-purple-900/50 hover:border-purple-700 hover:text-purple-200'
              }`}
            >
              {getTransportIcon(trans)}
              <span>{trans}</span>
              {isSelected && <span className="text-[9px]">✕</span>}
            </button>
          );
        })}

        {assignedRoute && (
          <div className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <span>🎯 Назначен на #{selectedTaskId}: {assignedRoute.engineer_name.replace('Бригада ', '')}</span>
          </div>
        )}
      </div>

      {/* Engineer Cards List */}
      <div className="space-y-2 overflow-y-auto flex-1 pr-1">
        {filteredEngineers.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            Инженеры не найдены по заданным фильтрам
          </div>
        ) : (
          filteredEngineers.map((eng) => {
            const route = routeByEngId.get(eng.id);
            const stopsCount = route?.stops.length || 0;
            const isSelected = selectedEngineerId === eng.id;
            const isUnavailable = eng.status === 'unavailable';
            const isNew = eng.status === 'new';

            return (
              <div
                key={eng.id}
                onClick={() => onSelectEngineer(eng.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/95 border-beeline-yellow shadow-md ring-1 ring-beeline-yellow/40'
                    : isUnavailable
                    ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row: Name, transport, status */}
                <div className="flex items-start justify-between gap-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">{eng.name}</span>
                      {(isNew || eng.status === 'pending_unavailable') && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          {eng.status === 'pending_unavailable' ? 'Изменения (Сход)' : 'Изменения'}
                        </span>
                      )}
                      {isUnavailable && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          Сход
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      {/* Transport Tag Badge */}
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/60 font-medium flex items-center gap-1">
                        {getTransportIcon(eng.transport_type)}
                        <span>{eng.transport_type}</span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        <span>{eng.shift_start}–{eng.shift_end}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isUnavailable
                        ? 'bg-rose-900/40 text-rose-400 border border-rose-800/50'
                        : stopsCount > 0
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      {isUnavailable ? 'Сход с линии' : (stopsCount > 0 ? `${stopsCount} заявок` : 'В резерве')}
                    </span>
                  </div>
                </div>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {eng.skills.map((skill) => (
                    <span
                      key={skill}
                      className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
