import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, MapPin, Shield, Clock, Car, Sparkles, 
  ArrowRight, CheckCircle2, Award, ChevronRight, Layers, FileText 
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-beeline-yellow selection:text-slate-950">
      {/* Top Navbar */}
      <nav className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-beeline-yellow text-slate-950 font-black p-2 rounded-lg text-lg flex items-center justify-center shadow-md">
              B!
            </div>
            <div>
              <span className="font-bold text-white tracking-tight text-base">Билайн Бизнес</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-yellow-950/60 text-beeline-yellow border border-yellow-700/40">
                FSM Dispatcher 2.0
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-bold text-xs shadow-lg shadow-yellow-500/10 transition-all cursor-pointer hover:scale-105"
          >
            <span>В панель диспетчера</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-12 pb-8 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>Хакатон-решение: Автоматическое построение маршрутов и XAI</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
          Интеллектуальный помощник диспетчера <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-beeline-yellow via-amber-300 to-yellow-500">
            «Билайн Бизнес»
          </span>
        </h1>

        <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Автоматическое распределение выездных инженеров (VRPTW), интерактивные маршруты на карте Москвы, 
          мгновенное перепланирование при форс-мажорах и объяснимый искусственный интеллект (XAI).
        </p>

        {/* Quick Highlights Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-4 text-left">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <Shield className="w-4 h-4 text-blue-400 mb-1.5" />
            <div className="font-bold text-white text-xs">3 группы правил</div>
            <div className="text-[11px] text-slate-400">Навыки, смены, авто/пешком</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <Award className="w-4 h-4 text-emerald-400 mb-1.5" />
            <div className="font-bold text-white text-xs">-42% пробега</div>
            <div className="text-[11px] text-slate-400">Экономия против Baseline FIFO</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <Zap className="w-4 h-4 text-amber-400 mb-1.5" />
            <div className="font-bold text-white text-xs">Пакетный Replan</div>
            <div className="text-[11px] text-slate-400">Срочные аварии и сход инженера</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <Sparkles className="w-4 h-4 text-purple-400 mb-1.5" />
            <div className="font-bold text-white text-xs">Объяснимый ИИ</div>
            <div className="text-[11px] text-slate-400">XAI с кэшированием в SQLite</div>
          </div>
        </div>
      </section>

      {/* Step-by-Step Jury Quick Start Guide */}
      <section className="px-6 py-8 max-w-4xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-beeline-yellow" />
              Сводная информация: План быстрого старта (5 минут на защите)
            </h2>
            <p className="text-xs text-slate-400">
              Пошаговый сценарий демонстрации работы алгоритма для членов жюри
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Step 1 */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-beeline-yellow font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-[11px]">1</span>
              <span>Загрузка набора данных</span>
            </div>
            <p className="text-xs text-slate-300">
              В шапке системы выберите любой готовый датасет: <strong>Восток (67 заявок)</strong>, <strong>Юго-восток (84 заявки)</strong> или <strong>Югоцентр (57 заявок)</strong>. Данные извлечены из официального архива и заранее геокодированы.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-beeline-yellow font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-[11px]">2</span>
              <span>Запуск оптимизации</span>
            </div>
            <p className="text-xs text-slate-300">
              Нажмите кнопку <strong>«⚡ Распланировать»</strong>. Оцените плашку метрик: алгоритм сокращает число требуемых инженеров и суммарный километраж более чем на 35–45% относительно базового распределения (FIFO).
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-beeline-yellow font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-[11px]">3</span>
              <span>Путевой лист сотрудника</span>
            </div>
            <p className="text-xs text-slate-300">
              Кликните по любому инженеру в списке справа: карта изолирует его трек, а сбоку выедет шторка с хронологическим путевым листом (время выезда, доезда и выполнения работ).
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-beeline-yellow font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center text-[11px]">4</span>
              <span>ИИ-Обоснование решения (XAI)</span>
            </div>
            <p className="text-xs text-slate-300">
              Кликните по точке заявки на карте и нажмите <strong>«ИИ-Обоснование»</strong>. Сначала сработает генерация LLM (~3 сек), а повторный вызов моментально подтянется из кэша SQLite.
            </p>
          </div>
        </div>

        {/* Step 5 Banner */}
        <div className="bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-900/40 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-rose-300">Шаг 5. Симуляция форс-мажоров дня (Batch Replan)</h3>
            <p className="text-xs text-slate-300 mt-1">
              В выпадающем меню <strong>«События дня»</strong> запустите сценарий <em>«Пакет: Срочная авария + поломка»</em>. Алгоритм без перезагрузок на лету перераспределит оставшиеся задачи сошедшего инженера и встроит срочную заявку с наименьшим сдвигом графика.
            </p>
          </div>
        </div>
      </section>

      {/* Dataset Selection Preview */}
      <section className="px-6 py-6 max-w-4xl mx-auto w-full space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          Доступные демонстрационные районы Москвы
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <div className="font-bold text-white text-xs">Район «Восток»</div>
            <div className="text-[11px] text-slate-400 mt-1">67 заявок • 12 инженеров</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Таганский, Текстильщики, Кузьминки</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <div className="font-bold text-white text-xs">Район «Юго-восток»</div>
            <div className="text-[11px] text-slate-400 mt-1">84 заявки • 12 инженеров</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Царицыно, Орехово-Борисово, Зябликово</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
            <div className="font-bold text-white text-xs">Район «Югоцентр»</div>
            <div className="text-[11px] text-slate-400 mt-1">57 заявок • 11 инженеров</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Даниловский, Хамовники, Донской</div>
          </div>
        </div>
      </section>

      {/* Big Bottom Action CTA */}
      <section className="px-6 py-12 max-w-xl mx-auto w-full text-center space-y-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-4 px-6 rounded-2xl bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-black text-base shadow-xl shadow-yellow-500/20 transition-all cursor-pointer flex items-center justify-center gap-3 hover:scale-102"
        >
          <span>🚀 Открыть рабочее место диспетчера</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-xs text-slate-400">
          Данные диспетчера сохраняются в локальной сессии браузера. Настройка и авторизация не требуются.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400">
        Разработано для кейса «Билайн Бизнес» • FSM / VRPTW & Explainable AI Solution
      </footer>
    </div>
  );
};
