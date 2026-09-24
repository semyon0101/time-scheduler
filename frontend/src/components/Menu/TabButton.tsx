import React from 'react';

export interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  badge?: string;
  className?: string;
  textDefaultColor?: string;
  textHoverColor?: string;
  bgDefaultColor?: string;
  bgHoverColor?: string;
  activeClassName?: string;
  gridColSpan?: string;
}

export const TabButton: React.FC<TabButtonProps> = ({
  label,
  icon,
  isActive,
  onClick,
  count,
  badge,
  className = '',
  textDefaultColor = 'text-slate-400',
  textHoverColor = 'hover:text-slate-200',
  bgDefaultColor = '',
  bgHoverColor = 'hover:bg-slate-800/40',
  activeClassName = 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/80',
  gridColSpan = '',
}) => {
  const inactiveClasses = `${textDefaultColor} ${textHoverColor} ${bgDefaultColor} ${bgHoverColor}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none ${gridColSpan} ${
        isActive ? activeClassName : inactiveClasses
      } ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {typeof count === 'number' && (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
            isActive ? 'bg-black/30 text-white' : 'bg-slate-800/80 text-slate-400'
          }`}
        >
          {count}
        </span>
      )}
      {badge && (
        <span className="text-[10px] bg-beeline-yellow text-slate-950 px-1.5 py-0.2 rounded font-black">
          {badge}
        </span>
      )}
    </button>
  );
};
