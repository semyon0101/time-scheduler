import React from 'react';

export interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="number"
        value={isNaN(value) ? '' : value}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          onChange(isNaN(num) ? 0 : num);
        }}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-slate-950/80 border border-slate-700/80 rounded-lg py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-beeline-yellow focus:ring-1 focus:ring-beeline-yellow transition-all disabled:opacity-50 px-3 ${
          suffix ? 'pr-12' : ''
        }`}
      />
      {suffix && (
        <span className="absolute right-3 text-xs text-slate-400 pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};
