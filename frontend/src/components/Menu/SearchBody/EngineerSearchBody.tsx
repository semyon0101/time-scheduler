import React, { useState, useMemo } from 'react';
import {
  Engineer,
  Tag,
  TransportTypeEnum,
  SkillEnum,
  EngineerStatusEnum,
} from '../../../types';
import { dataStore } from '../../../utils/DataStore';
import { SearchInputField, TagGroup } from './SearchInputField';
import { ActionButton } from './ActionButton';
import { EngineerSmallDrawer } from '../EngineerSmallDrawer';

export interface EngineerSearchBodyProps {
  engineerIds: string[];
  selectedEngineerId?: string | null;
  onSelectEngineer: (engineerId: string) => void;
  onSwitchToCreate: () => void;
}

const ENGINEER_TAG_GROUPS: TagGroup[] = [
  {
    title: 'Статус',
    tags: [
      { kind: 'status', value: 'active' },
      { kind: 'status', value: 'idle' },
      { kind: 'status', value: 'unavailable' },
      { kind: 'status', value: 'modified' },
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
  {
    title: 'Квалификация',
    tags: [
      { kind: 'skill', value: SkillEnum.LOCKAL },
      { kind: 'skill', value: SkillEnum.EMERGENCY },
      { kind: 'skill', value: SkillEnum.CONNECT },
    ],
  },
];

const getEngineerTags = (eng: Engineer): Tag[] => {
  const tags: Tag[] = [];
  if (eng.status === EngineerStatusEnum.UNAVAILABLE) {
    tags.push({ kind: 'status', value: 'unavailable' });
  } else if (eng.tasks.length > 0) {
    tags.push({ kind: 'status', value: 'active' });
  } else {
    tags.push({ kind: 'status', value: 'idle' });
  }
  if (eng.status === EngineerStatusEnum.NEW) {
    tags.push({ kind: 'status', value: 'modified' });
  }
  if (eng.transport_type) {
    tags.push({ kind: 'transport', value: eng.transport_type });
  }
  if (eng.skills) {
    eng.skills.forEach((s) => tags.push({ kind: 'skill', value: s }));
  }
  return tags;
};

export const EngineerSearchBody: React.FC<EngineerSearchBodyProps> = ({
  engineerIds,
  selectedEngineerId,
  onSelectEngineer,
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

  const filteredEngineerIds = useMemo(() => {
    return engineerIds.filter((id) => {
      const eng = dataStore.find_by_id_engineer(id);
      if (!eng) return false;

      // Text search
      const searchLower = search.toLowerCase().trim();
      if (searchLower) {
        const matchesSearch =
          (eng.name || '').toLowerCase().includes(searchLower) ||
          (eng.id || '').toLowerCase().includes(searchLower) ||
          (eng.transport_type || '').toLowerCase().includes(searchLower) ||
          (eng.skills && eng.skills.some((s) => (s || '').toLowerCase().includes(searchLower)));

        if (!matchesSearch) return false;
      }

      // Tag filtering: Group selected tags by kind (OR within kind, AND across kinds)
      if (selectedTags.length > 0) {
        const engTags = getEngineerTags(eng);
        const selectedByKind: Record<string, Tag[]> = {};
        selectedTags.forEach((t) => {
          if (!selectedByKind[t.kind]) selectedByKind[t.kind] = [];
          selectedByKind[t.kind].push(t);
        });

        for (const kind of Object.keys(selectedByKind)) {
          const requiredTagsForKind = selectedByKind[kind];
          const hasMatch = requiredTagsForKind.some((st) =>
            engTags.some((et) => et.kind === st.kind && et.value === st.value)
          );
          if (!hasMatch) return false;
        }
      }

      return true;
    });
  }, [engineerIds, search, selectedTags]);

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-300">
          Инженеры ({engineerIds.length})
        </span>
        <ActionButton text="Добавить инженера" onClick={onSwitchToCreate} />
      </div>

      <SearchInputField
        search={search}
        onSearchChange={setSearch}
        placeholder="Поиск по имени, транспорту, квалификации..."
        foundCount={filteredEngineerIds.length}
        tagGroups={ENGINEER_TAG_GROUPS}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
      />

      {/* Engineers list via EngineerSmallDrawer */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {filteredEngineerIds.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Инженеры по заданному фильтру не найдены
          </div>
        ) : (
          filteredEngineerIds.map((id) => (
            <EngineerSmallDrawer
              key={id}
              id={id}
              onClick={onSelectEngineer}
              isSelected={selectedEngineerId === id}
            />
          ))
        )}
      </div>
    </div>
  );
};
