import React from 'react';
import { Sparkles, User, Info, Keyboard, ShieldCheck } from 'lucide-react';

interface AppFooterProps {
  onOpenVersionInfo: () => void;
  onOpenQuickAdd: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenVersionInfo, onOpenQuickAdd }) => {
  return (
    <footer className="w-full border-t border-slate-200 bg-white/80 backdrop-blur-md mt-12 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left side: App Name, Version & Author */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-center sm:text-left justify-center sm:justify-start">
          <span className="font-bold text-slate-800">
            Planer Budżetu Domowego
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <button
            onClick={onOpenVersionInfo}
            className="inline-flex items-center space-x-1 font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/60 transition-colors"
            title="Kliknij, aby zobaczyć opis wersji i założenia projektowania UX"
          >
            <Sparkles className="w-3 h-3" />
            <span>Wersja v2.7.0 (Inteligentne Propozycje 30D & Ergonomia)</span>
          </button>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="inline-flex items-center space-x-1 text-slate-600">
            <User className="w-3 h-3 text-slate-400" />
            <span>Autor: <strong className="text-slate-800 font-semibold">bobEKam</strong> (<span className="text-slate-500">bobEKam@gmail.com</span>)</span>
          </span>
        </div>

        {/* Right side: Keyboard Shortcut Hint & UX Info Button */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            <span>Naciśnij</span>
            <kbd className="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-700 font-bold shadow-2xs">+</kbd>
            <span>lub</span>
            <kbd className="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-[10px] text-slate-700 font-bold shadow-2xs">N</kbd>
            <span>by dodać</span>
          </div>

          <button
            onClick={onOpenVersionInfo}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 transition-colors font-medium text-xs shadow-2xs active:scale-95"
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>Opis wersji & UX</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
