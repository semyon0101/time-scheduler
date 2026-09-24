import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectFieldProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none bg-slate-950/80 border border-slate-700/80 rounded-lg py-2 pl-3 pr-8 text-xs text-white focus:outline-none focus:border-beeline-yellow focus:ring-1 focus:ring-beeline-yellow transition-all disabled:opacity-50 cursor-pointer"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-2.5 text-slate-400 pointer-events-none flex items-center">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};
