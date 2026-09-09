import React from 'react';
import { Plus, Zap } from 'lucide-react';

interface QuickAddFABProps {
  onClick: () => void;
  isOpen: boolean;
}

export const QuickAddFAB: React.FC<QuickAddFABProps> = ({ onClick, isOpen }) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 group">
      <button
        id="global-quick-add-fab"
        onClick={onClick}
        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white pl-3.5 pr-4 py-3 rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 active:scale-95 border-2 border-white/20"
        title="Szybkie dodawanie wydatku lub wpływu (Skrót: + lub N)"
      >
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
        </div>
        <span className="font-bold text-xs tracking-tight select-none">
          Szybki wpis
        </span>
        <kbd className="hidden md:inline-block px-1.5 py-0.2 bg-white/20 rounded font-mono text-[10px] text-white/90 font-bold ml-0.5">
          +
        </kbd>
      </button>
    </div>
  );
};
