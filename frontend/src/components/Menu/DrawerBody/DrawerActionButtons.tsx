import React from 'react';
import { Trash2, XCircle, ShieldCheck, UserX, Sparkles } from 'lucide-react';

export interface DrawerActionButtonsProps {
  id: string;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onOpenExplanation?: (id: string) => void;
  isUnavailable?: boolean;
  isCancelled?: boolean;
  cancelLabel?: string;
  deleteLabel?: string;
  toggleStatusLabel?: string;
  explanationLabel?: string;
}

export const DrawerActionButtons: React.FC<DrawerActionButtonsProps> = ({
  id,
  onCancel,
  onDelete,
  onToggleStatus,
  onOpenExplanation,
  isUnavailable = false,
  isCancelled = false,
  cancelLabel = 'Отменить',
  deleteLabel = 'Удалить',
  toggleStatusLabel,
  explanationLabel = 'ИИ-анализ (XAI)',
}) => {
  return (
    <div className="space-y-2 pt-2 border-t border-slate-800">
      {onOpenExplanation && (
        <button
          type="button"
          onClick={() => onOpenExplanation(id)}
          className="w-full py-2 px-3 text-xs font-bold text-slate-900 bg-beeline-yellow hover:bg-yellow-400 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
          <span>{explanationLabel}</span>
        </button>
      )}

      <div className="flex items-center gap-2">
        {onToggleStatus && (
          <button
            type="button"
            onClick={() => onToggleStatus(id)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isUnavailable
                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80'
                : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80'
            }`}
          >
            {isUnavailable ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            <span>{toggleStatusLabel || (isUnavailable ? 'Вернуть на линию' : 'Сошел с линии')}</span>
          </button>
        )}

        {!isCancelled && onCancel && (
          <button
            type="button"
            onClick={() => onCancel(id)}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{cancelLabel}</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/60 hover:border-rose-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            title={deleteLabel}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleteLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
