import React from 'react';
import { Check } from 'lucide-react';

export interface TagOption {
  label: string;
  value: string;
}

export interface TagMultiSelectProps {
  options: TagOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export const TagMultiSelect: React.FC<TagMultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
  className = '',
}) => {
  const toggleTag = (val: string) => {
    if (disabled) return;
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => {
        const isSelected = selectedValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleTag(opt.value)}
            disabled={disabled}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-beeline-yellow text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
