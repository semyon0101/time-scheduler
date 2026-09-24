import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface DrawerTitleProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeClassName?: string;
  onBack: () => void;
}

export const DrawerTitle: React.FC<DrawerTitleProps> = ({
  title,
  subtitle,
  badge,
  badgeClassName = 'bg-slate-800 text-slate-300 border-slate-700',
  onBack,
}) => {
  return (
    <div className="space-y-2 pb-2.5 border-b border-slate-800">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer select-none group"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-beeline-yellow transition-transform group-hover:-translate-x-0.5" />
        <span>Назад к списку</span>
      </button>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white tracking-tight truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 font-mono">{subtitle}</p>
          )}
        </div>

        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeClassName}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};
