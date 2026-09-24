import React, { useState, useEffect } from 'react';
import { Time } from '../../../types';
import { parseTime } from '../../../utils/adapters';
import { Clock } from 'lucide-react';

export interface TimeInputProps {
  value: Time | string;
  onChange: (val: Time) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const initialStr = typeof value === 'object' && value ? value.time : String(value || '09:00');
  const [internalValue, setInternalValue] = useState(initialStr);

  useEffect(() => {
    const formatted = typeof value === 'object' && value ? value.time : String(value || '09:00');
    setInternalValue(formatted);
  }, [value]);

  const handleBlur = () => {
    const parsed = parseTime(internalValue);
    setInternalValue(parsed.time);
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalValue(val);
    if (/^\d{2}:\d{2}$/.test(val)) {
      onChange(parseTime(val));
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
        <Clock className="w-3.5 h-3.5" />
      </div>
      <input
        type="time"
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-beeline-yellow focus:ring-1 focus:ring-beeline-yellow transition-all disabled:opacity-50"
      />
    </div>
  );
};
