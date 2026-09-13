import React, { useState } from 'react';
import { X, Star, Eye, EyeOff, Trash2, Check } from 'lucide-react';
import { ShoppingList } from '../types';

interface ListManagementModalProps {
  list: ShoppingList;
  itemCount: number;
  isTempHidden: boolean;
  onToggleSessionHide: (categoryName: string) => void;
  onClose: () => void;
  onUpdateList: (id: string, updates: Partial<ShoppingList>) => void;
  onDeleteList: (id: string) => void;
}

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#64748b', // Slate
];

export const ListManagementModal: React.FC<ListManagementModalProps> = ({
  list,
  itemCount,
  isTempHidden,
  onToggleSessionHide,
  onClose,
  onUpdateList,
  onDeleteList,
}) => {
  const [priority, setPriority] = useState<number>(list.priority ?? 0);
  const [color, setColor] = useState<string>(list.color || '#4f46e5');
  const [name, setName] = useState<string>(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdateList(list.id, {
      name: name.trim() || list.name,
      priority,
      color,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <span
              className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-slate-200"
              style={{ backgroundColor: color }}
            />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Zarządzaj listą zakupów
              </h3>
              <p className="text-xs text-slate-500">
                {list.name} • {itemCount} {itemCount === 1 ? 'pozycja' : 'pozycji'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Name */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Nazwa listy:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600 focus:bg-white"
          />
        </div>

        {/* PRIORITY SETTINGS (Simplified: 3 clean buttons, no move up/down) */}
        <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h4 className="text-xs font-bold text-slate-900">Priorytet listy</h4>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {priority > 0 ? 'Wysoki' : priority < 0 ? 'Niski' : 'Standardowy'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPriority(10)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                priority >= 10
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              ⭐ Wysoki
            </button>
            <button
              type="button"
              onClick={() => setPriority(0)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                priority === 0
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Standardowy
            </button>
            <button
              type="button"
              onClick={() => setPriority(-10)}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                priority <= -10
                  ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Niski
            </button>
          </div>
        </div>

        {/* TEMPORARY SESSION HIDE (Single-session only, grays out and moves to bottom) */}
        <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              {isTempHidden ? (
                <EyeOff className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <h4 className="text-xs font-bold text-slate-900">
                {isTempHidden ? 'Lista jest ukryta (szara na końcu)' : 'Widoczność w tej sesji'}
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {isTempHidden
                ? 'Lista i jej produkty są wyszarzone na samym końcu listy. Po odświeżeniu powrócą na swoje miejsce.'
                : 'Ukryj jednorazowo w tej sesji — produkty wyszarzeją i przejdą na koniec listy.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onToggleSessionHide(list.name)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer border ${
              isTempHidden
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
            }`}
          >
            {isTempHidden ? 'Odkryj listę' : 'Ukryj'}
          </button>
        </div>

        {/* Color Palette */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Kolor wyróżnienia:</label>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-xl shrink-0 transition-transform flex items-center justify-center cursor-pointer ${
                  color === c ? 'scale-110 ring-2 ring-indigo-600 ring-offset-2' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Delete List Option */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center space-x-1 p-1 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Usuń tę listę</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-rose-700">Na pewno usunąć?</span>
              <button
                type="button"
                onClick={() => onDeleteList(list.id)}
                className="px-2.5 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                Tak, usuń
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Anuluj
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
