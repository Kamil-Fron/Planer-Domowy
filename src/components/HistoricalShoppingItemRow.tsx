import React from 'react';
import { Calendar, RotateCcw, Pencil, Trash2, Tag } from 'lucide-react';
import { ShoppingItem } from '../types';

interface HistoricalShoppingItemRowProps {
  item: ShoppingItem;
  listColor: string;
  onRestore: (id: string, category: string) => void;
  onRequestDelete: (item: ShoppingItem) => void;
  onEdit: (item: ShoppingItem, e?: React.MouseEvent) => void;
}

/**
 * Format date nicely for the historical registry in Polish
 */
function formatRegistryDate(isoString?: string): { displayDate: string; displayTime?: string } {
  if (!isoString) {
    const today = new Date();
    return {
      displayDate: today.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { displayDate: isoString };
    }

    const displayDate = date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const displayTime = `${hours}:${minutes}`;

    return { displayDate, displayTime };
  } catch {
    return { displayDate: isoString };
  }
}

export const HistoricalShoppingItemRow: React.FC<HistoricalShoppingItemRowProps> = ({
  item,
  listColor,
  onRestore,
  onRequestDelete,
  onEdit,
}) => {
  const itemCategory = item.category || 'Spożywcze';
  const accentColor = listColor || '#10b981';
  const { displayDate, displayTime } = formatRegistryDate(item.completedAt || item.createdAt);

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
      {/* Left: Metadata and Name */}
      <div className="flex items-start sm:items-center space-x-3.5 min-w-0 flex-1">
        {/* Historical registry icon indicator */}
        <div className="p-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200/60 shrink-0 mt-0.5 sm:mt-0">
          <Calendar className="w-4 h-4 text-slate-600" />
        </div>

        {/* Content details */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date badge */}
            <span
              className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200"
              title={displayTime ? `Data wpisu: ${displayDate} o godz. ${displayTime}` : `Data wpisu: ${displayDate}`}
            >
              <span>{displayDate}</span>
              {displayTime && displayTime !== '00:00' && (
                <span className="text-slate-400 font-normal ml-0.5">• {displayTime}</span>
              )}
            </span>

            {/* Category badge */}
            <span
              className="inline-flex items-center space-x-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border bg-white shadow-2xs"
              style={{
                borderColor: `${accentColor}40`,
                color: '#1e293b',
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <Tag className="w-3 h-3 text-slate-400" />
              <span>{itemCategory}</span>
            </span>

            {/* Quantity if > 1 */}
            {item.quantity && item.quantity > 1 && (
              <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                {item.quantity} {item.unit || 'szt.'}
              </span>
            )}
          </div>

          {/* Product Name */}
          <div className="pt-0.5">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight">
              {item.name}
            </h4>
            {item.notes && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{item.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Direct 1-Click Action Buttons */}
      <div className="flex items-center justify-end space-x-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* 1. Uncheck / Restore button */}
        <button
          type="button"
          onClick={() => onRestore(item.id, itemCategory)}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Przywróć produkt do listy 'Do kupienia' (1 kliknięcie)"
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">Odznacz</span>
          <span className="sm:hidden">Przywróć</span>
        </button>

        {/* 2. Edit button */}
        <button
          type="button"
          onClick={(e) => onEdit(item, e)}
          className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Edytuj wpis rejestru (nazwa, kategoria, data)"
          aria-label="Edytuj"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* 3. Delete button with confirmation safeguard */}
        <button
          type="button"
          onClick={() => onRequestDelete(item)}
          className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Usuń wpis z rejestru (wymaga potwierdzenia)"
          aria-label="Usuń"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
