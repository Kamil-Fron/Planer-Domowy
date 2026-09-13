import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Pencil, Trash2, EyeOff } from 'lucide-react';
import { ShoppingItem } from '../types';

interface SwipeableShoppingItemRowProps {
  item: ShoppingItem;
  listColor: string;
  isTempHidden?: boolean;
  onToggle: (id: string, category: string) => void;
  onRequestDelete: (item: ShoppingItem) => void;
  onEdit: (item: ShoppingItem, e?: React.MouseEvent) => void;
}

/**
 * Mathematically blends a hex color with #ffffff at ~4.5% opacity,
 * creating an ultra-soft, 100% opaque watercolor wash.
 * Because it is 100% opaque, the red/indigo swipe actions underneath
 * NEVER bleed or shine through until physically dragged by the user.
 */
function getSoftCardBackground(hex: string): string {
  try {
    const cleanHex = (hex || '#4f46e5').replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
    const bgR = Math.round(255 * 0.955 + r * 0.045);
    const bgG = Math.round(255 * 0.955 + g * 0.045);
    const bgB = Math.round(255 * 0.955 + b * 0.045);
    return `rgb(${bgR}, ${bgG}, ${bgB})`;
  } catch {
    return '#ffffff';
  }
}

export const SwipeableShoppingItemRow: React.FC<SwipeableShoppingItemRowProps> = ({
  item,
  listColor,
  isTempHidden = false,
  onToggle,
  onRequestDelete,
  onEdit,
}) => {
  const itemCategory = item.category || 'Spożywcze';
  const accentColor = listColor || '#4f46e5';

  const cardBg = item.isCompleted
    ? '#f8fafc'
    : isTempHidden
    ? '#f1f5f9'
    : getSoftCardBackground(accentColor);

  const borderAccent = item.isCompleted
    ? '#cbd5e1'
    : isTempHidden
    ? '#94a3b8'
    : accentColor;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none group shadow-2xs transition-all ${
        isTempHidden ? 'opacity-40 grayscale hover:opacity-75' : ''
      }`}
    >
      {/* Background Actions Revealed ONLY on Swipe */}
      {/* Swipe Right -> EDIT (Indigo) */}
      <div className="absolute inset-y-0 left-0 w-full bg-indigo-600 flex items-center justify-start pl-5 space-x-2 text-white z-0 pointer-events-none">
        <Pencil className="w-5 h-5 text-white" />
        <span className="text-xs font-bold uppercase tracking-wider">Edytuj</span>
      </div>

      {/* Swipe Left -> DELETE (Rose/Red) */}
      <div className="absolute inset-y-0 right-0 w-full bg-rose-600 flex items-center justify-end pr-5 space-x-2 text-white z-0 pointer-events-none">
        <span className="text-xs font-bold uppercase tracking-wider">Usuń</span>
        <Trash2 className="w-5 h-5 text-white" />
      </div>

      {/* Foreground Draggable Card (Opaque background prevents any bleed-through) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.45}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) {
            onRequestDelete(item);
          } else if (info.offset.x > 70) {
            onEdit(item);
          }
        }}
        onClick={() => onToggle(item.id, itemCategory)}
        style={{
          backgroundColor: cardBg,
          borderLeft: `4px solid ${borderAccent}`,
        }}
        className={`relative z-10 px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 border border-slate-200/80 border-l-0 cursor-pointer transition-colors active:opacity-95 ${
          item.isCompleted ? 'hover:bg-slate-100/70' : 'hover:brightness-[0.98]'
        }`}
      >
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          {/* Checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e?.stopPropagation?.();
              onToggle(item.id, itemCategory);
            }}
            className="p-1 -m-1 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
            title={item.isCompleted ? 'Oznacz jako niekupione' : 'Oznacz jako kupione'}
          >
            {item.isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-100" />
            ) : (
              <Circle className="w-6 h-6 text-slate-300 hover:text-slate-400" />
            )}
          </button>

          {/* Product Name (Clean, large legible font, no duplicate list badge) */}
          <div className="flex items-center space-x-2.5 min-w-0 flex-1 truncate">
            <span
              className={`text-base sm:text-lg font-bold sm:font-semibold transition-all truncate tracking-tight ${
                item.isCompleted
                  ? 'line-through text-slate-400 font-medium'
                  : 'text-slate-900'
              }`}
            >
              {item.name}
            </span>

            {/* Hidden marker badge if category is temporarily hidden */}
            {isTempHidden && (
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                <EyeOff className="w-3 h-3" />
                <span className="hidden sm:inline">Ukryta</span>
              </span>
            )}

            {/* Quantity if > 1 */}
            {item.quantity && item.quantity > 1 && (
              <span className="text-xs sm:text-sm font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs shrink-0">
                {item.quantity} {item.unit || 'szt.'}
              </span>
            )}
          </div>
        </div>

        {/* Quick Action Buttons (Pencil & Trashcan): HIDDEN on mobile (sm:flex only), visible on desktop */}
        <div className="hidden sm:flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e?.stopPropagation?.();
              onEdit(item, e);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white transition-colors rounded-lg cursor-pointer"
            title="Edytuj pozycję"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e?.stopPropagation?.();
              onRequestDelete(item);
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white transition-colors rounded-lg cursor-pointer"
            title="Usuń pozycję"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
