import React from 'react';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  onBlur?: () => void;
}

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder,
  icon,
  disabled = false,
  required = false,
  id,
  className = '',
  onBlur,
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      {icon && (
        <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
          {icon}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onBlur={onBlur}
        className={`w-full bg-slate-950/80 border border-slate-700/80 rounded-lg py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-beeline-yellow focus:ring-1 focus:ring-beeline-yellow transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          icon ? 'pl-9 pr-3' : 'px-3'
        }`}
      />
    </div>
  );
};
