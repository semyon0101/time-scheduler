import React, { useState, useEffect } from 'react';
import { Engineer } from '../../types';
import { EngineerSearchBody } from './SearchBody/EngineerSearchBody';
import { EngineerCreateBody } from './CreateBody/EngineerCreateBody';
import { EngineerDrawerBody } from './DrawerBody/EngineerDrawerBody';

export interface EngineerBodyProps {
  engineerIds: string[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  onSelectEngineer: (engineerId: string) => void;
  onCreateEngineer: (data: Partial<Engineer>) => Promise<void> | void;
  onToggleEngineerStatus?: (engineerId: string) => void;
  onDeleteEngineer?: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onFocusTravelSegment?: (segment: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  }) => void;
  isCreating?: boolean;
}

export const EngineerBody: React.FC<EngineerBodyProps> = ({
  engineerIds,
  selectedEngineerId,
  selectedTaskId,
  selectedRoadId,
  onSelectEngineer,
  onCreateEngineer,
  onToggleEngineerStatus,
  onDeleteEngineer,
  onSelectTask,
  onSelectRoad,
  onFocusTravelSegment,
  isCreating = false,
}) => {
  const [mode, setMode] = useState<'search' | 'create' | 'detail'>('search');
  const [detailId, setDetailId] = useState<string | null>(selectedEngineerId || null);

  useEffect(() => {
    if (selectedEngineerId) {
      setDetailId(selectedEngineerId);
      setMode('detail');
    } else if (mode === 'detail') {
      setMode('search');
      setDetailId(null);
    }
  }, [selectedEngineerId]);

  const handleSelectEngineer = (id: string) => {
    setDetailId(id);
    setMode('detail');
    onSelectEngineer(id);
  };

  const handleBackToSearch = () => {
    setMode('search');
    setDetailId(null);
    onSelectEngineer('');
  };

  const handleCreateSubmit = async (data: Partial<Engineer>) => {
    try {
      await onCreateEngineer(data);
      setMode('search');
    } catch (e) {
      console.error('Error creating engineer:', e);
    }
  };

  if (mode === 'create') {
    return (
      <EngineerCreateBody
        onSubmit={handleCreateSubmit}
        onCancel={() => setMode('search')}
        isLoading={isCreating}
      />
    );
  }

  if (mode === 'detail' && detailId) {
    return (
      <EngineerDrawerBody
        engineerId={detailId}
        onBack={handleBackToSearch}
        selectedTaskId={selectedTaskId}
        selectedRoadId={selectedRoadId}
        onSelectTask={onSelectTask}
        onSelectRoad={onSelectRoad}
        onToggleEngineerStatus={onToggleEngineerStatus}
        onDeleteEngineer={onDeleteEngineer}
        onFocusTravelSegment={onFocusTravelSegment}
      />
    );
  }

  return (
    <EngineerSearchBody
      engineerIds={engineerIds}
      selectedEngineerId={selectedEngineerId}
      onSelectEngineer={handleSelectEngineer}
      onSwitchToCreate={() => setMode('create')}
    />
  );
};
