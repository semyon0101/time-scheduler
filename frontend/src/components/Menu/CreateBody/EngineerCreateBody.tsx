import React, { useState } from 'react';
import {
  Engineer,
  TransportTypeEnum,
  SkillEnum,
  Time,
  Position
} from '../../../types';
import { parseTime, createPosition } from '../../../utils/adapters';
import { PanelTitle } from './PanelTitle';
import { FormField } from './FormField';
import { TextInput } from './TextInput';
import { SelectField } from './SelectField';
import { TimeInput } from './TimeInput';
import { TagMultiSelect } from './TagMultiSelect';
import { Timeline } from '../../Timeline';
import { FormActions } from './FormActions';

export interface EngineerCreateBodyProps {
  onSubmit: (data: Partial<Engineer>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const TRANSPORT_OPTIONS = [
  { label: TransportTypeEnum.CAR, value: TransportTypeEnum.CAR },
  { label: TransportTypeEnum.PUBLIC, value: TransportTypeEnum.PUBLIC },
  { label: TransportTypeEnum.BICYCLE, value: TransportTypeEnum.BICYCLE },
  { label: TransportTypeEnum.PEDESTRIAN, value: TransportTypeEnum.PEDESTRIAN },
];

const SKILL_OPTIONS = [
  { label: SkillEnum.LOCKAL, value: SkillEnum.LOCKAL },
  { label: SkillEnum.EMERGENCY, value: SkillEnum.EMERGENCY },
  { label: SkillEnum.CONNECT, value: SkillEnum.CONNECT },
];

export const EngineerCreateBody: React.FC<EngineerCreateBodyProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState('Бригада №' + Math.floor(10 + Math.random() * 90));
  const [address, setAddress] = useState('г. Москва, ул. Новый Арбат, 15');
  const [lat, setLat] = useState('55.7522');
  const [lon, setLon] = useState('37.5925');
  const [transportType, setTransportType] = useState<TransportTypeEnum>(TransportTypeEnum.CAR);
  const [shiftStart, setShiftStart] = useState<Time>(parseTime('09:00'));
  const [shiftEnd, setShiftEnd] = useState<Time>(parseTime('21:00'));
  const [skills, setSkills] = useState<string[]>([SkillEnum.LOCKAL, SkillEnum.EMERGENCY]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название бригады / имя инженера');
      return;
    }
    if (skills.length === 0) {
      setError('Выберите хотя бы одну квалификацию');
      return;
    }

    const parsedLat = parseFloat(lat) || 55.75;
    const parsedLon = parseFloat(lon) || 37.61;
    const position: Position = createPosition(address, parsedLat, parsedLon);

    const newEngineerData: Partial<Engineer> = {
      name: name.trim(),
      position,
      transport_type: transportType,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      skills: skills as SkillEnum[],
    };

    onSubmit(newEngineerData);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900 text-slate-100 p-2">
      <PanelTitle
        title="Новый инженер / бригада"
        badge="Создание"
        onBack={onCancel}
        onClose={onCancel}
      />

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
        <FormField label="Имя инженера / номер бригады" required error={error || undefined}>
          <TextInput
            value={name}
            onChange={(val) => {
              setName(val);
              setError(null);
            }}
            placeholder="Например, Бригада 14"
            required
          />
        </FormField>

        <FormField label="Адрес базирования (депо / дом)">
          <TextInput
            value={address}
            onChange={setAddress}
            placeholder="г. Москва, ул. Вавилова, 24"
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

        <FormField label="Тип передвижения">
          <SelectField
            value={transportType}
            onChange={(val) => setTransportType(val as TransportTypeEnum)}
            options={TRANSPORT_OPTIONS}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-2">
          <FormField label="Начало смены">
            <TimeInput value={shiftStart} onChange={setShiftStart} />
          </FormField>
          <FormField label="Конец смены">
            <TimeInput value={shiftEnd} onChange={setShiftEnd} />
          </FormField>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Предпросмотр рабочей смены</span>
            <span className="text-[10px] text-slate-400 font-mono">{shiftStart.time} – {shiftEnd.time}</span>
          </div>
          <Timeline
            shift_start={shiftStart}
            shift_end={shiftEnd}
            showHourMarks={true}
            orientation="horizontal"
          />
        </div>

        <FormField label="Квалификации и допуски" required>
          <TagMultiSelect
            options={SKILL_OPTIONS}
            selectedValues={skills}
            onChange={setSkills}
          />
        </FormField>

        <FormActions
          submitLabel="Добавить инженера"
          cancelLabel="Отмена"
          onCancel={onCancel}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
};
