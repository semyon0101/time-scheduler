import React, { useState } from 'react';
import {
  Task,
  PriorityEnum,
  SkillEnum,
  Time,
  Position,
  TaskStatusEnum,
  TransportTypeEnum
} from '../../../types';
import { parseTime, durationMinutesToTime, createPosition } from '../../../utils/adapters';
import { PanelTitle } from './PanelTitle';
import { FormField } from './FormField';
import { TextInput } from './TextInput';
import { NumberInput } from './NumberInput';
import { TimeInput } from './TimeInput';
import { SelectField } from './SelectField';
import { Timeline } from '../../Timeline';
import { FormActions } from './FormActions';

export interface TaskCreateBodyProps {
  onSubmit: (data: Partial<Task>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PRIORITY_OPTIONS = [
  { label: PriorityEnum.NORMAL, value: PriorityEnum.NORMAL },
  { label: PriorityEnum.URGENT, value: PriorityEnum.URGENT },
];

const SKILL_OPTIONS = [
  { label: SkillEnum.LOCKAL, value: SkillEnum.LOCKAL },
  { label: SkillEnum.EMERGENCY, value: SkillEnum.EMERGENCY },
  { label: SkillEnum.CONNECT, value: SkillEnum.CONNECT },
];

const TRANSPORT_OPTIONS = [
  { label: 'Любой транспорт', value: '' },
  { label: TransportTypeEnum.CAR, value: TransportTypeEnum.CAR },
  { label: TransportTypeEnum.PUBLIC, value: TransportTypeEnum.PUBLIC },
  { label: TransportTypeEnum.BICYCLE, value: TransportTypeEnum.BICYCLE },
  { label: TransportTypeEnum.PEDESTRIAN, value: TransportTypeEnum.PEDESTRIAN },
];

export const TaskCreateBody: React.FC<TaskCreateBodyProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [address, setAddress] = useState('г. Москва, Ленинградский пр-т, 39');
  const [district, setDistrict] = useState('Северный');
  const [lat, setLat] = useState('55.7960');
  const [lon, setLon] = useState('37.5375');
  const [windowStart, setWindowStart] = useState<Time>(parseTime('10:00'));
  const [windowEnd, setWindowEnd] = useState<Time>(parseTime('14:00'));
  const [durationMin, setDurationMin] = useState<number>(45);
  const [priority, setPriority] = useState<PriorityEnum>(PriorityEnum.NORMAL);
  const [requiredSkill, setRequiredSkill] = useState<SkillEnum>(SkillEnum.LOCKAL);
  const [requiredTransport, setRequiredTransport] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Укажите адрес выполнения заявки');
      return;
    }

    const parsedLat = parseFloat(lat) || 55.75;
    const parsedLon = parseFloat(lon) || 37.61;
    const position: Position = createPosition(address.trim(), parsedLat, parsedLon);

    const newTaskData: Partial<Task> = {
      position,
      district: district.trim() || undefined,
      window_start: windowStart,
      window_end: windowEnd,
      duration_time: durationMinutesToTime(durationMin),
      priority,
      required_skill: requiredSkill,
      required_transport: requiredTransport ? (requiredTransport as TransportTypeEnum) : null,
      status: TaskStatusEnum.NEW,
    };

    onSubmit(newTaskData);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900 text-slate-100 p-2">
      <PanelTitle
        title="Новая заявка"
        badge="Создание"
        onBack={onCancel}
        onClose={onCancel}
      />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        <FormField label="Адрес выполнения работ" required error={error || undefined}>
          <TextInput
            value={address}
            onChange={(val) => {
              setAddress(val);
              setError(null);
            }}
            placeholder="г. Москва, ул. Арбат, 10"
            required
          />
        </FormField>

        <FormField label="Район города">
          <TextInput
            value={district}
            onChange={setDistrict}
            placeholder="Например, Центральный"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-2">
          <FormField label="Широта (Lat)">
            <TextInput value={lat} onChange={setLat} placeholder="55.75" />
          </FormField>
          <FormField label="Долгота (Lon)">
            <TextInput value={lon} onChange={setLon} placeholder="37.61" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormField label="Окно от">
            <TimeInput value={windowStart} onChange={setWindowStart} />
          </FormField>
          <FormField label="Окно до">
            <TimeInput value={windowEnd} onChange={setWindowEnd} />
          </FormField>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Предпросмотр временного окна</span>
            <span className="text-[10px] text-slate-400 font-mono">{windowStart.time} – {windowEnd.time}</span>
          </div>
          <Timeline
            shift_start={windowStart}
            shift_end={windowEnd}
            showHourMarks={true}
            orientation="horizontal"
          />
        </div>

        <FormField label="Плановая длительность (мин)">
          <NumberInput
            value={durationMin}
            onChange={setDurationMin}
            min={10}
            max={480}
            step={5}
            suffix="мин"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-2">
          <FormField label="Приоритет заявки">
            <SelectField
              value={priority}
              onChange={(val) => setPriority(val as PriorityEnum)}
              options={PRIORITY_OPTIONS}
            />
          </FormField>

          <FormField label="Требуемый навык">
            <SelectField
              value={requiredSkill}
              onChange={(val) => setRequiredSkill(val as SkillEnum)}
              options={SKILL_OPTIONS}
            />
          </FormField>
        </div>

        <FormField label="Требуемый транспорт (опционально)">
          <SelectField
            value={requiredTransport}
            onChange={setRequiredTransport}
            options={TRANSPORT_OPTIONS}
          />
        </FormField>

        <FormActions
          submitLabel="Создать заявку"
          cancelLabel="Отмена"
          onCancel={onCancel}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
};
