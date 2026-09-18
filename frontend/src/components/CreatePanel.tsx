import React, { useState } from 'react';
import { Task, Engineer } from '../types';
import { CANONICAL_SKILLS } from '../utils/tags';
import { ArrowLeft, Plus, Wrench, Clock, MapPin, Car, Shield } from 'lucide-react';

interface CreatePanelProps {
  type: 'task' | 'engineer';
  onClose: () => void;
  onSubmitTask: (task: Partial<Task>) => void;
  onSubmitEngineer: (eng: Partial<Engineer>) => void;
}

export const CreatePanel: React.FC<CreatePanelProps> = ({
  type,
  onClose,
  onSubmitTask,
  onSubmitEngineer
}) => {
  // Preselected smart defaults for Task
  const [taskAddress, setTaskAddress] = useState('Город Москва, ул. Тверская, д. 15');
  const [taskDistrict, setTaskDistrict] = useState('Центральный');
  const [taskLat, setTaskLat] = useState('55.7578');
  const [taskLon, setTaskLon] = useState('37.6110');
  const [taskWindowStart, setTaskWindowStart] = useState('10:00');
  const [taskWindowEnd, setTaskWindowEnd] = useState('12:00');
  const [taskDuration, setTaskDuration] = useState('45');
  const [taskSkill, setTaskSkill] = useState('Локальные работы');
  const [taskTransport, setTaskTransport] = useState('Любой');
  const [taskPriority, setTaskPriority] = useState('Обычная');

  // Preselected smart defaults for Engineer
  const [engName, setEngName] = useState('Инженер Новиков Алексей');
  const [engTransport, setEngTransport] = useState('Автомобиль');
  const [engShiftStart, setEngShiftStart] = useState('09:00');
  const [engShiftEnd, setEngShiftEnd] = useState('22:00');
  const [engLat, setEngLat] = useState('55.7512');
  const [engLon, setEngLon] = useState('37.6184');
  const [engSkills, setEngSkills] = useState<string[]>([
    'Локальные работы',
    'Работы на подключение и дозаказы'
  ]);

  const allSkills = CANONICAL_SKILLS;

  const handleToggleSkill = (skill: string) => {
    if (engSkills.includes(skill)) {
      if (engSkills.length > 1) {
        setEngSkills(engSkills.filter((s) => s !== skill));
      }
    } else {
      setEngSkills([...engSkills, skill]);
    }
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitTask({
      address: taskAddress,
      district: taskDistrict,
      lat: parseFloat(taskLat) || 55.75,
      lon: parseFloat(taskLon) || 37.61,
      window_start: taskWindowStart,
      window_end: taskWindowEnd,
      duration_min: parseInt(taskDuration, 10) || 45,
      required_skill: taskSkill,
      required_transport: taskTransport === 'Любой' ? null : taskTransport,
      priority: taskPriority
    });
    onClose();
  };

  const handleEngineerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitEngineer({
      name: engName,
      transport_type: engTransport,
      shift_start: engShiftStart,
      shift_end: engShiftEnd,
      start_lat: parseFloat(engLat) || 55.75,
      start_lon: parseFloat(engLon) || 37.61,
      skills: engSkills
    });
    onClose();
  };

  return (
    <div className="h-full max-h-[calc(100vh-210px)] flex flex-col overflow-hidden bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>Назад</span>
        </button>

        <span className="text-xs font-bold text-white flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-beeline-yellow" />
          <span>{type === 'task' ? 'Новая заявка' : 'Новый инженер'}</span>
        </span>
      </div>

      {/* Form Body (Scrollable, preselected defaults) */}
      <div className="flex-1 overflow-y-auto p-3">
        {type === 'task' ? (
          <form onSubmit={handleTaskSubmit} className="space-y-3 text-xs">
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2.5 rounded-xl text-[11px] text-yellow-300">
              ⚡ <strong>Значения по умолчанию уже выбраны.</strong> Вы можете сразу нажать «Создать заявку» или скорректировать любое поле.
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3 text-beeline-yellow" />
                <span>Адрес заявки</span>
              </label>
              <input
                type="text"
                required
                value={taskAddress}
                onChange={(e) => setTaskAddress(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              />
            </div>

            {/* District */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Район Москвы</label>
              <input
                type="text"
                value={taskDistrict}
                onChange={(e) => setTaskDistrict(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              />
            </div>

            {/* Window Start / End */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Окно от</span>
                </label>
                <input
                  type="time"
                  required
                  value={taskWindowStart}
                  onChange={(e) => setTaskWindowStart(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Окно до</span>
                </label>
                <input
                  type="time"
                  required
                  value={taskWindowEnd}
                  onChange={(e) => setTaskWindowEnd(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                />
              </div>
            </div>

            {/* Duration & Priority */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Длительность (мин)</label>
                <input
                  type="number"
                  min="15"
                  step="5"
                  required
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Приоритет</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                >
                  <option value="Обычная">Обычная</option>
                  <option value="Срочная">Срочная (Авария)</option>
                </select>
              </div>
            </div>

            {/* Skill */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Wrench className="w-3 h-3 text-purple-400" />
                <span>Требуемый навык</span>
              </label>
              <select
                value={taskSkill}
                onChange={(e) => setTaskSkill(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              >
                {allSkills.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Transport constraint */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Car className="w-3 h-3 text-emerald-400" />
                <span>Требуемый транспорт</span>
              </label>
              <select
                value={taskTransport}
                onChange={(e) => setTaskTransport(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              >
                <option value="Любой">Любой транспорт</option>
                <option value="Автомобиль">Строго Автомобиль</option>
              </select>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="space-y-1">
                <label className="text-slate-400">Широта (Lat)</label>
                <input
                  type="text"
                  value={taskLat}
                  onChange={(e) => setTaskLat(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Долгота (Lon)</label>
                <input
                  type="text"
                  value={taskLon}
                  onChange={(e) => setTaskLon(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Создать заявку</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEngineerSubmit} className="space-y-3 text-xs">
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2.5 rounded-xl text-[11px] text-yellow-300">
              ⚡ <strong>Значения по умолчанию уже выбраны.</strong> Вы можете сразу нажать «Создать инженера» или скорректировать любое поле.
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">ФИО инженера / Название бригады</label>
              <input
                type="text"
                required
                value={engName}
                onChange={(e) => setEngName(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              />
            </div>

            {/* Transport */}
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Car className="w-3 h-3 text-beeline-yellow" />
                <span>Тип транспорта</span>
              </label>
              <select
                value={engTransport}
                onChange={(e) => setEngTransport(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
              >
                <option value="Автомобиль">Автомобиль (35 км/ч)</option>
                <option value="Общественный транспорт">Общественный транспорт (20 км/ч)</option>
                <option value="Велосипед">Велосипед (15 км/ч)</option>
                <option value="Пешеход">Пешеход (5 км/ч)</option>
              </select>
            </div>

            {/* Shift */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Старт смены</span>
                </label>
                <input
                  type="time"
                  required
                  value={engShiftStart}
                  onChange={(e) => setEngShiftStart(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>Конец смены</span>
                </label>
                <input
                  type="time"
                  required
                  value={engShiftEnd}
                  onChange={(e) => setEngShiftEnd(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-beeline-yellow"
                />
              </div>
            </div>

            {/* Skills Checkboxes */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Подтвержденные навыки</span>
              </label>
              <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                {allSkills.map((s) => {
                  const checked = engSkills.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-2 cursor-pointer select-none text-[11px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSkill(s)}
                        className="rounded border-slate-700 text-beeline-yellow focus:ring-0"
                      />
                      <span className={checked ? 'text-white font-medium' : 'text-slate-400'}>{s}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Start Coords */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="space-y-1">
                <label className="text-slate-400">Широта базы</label>
                <input
                  type="text"
                  value={engLat}
                  onChange={(e) => setEngLat(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Долгота базы</label>
                <input
                  type="text"
                  value={engLon}
                  onChange={(e) => setEngLon(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-beeline-yellow hover:bg-yellow-400 text-slate-950 font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Создать инженера</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
