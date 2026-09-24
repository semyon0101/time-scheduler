import React from 'react';

export interface DrawerFieldProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const DrawerField: React.FC<DrawerFieldProps> = ({
  icon,
  label,
  value,
  className = '',
}) => {
  return (
    <div className={`p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-2 text-xs ${className}`}>
      <span className="shrink-0 mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">{label}</span>
        <div className="font-medium text-slate-200 truncate mt-0.5">{value}</div>
      </div>
    </div>
  );
};
