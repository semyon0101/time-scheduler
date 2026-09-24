import React from 'react';
import { ArrowLeft, X } from 'lucide-react';

export interface PanelTitleProps {
  title: string;
  badge?: string;
  onClose?: () => void;
  onBack?: () => void;
  children?: React.ReactNode;
}

export const PanelTitle: React.FC<PanelTitleProps> = ({
  title,
  badge,
  onClose,
  onBack,
  children,
}) => {
  return (
    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Назад"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
        {badge && (
          <span className="px-2 py-0.5 text-[10px] font-semibold bg-beeline-yellow/20 text-beeline-yellow border border-beeline-yellow/30 rounded-full">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
