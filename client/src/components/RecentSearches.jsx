import React, { useState } from 'react';
import { History, X } from 'lucide-react';

const RecentSearches = ({ searches, onSelect, onClear }) => {
  if (searches.length === 0) return null;

  return (
    <div className="absolute top-full left-0 w-full bg-[color:var(--bg-elevated)] shadow-2xl rounded-b-xl border-t border-[color:var(--border-subtle)] overflow-hidden animate-slideDown z-50">
      <div className="p-2 bg-[color:var(--bg-subtle)] flex justify-between items-center border-b border-[color:var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--text-muted)] ml-2">
          <History size={14} />
          Búsquedas recientes
        </div>
        <button
          onClick={onClear}
          className="text-[10px] font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1 px-2"
        >
          <X size={12} /> Borrar todo
        </button>
      </div>
      <div className="py-2">
        {searches.map((term, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(term)}
            className="w-full px-4 py-2.5 text-left text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-colors flex items-center gap-3 group"
          >
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full group-hover:bg-primary transition-colors" />
            {term}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentSearches;
