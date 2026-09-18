import React, { useState } from 'react';
import { EngineerRoute, Engineer, Task, ExplanationResponse, TravelSegmentFocus } from '../types';
import { api } from '../api';
import { SkeletonText } from './Skeleton';
import { VerticalTimeline } from './VerticalTimeline';
import { 
  ArrowLeft, Car, Bus, Bike, Footprints, Clock, 
  Sparkles, Navigation, Shield, Trash2, Database, ShieldCheck, X, UserX 
} from 'lucide-react';

interface EngineerDrawerProps {
  route?: EngineerRoute;
  engineer: Engineer;
  tasks?: Task[];
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteEngineer?: (engineerId: string) => void;
  onToggleEngineerStatus?: (engineerId: string) => void;
  onFocusTravelSegment?: (segment: TravelSegmentFocus) => void;
}

export const EngineerDrawer: React.FC<EngineerDrawerProps> = ({
  route,
  engineer,
  tasks = [],
  onClose,
  onSelectTask,
  onOpenExplanation,
  onCancelTask,
  onDeleteEngineer,
  onToggleEngineerStatus,
  onFocusTravelSegment
}) => {
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [isLoadingExp, setIsLoadingExp] = useState(false);
  const [isExpOpen, setIsExpOpen] = useState(false);

  if (!engineer && !route) return null;

  const engName = route?.engineer_name || engineer?.name || 'Инженер';
  const engId = route?.engineer_id || engineer?.id || '';
  const transport = route?.transport_type || engineer?.transport_type || 'Автомобиль';
  const shiftStart = route?.shift_start || engineer?.shift_start || '09:00';
  const shiftEnd = route?.shift_end || engineer?.shift_end || '22:00';
  const skills = route?.skills || engineer?.skills || [];
  const stops = route?.stops || [];
  const isUnavailable = engineer?.status === 'unavailable';
  const isIdle = stops.length === 0;

  const getTransportIcon = (t: string) => {
    switch (t) {
      case 'Автомобиль': return <Car className="w-3.5 h-3.5 text-blue-400" />;
      case 'Общественный транспорт': return <Bus className="w-3.5 h-3.5 text-purple-400" />;
      case 'Велосипед': return <Bike className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Пешеход': return <Footprints className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Car className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleFetchRouteExplanation = async () => {
    setIsExpOpen(true);
    if (explanation) return;
    setIsLoadingExp(true);
    try {
      const res = await api.getEngineerExplanation(engId);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to get engineer explanation:', err);
    } finally {
      setIsLoadingExp(false);
    }
  };

  return (
    <div className="h-full max-h-[calc(100vh-210px)] flex flex-col overflow-hidden bg-slate-900 text-slate-100 font-sans">
      {/* Top Header inside drawer */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>Ко всем инженерам</span>
        </button>

        <div className="flex items-center gap-1.5">
          {isUnavailable ? (
            <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-bold">
              Сход с линии
            </span>
          ) : engineer?.status === 'pending_unavailable' ? (
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold">
              Изменения (Сход)
            </span>
          ) : isIdle ? (
            <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-bold">
              В резерве
            </span>
          ) : (
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">
              {stops.length} заявок
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area - Scrollable, does NOT lengthen page */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Profile Card */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{engName}</h3>
              <span className="text-[10px] text-slate-400 font-mono">ID: {engId}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-200 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
              {getTransportIcon(transport)}
              <span>{transport}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-slate-800/60">
            <span className="text-slate-400">Смена:</span>
            <span className="font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-beeline-yellow" />
              {shiftStart} – {shiftEnd}
            </span>
          </div>

          <div className="pt-1">
            <span className="text-[10px] text-slate-400 block mb-1">Квалификация:</span>
            <div className="flex flex-wrap gap-1">
              {skills.map((s, i) => (
                <span key={i} className="text-[9px] bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1 border border-slate-700">
                  <Shield className="w-2.5 h-2.5 text-blue-400" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Stats if active */}
          {!isIdle && (
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/60 text-center text-xs">
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Пробег</span>
                <span className="font-bold text-amber-400">{route?.total_distance_km} км</span>
              </div>
              <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Время в пути</span>
                <span className="font-bold text-sky-400">{route?.total_travel_min} мин</span>
              </div>
            </div>
          )}
        </div>

        {/* AI ROUTE EXPLANATION SECTION (Inline, no full-screen blur!) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-beeline-yellow" />
              {isIdle ? 'ИИ-Обоснование резерва' : 'Обоснование всего маршрута'}
            </span>

            <button
              onClick={handleFetchRouteExplanation}
              disabled={isLoadingExp}
              className="px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-beeline-yellow border border-yellow-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isExpOpen ? 'Обновить' : 'Обосновать весь путь'}</span>
            </button>
          </div>

          {isExpOpen && (
            <div className="mt-2 space-y-2">
              {isLoadingExp ? (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-[11px] text-yellow-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-beeline-yellow animate-ping"></span>
                    <span>Анализ маршрута и генерация объяснения...</span>
                  </div>
                  <SkeletonText lines={4} />
                </div>
              ) : explanation ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Database className="w-3 h-3 text-blue-400" />
                      {explanation.cached ? 'Ответ из кэша PostgreSQL' : 'Свежая генерация нейросетью'}
                    </span>
                    <button onClick={() => setIsExpOpen(false)} className="text-slate-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed select-text">
                    {explanation.explanation}
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 px-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Проверено по критериям ТЗ «Билайн Бизнес»</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* REUSABLE VERTICAL TIMELINE (Strictly 08:00 to 22:00) replacing old horizontal and old itinerary */}
        <VerticalTimeline
          route={route}
          engineer={engineer}
          tasks={tasks}
          mode="detailed"
          onSelectTask={onSelectTask}
          onOpenExplanation={onOpenExplanation}
          onFocusTravelSegment={onFocusTravelSegment}
          onCancelTask={onCancelTask}
        />

        {/* Bottom Actions: Take Engineer Off-Line (IRREVERSIBLE) & Delete */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          {onToggleEngineerStatus && (
            isUnavailable ? (
              <div className="w-full text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 border bg-rose-950/30 text-rose-300 border-rose-900/60 shadow-inner">
                <UserX className="w-3.5 h-3.5 text-rose-400" />
                <span>Сход с линии завершен (инженер недоступен)</span>
              </div>
            ) : engineer?.status === 'pending_unavailable' ? (
              <button
                onClick={() => onToggleEngineerStatus(engId)}
                className="w-full text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all border bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-800/60 cursor-pointer shadow-sm"
              >
                <UserX className="w-3.5 h-3.5 text-amber-400" />
                <span>Отменить сход (вернуть в активные)</span>
              </button>
            ) : (
              <button
                onClick={() => onToggleEngineerStatus(engId)}
                className="w-full text-xs py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/60 cursor-pointer shadow-sm hover:border-rose-600"
              >
                <UserX className="w-3.5 h-3.5 text-rose-300" />
                <span>Снять с линии (перевести в «Изменения»)</span>
              </button>
            )
          )}

          {onDeleteEngineer && (
            <button
              onClick={() => onDeleteEngineer(engId)}
              className="w-full bg-slate-950/40 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400" />
              <span>Удалить инженера из базы</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
