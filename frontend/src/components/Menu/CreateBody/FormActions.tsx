import React from 'react';
import { Loader2 } from 'lucide-react';

export interface FormActionsProps {
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  submitLabel = 'Сохранить',
  cancelLabel = 'Отмена',
  onCancel,
  isLoading = false,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800 ${className}`}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      )}

      <button
        type="submit"
        disabled={disabled || isLoading}
        className="px-4 py-2 text-xs font-bold text-slate-950 bg-beeline-yellow hover:bg-yellow-400 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>{submitLabel}</span>
      </button>
    </div>
  );
};
