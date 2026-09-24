import React from 'react';
import { Search, X } from 'lucide-react';
import { Tag } from '../../../types';
import { TagDisplay } from '../TagDisplay';

export interface TagGroup {
  title: string;
  tags: Tag[];
}

export interface SearchInputFieldProps {
  search: string;
  onSearchChange: (val: string) => void;
  placeholder?: string;
  foundCount?: number;
  tagGroups?: TagGroup[];
  availableTags?: Tag[];
  selectedTags?: Tag[];
  onToggleTag?: (tag: Tag) => void;
}

export const SearchInputField: React.FC<SearchInputFieldProps> = ({
  search,
  onSearchChange,
  placeholder = 'Поиск...',
  foundCount,
  tagGroups,
  availableTags = [],
  selectedTags = [],
  onToggleTag,
}) => {
  return (
    <div className="space-y-2.5 pb-2.5 border-b border-slate-800">
      {/* Top row: search bar and found count */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Очистить поиск"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {typeof foundCount === 'number' && (
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800 shrink-0">
            Найдено: <strong className="text-white">{foundCount}</strong>
          </span>
        )}
      </div>

      {/* Grouped Tag Filters with Category Headers */}
      {tagGroups && tagGroups.length > 0 && onToggleTag ? (
        <div className="space-y-2 pt-0.5">
          {tagGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}:
              </div>
              <div className="flex flex-wrap gap-1">
                {group.tags.map((tag, idx) => {
                  const isSelected = selectedTags.some(
                    (st) => st.kind === tag.kind && st.value === tag.value
                  );
                  return (
                    <div
                      key={idx}
                      className={`relative transition-all rounded ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 brightness-125'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <TagDisplay
                        tag={tag}
                        onClick={() => onToggleTag(tag)}
                        className="cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : availableTags.length > 0 && onToggleTag ? (
        /* Fallback flat tags list */
        <div className="flex flex-wrap gap-1 items-center pt-0.5">
          <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Теги:</span>
          {availableTags.map((tag, idx) => {
            const isSelected = selectedTags.some(
              (st) => st.kind === tag.kind && st.value === tag.value
            );
            return (
              <div
                key={idx}
                className={`relative transition-all rounded ${
                  isSelected ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <TagDisplay
                  tag={tag}
                  onClick={() => onToggleTag(tag)}
                  className="cursor-pointer"
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
