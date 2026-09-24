import React from 'react';

export interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required = false,
  hint,
  error,
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300">
          {label}
          {required && <span className="text-rose-400 ml-1">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>

      {children}

      {error && <span className="text-[11px] text-rose-400 font-medium">{error}</span>}
    </div>
  );
};
