import React from 'react';
import { Users, Navigation, CheckCircle, AlertCircle, TrendingDown, Award } from 'lucide-react';
import { Metrics } from '../types';
import { SkeletonCard } from './Skeleton';

interface MetricsCardProps {
  metrics?: Metrics | null;
  totalTasks: number;
  isLoading?: boolean;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({ metrics, totalTasks, isLoading }) => {
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
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center justify-between">
        <span>Расписание еще не рассчитано. Нажмите <strong>«⚡ Распланировать»</strong> для запуска оптимизации.</span>
      </div>
    );
  }

  const engReduction = metrics.engineers_reduction_pct;
  const mileageReduction = metrics.mileage_reduction_pct;

  return (
    <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {/* Metric 1: Engineers Count */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            Задействовано инженеров
          </span>
          {engReduction != null && engReduction > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              -{engReduction}%
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">{metrics.optimized_engineers}</span>
          <span className="text-xs text-slate-400">
            чел {engReduction != null && <span className="line-through text-slate-400 ml-1">база: {metrics.baseline_engineers}</span>}
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
          {mileageReduction != null && mileageReduction > 0 && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              -{mileageReduction}%
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">{metrics.optimized_mileage}</span>
          <span className="text-xs text-slate-400">
            км {mileageReduction != null && <span className="line-through text-slate-400 ml-1">база: {metrics.baseline_mileage}</span>}
          </span>
        </div>
      </div>

      {/* Metric 3: Task Assignment */}
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

      {/* Metric 4: Unassigned Tasks */}
      <div className={`border rounded-xl p-3 relative overflow-hidden ${
        metrics.unassigned_count > 0 
          ? 'bg-rose-950/20 border-rose-800/50 text-rose-300' 
          : 'bg-slate-900 border-slate-800 text-slate-400'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <AlertCircle className={`w-3.5 h-3.5 ${metrics.unassigned_count > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
            Не назначено
          </span>
          {metrics.unassigned_count === 0 ? (
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              <Award className="w-3 h-3" />
              100% успех
            </span>
          ) : (
            <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
              Внимание
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-black ${metrics.unassigned_count > 0 ? 'text-rose-400' : 'text-white'}`}>
            {metrics.unassigned_count}
          </span>
          <span className="text-xs text-slate-400">заявок требуют внимания</span>
        </div>
      </div>
    </div>
    <div className="text-xs text-slate-300 flex flex-wrap gap-x-5 gap-y-1 px-1" role="status">
      <span>Аварии без назначения: <strong>{metrics.unassigned_emergencies ?? 0}</strong></span>
      <span>Подключения без назначения: <strong>{metrics.unassigned_connections ?? 0}</strong></span>
      <span>Реакция на аварию: {metrics.measured_emergencies
        ? <><strong>{metrics.late_emergencies ?? 0}</strong> позже 120 мин; в пределах 60 мин — <strong>{metrics.target_met_emergencies ?? 0}</strong> из {metrics.measured_emergencies}</>
        : 'нет данных о времени поступления'}</span>
      {(metrics.reassigned_tasks ?? 0) > 0 && <span>Смена исполнителя: {metrics.reassigned_tasks}</span>}
    </div>
    </>
  );
};
