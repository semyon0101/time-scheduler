import React, { useState } from 'react';
import { TaskStatusEnum, ExplanationResponse, Tag } from '../../../types';
import { dataStore } from '../../../utils/DataStore';
import { api } from '../../../api';
import { DrawerTitle } from './DrawerTitle';
import { DrawerField } from './DrawerField';
import { DrawerActionButtons } from './DrawerActionButtons';
import { MapPin, Clock, UserX, Sparkles, Database, Shield } from 'lucide-react';
import { SkeletonText } from '../../Skeleton';
import { Timeline } from '../../Timeline';
import { TagDisplay } from '../TagDisplay';
import { EngineerSmallDrawer } from '../EngineerSmallDrawer';

export interface TaskDrawerBodyProps {
  taskId: string;
  onBack: () => void;
  onSelectEngineer?: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const TaskDrawerBody: React.FC<TaskDrawerBodyProps> = ({
  taskId,
  onBack,
  onSelectEngineer,
  onSelectTask,
  onSelectRoad,
  onCancelTask,
  onDeleteTask,
}) => {
  const task = dataStore.find_by_id_task(taskId);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExp, setIsLoadingExp] = useState(false);
  const [isExpOpen, setIsExpOpen] = useState(false);

  if (!task) {
    return (
      <div className="p-4 text-center text-slate-400 space-y-2">
        <p className="text-xs">Заявка #{taskId} не найдена</p>
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

  const assignedEng = task.engineer_id ? dataStore.find_by_id_engineer(task.engineer_id) : null;
  const isCancelled = task.status === TaskStatusEnum.CANCELLED;
  const isNew = task.status === TaskStatusEnum.NEW;

  const statusLabel = isCancelled
    ? 'Отменена'
    : isNew
    ? 'Новая'
    : assignedEng
    ? `Назначена (${assignedEng.name.replace('Бригада ', '')})`
    : 'В ожидании';

  const statusBadgeClass = isCancelled
    ? 'bg-slate-800 text-slate-500 border-slate-700'
    : isNew
    ? 'bg-sky-950 text-sky-300 border-sky-800'
    : assignedEng
    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
    : 'bg-amber-950 text-amber-300 border-amber-800';

  const handleFetchExplanation = async (id: string) => {
    setIsExpOpen(true);
    if (explanation) return;
    setIsLoadingExp(true);
    try {
      const res = await api.getExplanation(id);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to get explanation:', err);
    } finally {
      setIsLoadingExp(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-3 p-1">
      {/* 1. DrawerTitle */}
      <DrawerTitle
        title={`Заявка #${task.id}`}
        subtitle={task.district ? `Район: ${task.district}` : undefined}
        badge={statusLabel}
        badgeClassName={statusBadgeClass}
        onBack={onBack}
      />

      {/* 2. Key Fields */}
      <div className="grid grid-cols-2 gap-2">
        <DrawerField
          icon={<Clock className="w-3.5 h-3.5 text-yellow-400" />}
          label="Временное окно"
          value={`${task.window_start?.time || '09:00'} – ${task.window_end?.time || '21:00'}`}
        />
        <DrawerField
          icon={<Clock className="w-3.5 h-3.5 text-blue-400" />}
          label="Длительность"
          value={`${task.duration_time?.absolute_time || 0} мин`}
        />
      </div>

      {task.position && (
        <DrawerField
          icon={<MapPin className="w-3.5 h-3.5 text-rose-400" />}
          label="Адрес выполнения"
          value={
            <div>
              <div className="text-white font-medium">{task.position.address}</div>
              <div className="text-[10px] text-slate-500 font-mono">
                {task.position.lat.toFixed(4)}, {task.position.lon.toFixed(4)}
              </div>
            </div>
          }
        />
      )}

      {/* 3. Assigned Engineer Block via EngineerSmallDrawer */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Назначенный исполнитель
        </div>
        {assignedEng ? (
          <EngineerSmallDrawer
            id={assignedEng.id}
            onClick={onSelectEngineer}
          />
        ) : (
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
            <UserX className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Не назначен (ожидает автоматического пересчета)</span>
          </div>
        )}
      </div>

      {/* 4. Tags Section strictly from typed fields via TagDisplay */}
      {(() => {
        const entityTags: Tag[] = [];
        if (isCancelled) {
          entityTags.push({ kind: 'status', value: 'cancelled' });
        } else if (task.engineer_id) {
          entityTags.push({ kind: 'status', value: 'assigned' });
        } else {
          entityTags.push({ kind: 'status', value: 'unassigned' });
        }
        if (isNew) {
          entityTags.push({ kind: 'status', value: 'modified' });
        }
        if (task.priority) {
          entityTags.push({ kind: 'priority', value: task.priority });
        }
        if (task.required_skill) {
          entityTags.push({ kind: 'skill', value: task.required_skill });
        }
        if (task.required_transport) {
          entityTags.push({ kind: 'transport', value: task.required_transport });
        }
        return (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Shield className="w-3 h-3 text-slate-500" />
              <span>Теги и требования</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entityTags.map((tag, idx) => (
                <TagDisplay key={idx} tag={tag} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* 5. Timeline Section directly via Timeline */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>
              {assignedEng ? `Маршрут инженера (${assignedEng.name.replace('Бригада ', '')})` : 'Временное окно заявки'}
            </span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {assignedEng ? `${assignedEng.tasks.length} выездов` : `${task.duration_time?.absolute_time || 0} мин`}
          </span>
        </div>

        <Timeline
          taskIds={assignedEng ? assignedEng.tasks : [task.id]}
          roadIds={assignedEng ? assignedEng.roads : []}
          shift_start={assignedEng ? assignedEng.shift_start : task.window_start}
          shift_end={assignedEng ? assignedEng.shift_end : task.window_end}
          status={assignedEng ? assignedEng.status : undefined}
          selectedTaskId={task.id}
          engineerPosition={
            assignedEng?.position
              ? { lat: assignedEng.position.lat, lon: assignedEng.position.lon }
              : undefined
          }
          engineerName={assignedEng?.name}
          onSelectTask={onSelectTask}
          onSelectRoad={onSelectRoad}
          showHourMarks={true}
          orientation="vertical"
          height={960}
        />
      </div>

      {/* 6. Optional XAI Explanation container */}
      {isExpOpen && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-beeline-yellow">
              <Sparkles className="w-3.5 h-3.5" />
              <span>XAI Анализ назначения</span>
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
        id={task.id}
        onCancel={onCancelTask}
        isCancelled={isCancelled}
        cancelLabel="Отменить заявку"
        onDelete={onDeleteTask}
        deleteLabel="Удалить заявку"
        onOpenExplanation={!isExpOpen ? handleFetchExplanation : undefined}
        explanationLabel="Объяснить решение (XAI)"
      />
    </div>
  );
};
