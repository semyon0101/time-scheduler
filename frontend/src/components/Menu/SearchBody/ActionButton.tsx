import React from 'react';
import { Plus } from 'lucide-react';

export interface ActionButtonProps {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  text,
  onClick,
  icon = <Plus className="w-3.5 h-3.5" />,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold text-slate-950 bg-beeline-yellow hover:bg-yellow-400 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 select-none ${className}`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
};
