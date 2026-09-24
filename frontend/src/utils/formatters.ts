import React from 'react';
import {
  PriorityEnum,
  EngineerStatusEnum,
  SkillEnum,
  TransportTypeEnum,
  Time
} from '../types';
import { Car, Bus, Bike, Footprints } from 'lucide-react';

/**
 * Получение визуальных стилей и названий для приоритетов
 */
export function getPriorityBadgeProps(priority: PriorityEnum | string) {
  const isUrgent = priority === PriorityEnum.URGENT || priority === 'Срочная';
  if (isUrgent) {
    return {
      label: 'Срочная',
      isUrgent: true,
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold',
      solidClass: 'bg-rose-600 text-white font-black',
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500 ring-1 ring-rose-500/50'
    };
  }
  return {
    label: 'Обычная',
    isUrgent: false,
    badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700/60 font-medium',
    solidClass: 'bg-slate-800 text-slate-300',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-800'
  };
}

/**
 * Получение визуальных стилей и меток для статусов инженеров
 */
export function getEngineerStatusProps(status?: EngineerStatusEnum | string) {
  switch (status) {
    case EngineerStatusEnum.UNAVAILABLE:
    case 'unavailable':
      return {
        label: 'Недоступен',
        badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
        dotClass: 'bg-rose-400',
        isUnavailable: true
      };
    case EngineerStatusEnum.NEW:
    case 'new':
      return {
        label: 'Новый',
        badgeClass: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
        dotClass: 'bg-sky-400',
        isUnavailable: false
      };
    case EngineerStatusEnum.ACTIVE:
    case 'active':
    default:
      return {
        label: 'Активен',
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        dotClass: 'bg-emerald-400',
        isUnavailable: false
      };
  }
}

/**
 * Получение визуальных стилей для навыков
 */
export function getSkillBadgeProps(skill: SkillEnum | string) {
  switch (skill) {
    case SkillEnum.EMERGENCY:
    case 'Аварийные работы':
      return {
        label: 'Аварийные работы',
        badgeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        color: '#f43f5e'
      };
    case SkillEnum.CONNECT:
    case 'Работы на подключение и дозаказы':
      return {
        label: 'Подключение и дозаказы',
        badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        color: '#f59e0b'
      };
    case SkillEnum.LOCKAL:
    case 'Локальные работы':
    default:
      return {
        label: 'Локальные работы',
        badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
        color: '#0ea5e9'
      };
  }
}

/**
 * Получение иконки и цвета транспорта
 */
export function getTransportProps(transport: TransportTypeEnum | string) {
  switch (transport) {
    case TransportTypeEnum.PUBLIC:
    case 'Общественный транспорт':
      return {
        label: 'Общественный транспорт',
        colorClass: 'text-purple-400',
        badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
        icon: Bus
      };
    case TransportTypeEnum.BICYCLE:
    case 'Велосипед':
      return {
        label: 'Велосипед',
        colorClass: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        icon: Bike
      };
    case TransportTypeEnum.PEDESTRIAN:
    case 'Пешеход':
      return {
        label: 'Пешеход',
        colorClass: 'text-amber-400',
        badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        icon: Footprints
      };
    case TransportTypeEnum.CAR:
    case 'Автомобиль':
    default:
      return {
        label: 'Автомобиль',
        colorClass: 'text-blue-400',
        badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
        icon: Car
      };
  }
}

/**
 * Вычисление минут и процентов интервала суток (0..1440 минут)
 * напрямую через Time или строковое представление без ручного split(':').
 */
export function getTimeAbsoluteMinutes(t?: Time | string | null): number {
  if (!t) return 0;
  if (typeof t === 'object' && typeof t.absolute_time === 'number') {
    return Math.max(0, Math.min(1440, t.absolute_time));
  }
  const str = String(t).trim();
  const parts = str.split(':');
  const h = parts.length > 0 ? parseInt(parts[0], 10) : 0;
  const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  return Math.max(0, Math.min(1440, (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)));
}

export function getTimePercentageOfDay(t?: Time | string | null): number {
  const min = getTimeAbsoluteMinutes(t);
  return (min / 1440) * 100;
}

export function getTimeDurationMinutes(start?: Time | string | null, end?: Time | string | null): number {
  const startMin = getTimeAbsoluteMinutes(start);
  const endMin = getTimeAbsoluteMinutes(end);
  return Math.max(0, endMin - startMin);
}
