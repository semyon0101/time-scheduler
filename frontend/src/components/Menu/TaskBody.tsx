import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { TaskSearchBody } from './SearchBody/TaskSearchBody';
import { TaskCreateBody } from './CreateBody/TaskCreateBody';
import { TaskDrawerBody } from './DrawerBody/TaskDrawerBody';

export interface TaskBodyProps {
  taskIds: string[];
  selectedTaskId?: string | null;
  onSelectTask: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onCancelTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCreateTask: (data: Partial<Task>) => Promise<void> | void;
  onSelectEngineer?: (engineerId: string) => void;
  isCreating?: boolean;
}

export const TaskBody: React.FC<TaskBodyProps> = ({
  taskIds,
  selectedTaskId,
  onSelectTask,
  onSelectRoad,
  onCancelTask,
  onDeleteTask,
  onOpenExplanation,
  onCreateTask,
  onSelectEngineer,
  isCreating = false,
}) => {
  const [mode, setMode] = useState<'search' | 'create' | 'detail'>('search');
  const [detailId, setDetailId] = useState<string | null>(selectedTaskId || null);

  useEffect(() => {
    if (selectedTaskId) {
      setDetailId(selectedTaskId);
      setMode('detail');
    } else if (mode === 'detail') {
      setMode('search');
      setDetailId(null);
    }
  }, [selectedTaskId]);

  const handleSelectTask = (id: string) => {
    setDetailId(id);
    setMode('detail');
    onSelectTask(id);
  };

  const handleBackToSearch = () => {
    setMode('search');
    setDetailId(null);
    onSelectTask('');
  };

  const handleCreateSubmit = async (data: Partial<Task>) => {
    try {
      await onCreateTask(data);
      setMode('search');
    } catch (e) {
      console.error('Error creating task:', e);
    }
  };

  if (mode === 'create') {
    return (
      <TaskCreateBody
        onSubmit={handleCreateSubmit}
        onCancel={() => setMode('search')}
        isLoading={isCreating}
      />
    );
  }

  if (mode === 'detail' && detailId) {
    return (
      <TaskDrawerBody
        taskId={detailId}
        onBack={handleBackToSearch}
        onSelectEngineer={onSelectEngineer}
        onSelectTask={handleSelectTask}
        onSelectRoad={onSelectRoad}
        onCancelTask={onCancelTask}
        onDeleteTask={onDeleteTask}
      />
    );
  }

  return (
    <TaskSearchBody
      taskIds={taskIds}
      selectedTaskId={selectedTaskId}
      onSelectTask={handleSelectTask}
      onCancelTask={onCancelTask}
      onDeleteTask={onDeleteTask}
      onOpenExplanation={onOpenExplanation || handleSelectTask}
      onSwitchToCreate={() => setMode('create')}
    />
  );
};
