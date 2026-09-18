import { Task, Engineer } from '../types';

export type TagCategory = 'skill' | 'priority' | 'problem' | 'status' | 'transport';

export interface EntityTag {
  id: string;
  label: string;
  category: TagCategory;
  colorClass: string;
  iconName?: string;
}

// 3 Canonical skills across system
export const CANONICAL_SKILLS = [
  'Локальные работы',
  'Работы на подключение и дозаказы',
  'Аварийные работы'
] as const;

// 4 Transport types for engineers
export const ENGINEER_TAG_TRANSPORTS = [
  'Автомобиль',
  'Общественный транспорт',
  'Велосипед',
  'Пешеход'
] as const;

// Engineer Search Modifiers (strictly without brackets/parentheses for "Сход")
export const ENGINEER_SEARCH_MODIFIERS = [
  'Все',
  'На линии',
  'Резерв',
  'Сход',
  'Изменения'
] as const;

export type EngineerModifier = typeof ENGINEER_SEARCH_MODIFIERS[number];

// Task Search Modifiers
export const TASK_SEARCH_MODIFIERS = [
  'Все',
  'В графике',
  'Не распределенные',
  'Изменения'
] as const;

export type TaskModifier = typeof TASK_SEARCH_MODIFIERS[number];

// Task Filter Tags: 3 Work types + 2 Priority levels + Problematic + 4 Transports
export const TASK_TAG_SKILLS = CANONICAL_SKILLS;
export const TASK_TAG_PRIORITIES = ['Срочная', 'Обычная'] as const;
export const TASK_TAG_TRANSPORTS = ENGINEER_TAG_TRANSPORTS;

/**
 * Returns modifier state for an engineer.
 */
export function getEngineerModifierState(engineer: Engineer, stopsCount: number = 0): EngineerModifier {
  if (engineer.status === 'unavailable') {
    return 'Сход';
  }
  if (engineer.status === 'new' || engineer.status === 'pending_unavailable') {
    return 'Изменения';
  }
  if (stopsCount > 0) {
    return 'На линии';
  }
  return 'Резерв';
}

/**
 * Returns modifier state for a task.
 * Both newly added tasks and cancelled tasks fall under 'Изменения' until regeneration.
 */
export function getTaskModifierState(
  task: Task, 
  isAssigned: boolean = false, 
  isUnassignedProblem: boolean = false
): TaskModifier {
  if (task.status === 'cancelled' || task.status === 'new') {
    return 'Изменения';
  }
  if (isAssigned) {
    return 'В графике';
  }
  return 'Не распределенные';
}

/**
 * Returns unified tags for a task:
 * - 3 work types (skill)
 * - 2 priority levels (Срочная / Обычная)
 * - Problematic tag (if unassigned/problematic)
 * - Transport requirements (Автомобиль, Пешеход, etc. or 'Любой транспорт')
 */
export function getTaskTags(
  task: Task, 
  isAssigned: boolean = false, 
  isUnassignedProblem: boolean = false
): EntityTag[] {
  const tags: EntityTag[] = [];

  // 1. Work type skill tag
  if (task.required_skill) {
    tags.push({
      id: `skill:${task.required_skill}`,
      label: task.required_skill,
      category: 'skill',
      colorClass: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
      iconName: 'Wrench'
    });
  }

  // 2. Priority tag (Срочная vs Обычная)
  if (task.priority === 'Срочная') {
    tags.push({
      id: 'priority:urgent',
      label: 'Срочная',
      category: 'priority',
      colorClass: 'bg-amber-950/70 text-amber-300 border-amber-800/60 font-bold',
      iconName: 'Zap'
    });
  } else {
    tags.push({
      id: 'priority:normal',
      label: 'Обычная',
      category: 'priority',
      colorClass: 'bg-slate-900 text-slate-400 border-slate-800'
    });
  }

  // 3. Problematic tag (if unassigned / conflict)
  if (isUnassignedProblem || (!isAssigned && task.status !== 'cancelled' && task.status !== 'new')) {
    tags.push({
      id: 'problem:unassigned',
      label: 'Проблемная',
      category: 'problem',
      colorClass: 'bg-rose-950/70 text-rose-300 border-rose-800/70 font-semibold',
      iconName: 'AlertTriangle'
    });
  }

  // 4. Transport requirement tag
  if (task.required_transport && task.required_transport !== 'Любой') {
    const tIcon = task.required_transport === 'Автомобиль'
      ? 'Car'
      : task.required_transport === 'Велосипед'
      ? 'Bike'
      : task.required_transport === 'Общественный транспорт'
      ? 'Bus'
      : 'Footprints';

    tags.push({
      id: `transport:${task.required_transport}`,
      label: task.required_transport,
      category: 'transport',
      colorClass: 'bg-purple-950/60 text-purple-300 border-purple-800/60 font-medium',
      iconName: tIcon
    });
  } else {
    tags.push({
      id: 'transport:any',
      label: 'Любой транспорт',
      category: 'transport',
      colorClass: 'bg-slate-900 text-slate-400 border-slate-800',
      iconName: 'Navigation'
    });
  }

  return tags;
}

/**
 * Returns unified tags for an engineer:
 * - 3 types of work skills
 * - Transport type tag (Автомобиль, Общественный транспорт, Велосипед, Пешеход)
 */
export function getEngineerTags(engineer: Engineer): EntityTag[] {
  const tags: EntityTag[] = [];

  // 1. Work skills tags
  if (Array.isArray(engineer.skills)) {
    engineer.skills.forEach((s) => {
      tags.push({
        id: `skill:${s}`,
        label: s,
        category: 'skill',
        colorClass: 'bg-blue-950/50 text-blue-300 border-blue-800/50',
        iconName: 'Wrench'
      });
    });
  }

  // 2. Transport type tag (Requirement 6)
  if (engineer.transport_type) {
    const tIcon = engineer.transport_type === 'Автомобиль'
      ? 'Car'
      : engineer.transport_type === 'Велосипед'
      ? 'Bike'
      : engineer.transport_type === 'Общественный транспорт'
      ? 'Bus'
      : 'Footprints';

    tags.push({
      id: `transport:${engineer.transport_type}`,
      label: engineer.transport_type,
      category: 'transport',
      colorClass: 'bg-purple-950/60 text-purple-300 border-purple-800/60 font-medium',
      iconName: tIcon
    });
  }

  return tags;
}

/**
 * Checks if search query matches by name/title/address OR by any tag label (skills, transport, priority).
 */
export function matchesSearchQuery(
  searchQuery: string,
  title: string,
  subtitle: string,
  tags: EntityTag[]
): boolean {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return true;

  // Search by title or subtitle (e.g. name, address, ID)
  if (title.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q)) {
    return true;
  }

  // Search by any tag label (including transport, skills, priority)
  return tags.some((t) => t.label.toLowerCase().includes(q));
}

/**
 * Matches multi-select filter tags.
 */
export function matchesSelectedTags(tags: EntityTag[], selectedTagLabels: string[]): boolean {
  if (!selectedTagLabels || selectedTagLabels.length === 0) return true;

  const itemLabels = new Set(tags.map((t) => t.label.toLowerCase()));
  return selectedTagLabels.every((req) => itemLabels.has(req.toLowerCase()));
}
