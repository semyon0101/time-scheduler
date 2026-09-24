import React, { useState } from 'react';
import { EngineerStatusEnum, ExplanationResponse, Tag } from '../../../types';
import { dataStore } from '../../../utils/DataStore';
import { api } from '../../../api';
import { getEngineerStatusProps, getTransportProps } from '../../../utils/formatters';
import { DrawerTitle } from './DrawerTitle';
import { DrawerField } from './DrawerField';
import { DrawerActionButtons } from './DrawerActionButtons';
import { MapPin, Clock, Database, Sparkles, Shield } from 'lucide-react';
import { SkeletonText } from '../../Skeleton';
import { Timeline } from '../../Timeline';
import { TagDisplay } from '../TagDisplay';

export interface EngineerDrawerBodyProps {
  engineerId: string;
  onBack: () => void;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  onSelectTask?: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onToggleEngineerStatus?: (engineerId: string) => void;
  onDeleteEngineer?: (engineerId: string) => void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
}

export const EngineerDrawerBody: React.FC<EngineerDrawerBodyProps> = ({
  engineerId,
  onBack,
  selectedTaskId,
  selectedRoadId,
  onSelectTask,
  onSelectRoad,
  onToggleEngineerStatus,
  onDeleteEngineer,
  onFocusTravelSegment,
}) => {
  const eng = dataStore.find_by_id_engineer(engineerId);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExp, setIsLoadingExp] = useState(false);
  const [isExpOpen, setIsExpOpen] = useState(false);

  if (!eng) {
    return (
      <div className="p-4 text-center text-slate-400 space-y-2">
        <p className="text-xs">Инженер с ID #{engineerId} не найден</p>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-beeline-yellow hover:underline cursor-pointer"
        >
          ← Вернуться к списку
        </button>
      </div>
    );
  }

  const statusProps = getEngineerStatusProps(eng.status);
  const transportProps = getTransportProps(eng.transport_type);
  const TransportIcon = transportProps.icon;
  const isUnavailable = eng.status === EngineerStatusEnum.UNAVAILABLE;

  const handleFetchExplanation = async (id: string) => {
    setIsExpOpen(true);
    if (explanation) return;
    setIsLoadingExp(true);
    try {
      const res = await api.getEngineerExplanation(id);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to get engineer explanation:', err);
    } finally {
      setIsLoadingExp(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-3 p-1">
      {/* 1. DrawerTitle */}
      <DrawerTitle
        title={eng.name}
        subtitle={`ID: #${eng.id}`}
        badge={statusProps.label}
        badgeClassName={statusProps.badgeClass}
        onBack={onBack}
      />

      {/* 2. Key Fields */}
      <div className="grid grid-cols-2 gap-2">
        <DrawerField
          icon={<Clock className="w-3.5 h-3.5 text-yellow-400" />}
          label="Рабочая смена"
          value={`${eng.shift_start?.time || '09:00'} – ${eng.shift_end?.time || '21:00'}`}
        />
        <DrawerField
          icon={<TransportIcon className={`w-3.5 h-3.5 ${transportProps.colorClass}`} />}
          label="Транспорт"
          value={transportProps.label}
        />
      </div>

      {eng.position && (
        <DrawerField
          icon={<MapPin className="w-3.5 h-3.5 text-rose-400" />}
          label="Базирование (депо)"
          value={eng.position.address || `${eng.position.lat.toFixed(4)}, ${eng.position.lon.toFixed(4)}`}
        />
      )}

      {/* 3. Tags Section strictly from typed fields via TagDisplay */}
      {(() => {
        const entityTags: Tag[] = [];
        if (isUnavailable) {
          entityTags.push({ kind: 'status', value: 'unavailable' });
        } else if (eng.tasks.length > 0) {
          entityTags.push({ kind: 'status', value: 'active' });
        } else {
          entityTags.push({ kind: 'status', value: 'idle' });
        }
        if (eng.status === EngineerStatusEnum.NEW) {
          entityTags.push({ kind: 'status', value: 'modified' });
        }
        if (eng.transport_type) {
          entityTags.push({ kind: 'transport', value: eng.transport_type });
        }
        if (eng.skills) {
          eng.skills.forEach((s) => entityTags.push({ kind: 'skill', value: s }));
        }
        return (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-500" />
              <span>Квалификации и атрибуты</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entityTags.map((tag, idx) => (
                <TagDisplay key={idx} tag={tag} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* 4. Timeline Section directly via Timeline */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>Шкала рабочего дня (00:00 – 24:00)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {eng.tasks.length} {eng.tasks.length === 1 ? 'выезд' : 'выездов'}
          </span>
        </div>

        <Timeline
          taskIds={eng.tasks}
          roadIds={eng.roads}
          shift_start={eng.shift_start}
          shift_end={eng.shift_end}
          status={eng.status}
          selectedTaskId={selectedTaskId}
          selectedRoadId={selectedRoadId}
          engineerPosition={{ lat: eng.position.lat, lon: eng.position.lon }}
          engineerName={eng.name}
          onSelectTask={onSelectTask}
          onSelectRoad={onSelectRoad}
          onFocusTravelSegment={onFocusTravelSegment}
          showHourMarks={true}
          orientation="vertical"
          height={960}
        />
      </div>



      {/* 6. Optional XAI details container */}
      {isExpOpen && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-beeline-yellow">
              <Sparkles className="w-3.5 h-3.5" />
              <span>XAI Анализ маршрута</span>
            </div>
            {explanation?.cached && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Database className="w-3 h-3" />
                <span>Кэшировано</span>
              </span>
            )}
          </div>

          {isLoadingExp ? (
            <div className="space-y-2 py-1">
              <SkeletonText lines={3} />
            </div>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {explanation?.explanation || 'Нет данных для объяснения'}
            </p>
          )}
        </div>
      )}

      {/* 7. Action Buttons */}
      <DrawerActionButtons
        id={eng.id}
        onToggleStatus={onToggleEngineerStatus}
        isUnavailable={isUnavailable}
        onDelete={onDeleteEngineer}
        onOpenExplanation={!isExpOpen ? handleFetchExplanation : undefined}
        explanationLabel="Объяснить распределение (XAI)"
      />
    </div>
  );
};
