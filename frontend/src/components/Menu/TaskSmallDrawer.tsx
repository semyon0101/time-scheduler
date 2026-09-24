import React from 'react';
import { TaskStatusEnum, Tag } from '../../types';
import { dataStore } from '../../utils/DataStore';
import { TagDisplay } from './TagDisplay';
import { Clock, MapPin, UserCheck, UserX } from 'lucide-react';

export interface TaskSmallDrawerProps {
  id: string;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  className?: string;
}

export const TaskSmallDrawer: React.FC<TaskSmallDrawerProps> = ({
  id,
  onClick,
  isSelected = false,
  className = '',
}) => {
  const task = dataStore.find_by_id_task(id);
  if (!task) return null;

  const assignedEng = task.engineer_id ? dataStore.find_by_id_engineer(task.engineer_id) : null;
  const isCancelled = task.status === TaskStatusEnum.CANCELLED;
  const isModified = task.status === TaskStatusEnum.NEW;

  // Build tags strictly from typed domain fields (no entity.tags used)
  const entityTags: Tag[] = [];

  // 1. Mutually exclusive status
  if (isCancelled) {
    entityTags.push({ kind: 'status', value: 'cancelled' });
  } else if (task.engineer_id) {
    entityTags.push({ kind: 'status', value: 'assigned' });
  } else {
    entityTags.push({ kind: 'status', value: 'unassigned' });
  }

  // Orthogonal modification tag
  if (isModified) {
    entityTags.push({ kind: 'status', value: 'modified' });
  }

  // 2. Priority tag (replaces duplicate manual badge)
  if (task.priority) {
    entityTags.push({ kind: 'priority', value: task.priority });
  }

  // 3. Skill
  if (task.required_skill) {
    entityTags.push({ kind: 'skill', value: task.required_skill });
  }

  // 4. Required transport
  if (task.required_transport) {
    entityTags.push({ kind: 'transport', value: task.required_transport });
  }

  return (
    <div
      onClick={() => onClick && onClick(task.id)}
      className={`p-2.5 rounded-xl border text-xs transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'bg-cyan-500/15 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
          : isCancelled
          ? 'bg-slate-950/40 border-slate-800/40 opacity-60'
          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
      } ${className}`}
    >
      {/* Header: ID & Assigned Engineer */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={`font-bold font-mono ${
            isCancelled ? 'line-through text-slate-500' : 'text-white'
          }`}
        >
          #{task.id}
        </span>

        <div className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
          {assignedEng ? (
            <span className="flex items-center gap-1 text-emerald-300 font-medium">
              <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
              <span className="truncate max-w-[100px]">{assignedEng.name.replace('Бригада ', '')}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400/80 font-medium">
              <UserX className="w-2.5 h-2.5 text-amber-400" />
              <span>Не назначен</span>
            </span>
          )}
        </div>
      </div>

      {/* Address */}
      <div
        className={`text-[11px] mb-1.5 flex items-start gap-1 ${
          isCancelled ? 'line-through text-slate-500' : 'text-slate-300'
        }`}
      >
        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
        <span className="truncate">{task.position?.address || 'Адрес не указан'}</span>
      </div>

      {/* Info row: Window, Duration */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mb-2">
        <span className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          <Clock className="w-2.5 h-2.5 text-yellow-400" />
          <span>
            {task.window_start?.time} – {task.window_end?.time}
          </span>
        </span>

        <span className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          <span>{task.duration_time?.absolute_time} мин</span>
        </span>
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
