import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-800/80 rounded ${className}`}
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`h-3 bg-slate-800/80 rounded animate-pulse ${
            idx === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 animate-pulse ${className}`}>
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-800 rounded w-1/3" />
        <div className="h-3 bg-slate-800 rounded w-1/5" />
      </div>
      <div className="h-3 bg-slate-800/60 rounded w-full" />
      <div className="flex gap-2">
        <div className="h-4 bg-slate-800/70 rounded w-16" />
        <div className="h-4 bg-slate-800/70 rounded w-20" />
      </div>
    </div>
  );
};

export const SkeletonTimeline: React.FC = () => {
  return (
    <div className="space-y-2 p-2 bg-slate-950/40 rounded-lg border border-slate-800/60 animate-pulse">
      <div className="h-3 bg-slate-800 rounded w-40" />
      <div className="h-7 bg-slate-800/60 rounded-md w-full" />
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
};
