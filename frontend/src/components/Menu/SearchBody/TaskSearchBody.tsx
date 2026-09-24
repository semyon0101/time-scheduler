import React, { useState, useMemo } from 'react';
import {
  Task,
  Tag,
  PriorityEnum,
  SkillEnum,
  TransportTypeEnum,
  TaskStatusEnum,
} from '../../../types';
import { dataStore } from '../../../utils/DataStore';
import { SearchInputField, TagGroup } from './SearchInputField';
import { ActionButton } from './ActionButton';
import { TaskSmallDrawer } from '../TaskSmallDrawer';

export interface TaskSearchBodyProps {
  taskIds: string[];
  selectedTaskId?: string | null;
  onSelectTask: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onSwitchToCreate: () => void;
}

const TASK_TAG_GROUPS: TagGroup[] = [
  {
    title: 'Статус',
    tags: [
      { kind: 'status', value: 'assigned' },
      { kind: 'status', value: 'unassigned' },
      { kind: 'status', value: 'cancelled' },
      { kind: 'status', value: 'modified' },
    ],
  },
  {
    title: 'Срочность',
    tags: [
      { kind: 'priority', value: PriorityEnum.URGENT },
      { kind: 'priority', value: PriorityEnum.NORMAL },
    ],
  },
  {
    title: 'Квалификация',
    tags: [
      { kind: 'skill', value: SkillEnum.LOCKAL },
      { kind: 'skill', value: SkillEnum.EMERGENCY },
      { kind: 'skill', value: SkillEnum.CONNECT },
    ],
  },
  {
    title: 'Транспорт',
    tags: [
      { kind: 'transport', value: TransportTypeEnum.CAR },
      { kind: 'transport', value: TransportTypeEnum.BICYCLE },
      { kind: 'transport', value: TransportTypeEnum.PEDESTRIAN },
      { kind: 'transport', value: TransportTypeEnum.PUBLIC },
    ],
  },
];

const getTaskTags = (task: Task): Tag[] => {
  const tags: Tag[] = [];
  if (task.status === TaskStatusEnum.CANCELLED) {
    tags.push({ kind: 'status', value: 'cancelled' });
  } else if (task.engineer_id) {
    tags.push({ kind: 'status', value: 'assigned' });
  } else {
    tags.push({ kind: 'status', value: 'unassigned' });
  }
  if (task.status === TaskStatusEnum.NEW) {
    tags.push({ kind: 'status', value: 'modified' });
  }
  if (task.priority) {
    tags.push({ kind: 'priority', value: task.priority });
  }
  if (task.required_skill) {
    tags.push({ kind: 'skill', value: task.required_skill });
  }
  if (task.required_transport) {
    tags.push({ kind: 'transport', value: task.required_transport });
  }
  return tags;
};

export const TaskSearchBody: React.FC<TaskSearchBodyProps> = ({
  taskIds,
  selectedTaskId,
  onSelectTask,
  onSwitchToCreate,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const handleToggleTag = (tag: Tag) => {
    setSelectedTags((prev) => {
      const exists = prev.some((t) => t.kind === tag.kind && t.value === tag.value);
      if (exists) {
        return prev.filter((t) => !(t.kind === tag.kind && t.value === tag.value));
      } else {
        return [...prev, tag];
      }
    });
  };

  const filteredTaskIds = useMemo(() => {
    return taskIds.filter((id) => {
      const t = dataStore.find_by_id_task(id);
      if (!t) return false;

      const isUrgent = t.priority === PriorityEnum.URGENT;

      // Text search
      const searchLower = search.toLowerCase().trim();
      if (searchLower) {
        const isUrgentQuery =
          searchLower === 'срочная' || searchLower === 'срочно' || searchLower === 'urgent';

        const matchesSearch =
          (isUrgentQuery && isUrgent) ||
          (t.id || '').toLowerCase().includes(searchLower) ||
          (t.position?.address || '').toLowerCase().includes(searchLower) ||
          (t.district || '').toLowerCase().includes(searchLower) ||
          (t.required_skill || '').toLowerCase().includes(searchLower) ||
          (t.priority || '').toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Tag filtering: Group selected tags by kind (OR within kind, AND across kinds)
      if (selectedTags.length > 0) {
        const taskTags = getTaskTags(t);
        const selectedByKind: Record<string, Tag[]> = {};
        selectedTags.forEach((tag) => {
          if (!selectedByKind[tag.kind]) selectedByKind[tag.kind] = [];
          selectedByKind[tag.kind].push(tag);
        });

        for (const kind of Object.keys(selectedByKind)) {
          const requiredTagsForKind = selectedByKind[kind];
          const hasMatch = requiredTagsForKind.some((st) =>
            taskTags.some((tt) => tt.kind === st.kind && tt.value === st.value)
          );
          if (!hasMatch) return false;
        }
      }

      return true;
    });
  }, [taskIds, search, selectedTags]);

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-300">Заявки ({taskIds.length})</span>
        <ActionButton text="Новая заявка" onClick={onSwitchToCreate} />
      </div>

      <SearchInputField
        search={search}
        onSearchChange={setSearch}
        placeholder="Поиск по адресу, #ID, квалификации..."
        foundCount={filteredTaskIds.length}
        tagGroups={TASK_TAG_GROUPS}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
      />

      {/* Tasks list via TaskSmallDrawer */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredTaskIds.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Заявки по заданному фильтру не найдены
          </div>
        ) : (
          filteredTaskIds.map((id) => (
            <TaskSmallDrawer
              key={id}
              id={id}
              onClick={onSelectTask}
              isSelected={selectedTaskId === id}
            />
          ))
        )}
      </div>
    </div>
  );
};
