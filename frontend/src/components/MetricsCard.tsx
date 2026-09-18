import React from 'react';
import { Users, Navigation, CheckCircle, AlertCircle, TrendingDown, Award, RefreshCw } from 'lucide-react';
import { Metrics } from '../types';
import { SkeletonCard } from './Skeleton';

interface MetricsCardProps {
  metrics?: Metrics | null;
  totalTasks: number;
  hasChanges?: boolean;
  pendingChangesCount?: number;
  unassignedTasksCount?: number;
  isLoading?: boolean;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  metrics,
  totalTasks,
  hasChanges = false,
  pendingChangesCount = 0,
  unassignedTasksCount,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>План не рассчитан. Нажмите <strong>«⚡ Распланировать»</strong> для запуска оптимизации маршрутов.</span>
        </div>
        {hasChanges && pendingChangesCount > 0 && (
          <span className="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 font-bold text-[11px]">
            Требуется перерасчет ({pendingChangesCount})
          </span>
        )}
      </div>
    );
  }

  const unassignedCount = typeof unassignedTasksCount === 'number'
    ? unassignedTasksCount
    : (metrics.unassigned_count || 0);

  const engReduction = metrics.engineers_reduction_pct || 
    (metrics.baseline_engineers > 0 
      ? Math.round(((metrics.baseline_engineers - metrics.optimized_engineers) / metrics.baseline_engineers) * 100) 
      : 0);

  const mileageReduction = metrics.mileage_reduction_pct || 
    (metrics.baseline_mileage > 0 
      ? Math.round(((metrics.baseline_mileage - metrics.optimized_mileage) / metrics.baseline_mileage) * 100) 
      : 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-sans">
      {/* Metric 1: Engineers Count */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Задействовано инженеров
          </span>
          {engReduction > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              -{engReduction}%
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">{metrics.optimized_engineers}</span>
          <span className="text-xs text-slate-400">
            чел <span className="line-through text-slate-400 ml-1">база: {metrics.baseline_engineers}</span>
          </span>
        </div>
      </div>

      {/* Metric 2: Total Mileage */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            Суммарный пробег
          </span>
          {mileageReduction > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              -{mileageReduction}%
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">{metrics.optimized_mileage}</span>
          <span className="text-xs text-slate-400">
            км <span className="line-through text-slate-400 ml-1">база: {metrics.baseline_mileage}</span>
          </span>
        </div>
      </div>

      {/* Metric 3: Task Assignment Coverage */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Охват заявок
          </span>
          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold">
            {Math.round((metrics.assigned_count / (totalTasks || 1)) * 100)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">{metrics.assigned_count}</span>
          <span className="text-xs text-slate-400">из {totalTasks} заявок</span>
        </div>
      </div>

      {/* Metric 4: Attention / Operational Alert Card (Requirement 8) */}
      {hasChanges ? (
        <div className="bg-amber-950/30 border border-amber-500/70 rounded-xl p-3 relative overflow-hidden text-amber-300 ring-1 ring-amber-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold flex items-center gap-1.5 text-amber-400">
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              Статус плана
            </span>
            <span className="bg-amber-500/30 text-amber-200 border border-amber-500/50 text-[10px] px-1.5 py-0.5 rounded font-bold">
              Требуется перерасчет
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-amber-200">
              {pendingChangesCount > 0 ? `Изменений: ${pendingChangesCount}` : 'Есть изменения'}
            </span>
            <span className="text-[10px] text-slate-400 truncate">«⚡ Распланировать»</span>
          </div>
        </div>
      ) : unassignedCount > 0 ? (
        <div className="bg-rose-950/20 border border-rose-800/60 rounded-xl p-3 relative overflow-hidden text-rose-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Статус плана
            </span>
            <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
              Требует внимания
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-rose-400">{unassignedCount}</span>
            <span className="text-xs text-slate-400">заявок вне графика</span>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-xl p-3 relative overflow-hidden text-emerald-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1.5 text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Статус плана
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <Award className="w-3 h-3" />
              100% охват
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-black text-emerald-200">
              Все заявки в графике
            </span>
            <span className="text-[11px] text-slate-400">маршруты оптимальны</span>
          </div>
        </div>
      )}
    </div>
  );
};
