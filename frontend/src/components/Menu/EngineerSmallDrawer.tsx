import React from 'react';
import { EngineerStatusEnum, Tag } from '../../types';
import { dataStore } from '../../utils/DataStore';
import { TagDisplay } from './TagDisplay';
import { Clock } from 'lucide-react';

export interface EngineerSmallDrawerProps {
  id: string;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  className?: string;
}

export const EngineerSmallDrawer: React.FC<EngineerSmallDrawerProps> = ({
  id,
  onClick,
  isSelected = false,
  className = '',
}) => {
  const eng = dataStore.find_by_id_engineer(id);
  if (!eng) return null;

  const stopsCount = eng.tasks?.length || 0;
  const isUnavailable = eng.status === EngineerStatusEnum.UNAVAILABLE;
  const isModified = eng.status === EngineerStatusEnum.NEW;

  // Build tags strictly from typed domain fields (no entity.tags used)
  const entityTags: Tag[] = [];

  // 1. Mutually exclusive status
  if (isUnavailable) {
    entityTags.push({ kind: 'status', value: 'unavailable' });
  } else if (stopsCount > 0) {
    entityTags.push({ kind: 'status', value: 'active' });
  } else {
    entityTags.push({ kind: 'status', value: 'idle' });
  }

  // Orthogonal modification tag
  if (isModified) {
    entityTags.push({ kind: 'status', value: 'modified' });
  }

  // 2. Transport type
  if (eng.transport_type) {
    entityTags.push({ kind: 'transport', value: eng.transport_type });
  }

  // 3. Skills
  if (eng.skills) {
    eng.skills.forEach((s) => {
      entityTags.push({ kind: 'skill', value: s });
    });
  }

  return (
    <div
      onClick={() => onClick && onClick(eng.id)}
      className={`p-2.5 rounded-xl border transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-cyan-500/15 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
          : isUnavailable
          ? 'bg-rose-950/20 border-rose-900/30 opacity-70'
          : stopsCount === 0
          ? 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60'
          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
      } ${className}`}
    >
      {/* Header: Name and count */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-bold text-xs text-white truncate">{eng.name}</span>
        <span className="text-[10px] text-slate-400 font-mono shrink-0">
          {stopsCount} {stopsCount === 1 ? 'выезд' : 'выездов'}
        </span>
      </div>

      {/* Shift Time */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2">
        <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
        <span>Смена: {eng.shift_start?.time || '09:00'} – {eng.shift_end?.time || '21:00'}</span>
      </div>

      {/* Tags Section strictly rendered via TagDisplay */}
      <div className="flex flex-wrap gap-1">
        {entityTags.map((tag, tIdx) => (
          <TagDisplay key={tIdx} tag={tag} />
        ))}
      </div>
    </div>
  );
};
