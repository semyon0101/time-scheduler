import React from 'react';
import {
  Tag,
  TransportTypeEnum,
  PriorityEnum,
  SkillEnum,
  EngineerStatusEnum,
  TaskStatusEnum,
} from '../../types';
import {
  Car,
  Bus,
  Bike,
  Footprints,
  Wrench,
  Flame,
  Cable,
  Zap,
  Shield,
  CheckCircle2,
  UserX,
  Sparkles,
  XCircle,
} from 'lucide-react';

export interface TagDisplayProps {
  tag: Tag;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const TagDisplay: React.FC<TagDisplayProps> = ({
  tag,
  className = '',
  onClick,
  title,
}) => {
  let label = '';
  let IconComponent = Shield;
  let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';

  switch (tag.kind) {
    case 'transport': {
      switch (tag.value) {
        case TransportTypeEnum.CAR:
          label = 'Автомобиль';
          IconComponent = Car;
          colorClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
          break;
        case TransportTypeEnum.PUBLIC:
          label = 'Общественный';
          IconComponent = Bus;
          colorClass = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
          break;
        case TransportTypeEnum.BICYCLE:
          label = 'Велосипед';
          IconComponent = Bike;
          colorClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
          break;
        case TransportTypeEnum.PEDESTRIAN:
          label = 'Пешеход';
          IconComponent = Footprints;
          colorClass = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
          break;
        default:
          label = String((tag as any).value || '');
          IconComponent = Car;
          colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
          break;
      }
      break;
    }

    case 'skill': {
      switch (tag.value) {
        case SkillEnum.LOCKAL:
          label = 'Локальные';
          IconComponent = Wrench;
          colorClass = 'bg-sky-500/10 text-sky-300 border-sky-500/30';
          break;
        case SkillEnum.EMERGENCY:
          label = 'Аварийные';
          IconComponent = Flame;
          colorClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
          break;
        case SkillEnum.CONNECT:
          label = 'Подключение';
          IconComponent = Cable;
          colorClass = 'bg-violet-500/10 text-violet-300 border-violet-500/30';
          break;
        default:
          label = String((tag as any).value || '');
          IconComponent = Wrench;
          colorClass = 'bg-sky-500/10 text-sky-300 border-sky-500/30';
          break;
      }
      break;
    }

    case 'priority': {
      switch (tag.value) {
        case PriorityEnum.URGENT:
          label = 'Срочная';
          IconComponent = Zap;
          colorClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold';
          break;
        case PriorityEnum.NORMAL:
          label = 'Обычная';
          IconComponent = Shield;
          colorClass = 'bg-slate-800 text-slate-400 border-slate-700';
          break;
        default:
          label = String((tag as any).value || '');
          IconComponent = Shield;
          colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
          break;
      }
      break;
    }

    case 'status': {
      switch (tag.value) {
        case 'active':
        case EngineerStatusEnum.ACTIVE:
        case TaskStatusEnum.ACTIVE:
          label = 'В работе';
          IconComponent = CheckCircle2;
          colorClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
          break;
        case 'idle':
          label = 'Резерв';
          IconComponent = Shield;
          colorClass = 'bg-slate-800 text-slate-400 border-slate-700';
          break;
        case 'unavailable':
        case EngineerStatusEnum.UNAVAILABLE:
          label = 'Снят';
          IconComponent = UserX;
          colorClass = 'bg-rose-500/15 text-rose-300 border-rose-500/40';
          break;
        case 'assigned':
          label = 'Назначена';
          IconComponent = CheckCircle2;
          colorClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
          break;
        case 'unassigned':
          label = 'Не назначена';
          IconComponent = Shield;
          colorClass = 'bg-amber-500/15 text-amber-300 border-amber-500/40';
          break;
        case 'cancelled':
        case TaskStatusEnum.CANCELLED:
          label = 'Отменена';
          IconComponent = XCircle;
          colorClass = 'bg-slate-800/80 text-slate-500 border-slate-700 line-through';
          break;
        case 'modified':
        case EngineerStatusEnum.NEW:
        case TaskStatusEnum.NEW:
          label = 'Изменен(а)';
          IconComponent = Sparkles;
          colorClass = 'bg-sky-500/15 text-sky-300 border-sky-500/40';
          break;
        default:
          label = String((tag as any).value || '');
          IconComponent = Shield;
          colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
          break;
      }
      break;
    }
  }

  const isInteractive = Boolean(onClick);

  return (
    <span
      onClick={onClick}
      title={title || label}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border select-none transition-all ${colorClass} ${
        isInteractive ? 'cursor-pointer hover:brightness-125' : ''
      } ${className}`}
    >
      <IconComponent className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate max-w-[140px]">{label}</span>
    </span>
  );
};
