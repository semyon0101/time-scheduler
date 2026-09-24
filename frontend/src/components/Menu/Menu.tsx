import React, { useState, useEffect } from 'react';
import { Engineer, Task, Focus } from '../../types';
import { dataStore } from '../../utils/DataStore';
import { Users, ClipboardList, BookOpen } from 'lucide-react';
import { TabButton } from './TabButton';
import { EngineerBody } from './EngineerBody';
import { TaskBody } from './TaskBody';
import { HelpBody } from './HelpBody';

export interface MenuProps {
  engineerIds: string[];
  taskIds: string[];
  activeTab?: 'engineers' | 'tasks' | 'help';
  onTabChange?: (tab: 'engineers' | 'tasks' | 'help') => void;
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  focus?: Focus;
  onSetFocus?: (focus: Focus) => void;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onCancelTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenExplanation: (taskId: string) => void;
  onToggleEngineerStatus?: (engineerId: string) => void;
  onDeleteEngineer?: (engineerId: string) => void;
  onCreateEngineer: (data: Partial<Engineer>) => Promise<void> | void;
  onCreateTask: (data: Partial<Task>) => Promise<void> | void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
  isCreatingEngineer?: boolean;
  isCreatingTask?: boolean;
  className?: string;
}

export const Menu: React.FC<MenuProps> = ({
  engineerIds,
  taskIds,
  activeTab: controlledTab,
  onTabChange,
  selectedEngineerId,
  selectedTaskId,
  selectedRoadId,
  focus,
  onSetFocus,
  onSelectEngineer,
  onSelectTask,
  onSelectRoad,
  onCancelTask,
  onDeleteTask,
  onOpenExplanation,
  onToggleEngineerStatus,
  onDeleteEngineer,
  onCreateEngineer,
  onCreateTask,
  onFocusTravelSegment,
  isCreatingEngineer = false,
  isCreatingTask = false,
  className = '',
}) => {
  const [internalTab, setInternalTab] = useState<'engineers' | 'tasks' | 'help'>('engineers');

  const currentTab = controlledTab !== undefined ? controlledTab : internalTab;

  const handleSetTab = (tab: 'engineers' | 'tasks' | 'help') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  // Synchronize tab based on Focus
  useEffect(() => {
    if (focus?.kind === 'engineer') {
      handleSetTab('engineers');
    } else if (focus?.kind === 'road') {
      const road = dataStore.find_by_id_roads(focus.id);
      if (road?.engineer_id) {
        handleSetTab('engineers');
      }
    } else if (focus?.kind === 'task') {
      handleSetTab('tasks');
    }
  }, [focus]);

  // Derive effective active selection IDs
  const effectiveEngineerId =
    focus?.kind === 'engineer'
      ? focus.id
      : focus?.kind === 'road'
      ? dataStore.find_by_id_roads(focus.id)?.engineer_id || null
      : selectedEngineerId;

  const effectiveTaskId =
    focus?.kind === 'task'
      ? focus.id
      : selectedTaskId;

  const effectiveRoadId =
    focus?.kind === 'road'
      ? focus.id
      : selectedRoadId;

  const handleSelectEngineer = (id: string) => {
    if (onSetFocus) {
      onSetFocus(id ? { kind: 'engineer', id } : null);
    }
    onSelectEngineer(id);
  };

  const handleSelectTask = (id: string) => {
    if (onSetFocus) {
      onSetFocus(id ? { kind: 'task', id } : null);
    }
    onSelectTask(id);
  };

  const handleSelectRoad = (id: string) => {
    if (onSetFocus) {
      onSetFocus(id ? { kind: 'road', id } : null);
    }
    if (onSelectRoad) {
      onSelectRoad(id);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-100 ${className}`}>
      {/* Navigation Tab Bar with customized TabButton styles */}
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/60 border-b border-slate-800 shrink-0">
        <TabButton
          label="Инженеры"
          icon={<Users className="w-4 h-4" />}
          isActive={currentTab === 'engineers'}
          onClick={() => handleSetTab('engineers')}
          count={engineerIds.length}
          className="py-2.5"
          textDefaultColor="text-cyan-400"
          textHoverColor="hover:text-cyan-300"
          bgDefaultColor="bg-cyan-950/20"
          bgHoverColor="hover:bg-cyan-950/40"
          activeClassName="bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/60 shadow-sm"
          gridColSpan="col-span-1"
        />
        <TabButton
          label="Заявки"
          icon={<ClipboardList className="w-4 h-4" />}
          isActive={currentTab === 'tasks'}
          onClick={() => handleSetTab('tasks')}
          count={taskIds.length}
          className="py-2.5"
          textDefaultColor="text-amber-400"
          textHoverColor="hover:text-amber-300"
          bgDefaultColor="bg-amber-950/20"
          bgHoverColor="hover:bg-amber-950/40"
          activeClassName="bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/60 shadow-sm"
          gridColSpan="col-span-1"
        />
        <TabButton
          label="Справка"
          icon={<BookOpen className="w-4 h-4" />}
          isActive={currentTab === 'help'}
          onClick={() => handleSetTab('help')}
          className="py-2.5"
          textDefaultColor="text-indigo-400"
          textHoverColor="hover:text-indigo-300"
          bgDefaultColor="bg-indigo-950/20"
          bgHoverColor="hover:bg-indigo-950/40"
          activeClassName="bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/60 shadow-sm"
          gridColSpan="col-span-1"
        />
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-hidden p-2">
        {currentTab === 'engineers' && (
          <EngineerBody
            engineerIds={engineerIds}
            selectedEngineerId={effectiveEngineerId}
            selectedTaskId={effectiveTaskId}
            selectedRoadId={effectiveRoadId}
            onSelectEngineer={handleSelectEngineer}
            onCreateEngineer={onCreateEngineer}
            onToggleEngineerStatus={onToggleEngineerStatus}
            onDeleteEngineer={onDeleteEngineer}
            onSelectTask={handleSelectTask}
            onSelectRoad={handleSelectRoad}
            onFocusTravelSegment={onFocusTravelSegment}
            isCreating={isCreatingEngineer}
          />
        )}

        {currentTab === 'tasks' && (
          <TaskBody
            taskIds={taskIds}
            selectedTaskId={effectiveTaskId}
            onSelectTask={handleSelectTask}
            onSelectRoad={handleSelectRoad}
            onCancelTask={onCancelTask}
            onDeleteTask={onDeleteTask}
            onOpenExplanation={onOpenExplanation}
            onCreateTask={onCreateTask}
            onSelectEngineer={handleSelectEngineer}
            isCreating={isCreatingTask}
          />
        )}

        {currentTab === 'help' && (
          <div className="h-full overflow-y-auto">
            <HelpBody onSwitchToEngineers={() => handleSetTab('engineers')} />
          </div>
        )}
      </div>
    </div>
  );
};
