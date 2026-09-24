import React from 'react';
import { Sparkles, Users, Compass, Zap, Layers, Clock } from 'lucide-react';

export interface HelpBodyProps {
  onSwitchToEngineers: () => void;
}

export const HelpBody: React.FC<HelpBodyProps> = ({ onSwitchToEngineers }) => {
  return (
    <div className="space-y-3 text-xs text-slate-300 p-1">
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-3.5 rounded-xl">
        <h4 className="font-bold text-beeline-yellow flex items-center gap-1.5 text-xs mb-1">
          <Sparkles className="w-4 h-4" />
          <span>Справка: сценарий демонстрации для жюри (5 минут)</span>
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Многокритериальная оптимизация VRPTW с жесткими доменными ограничениями «Билайн Бизнес»:
          квалификации, временные окна, смены, типы транспорта, сход с линии и пакетное перепланирование.
        </p>
      </div>

      <ol className="space-y-2 text-[11px]">
        <li className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <Layers className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>1. Выбор сектора Москвы</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            В верхней панели выберите дату/сектор: <strong>Восток, Юго-восток или Югоцентр</strong>.
            На карте MapLibre нативно отрисуются маршруты без задержек.
          </p>
        </li>

        <li className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <Zap className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>2. Очередь изменений и кнопка «⚡ Распланировать»</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Создание заявок, снятие инженеров или отмена выездов накапливаются в очереди
            с отображением счетчика в шапке. Нажатие «⚡ Распланировать» запускает алгоритмический пересчет.
          </p>
        </li>

        <li className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <Clock className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>3. 24-часовые шкалы времени (Timeline)</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Под картой расположена глобальная шкала всех инженеров (00:00 – 24:00):
            синий блок — переезд, зеленый — работы, красный — сход с линии, серый — резерв.
          </p>
        </li>

        <li className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <Compass className="w-3.5 h-3.5 text-beeline-yellow" />
            <span>4. Интеллектуальный поиск и фильтрация по тегам</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Во вкладках меню доступны быстрый полнотекстовый поиск, разбиение на категории
            и интерактивные чипсы тегов (навыки, транспорт, статус).
          </p>
        </li>
      </ol>

      <div className="pt-2">
        <button
          type="button"
          onClick={onSwitchToEngineers}
          className="w-full py-2 bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Перейти к списку инженеров →</span>
        </button>
      </div>
    </div>
  );
};
