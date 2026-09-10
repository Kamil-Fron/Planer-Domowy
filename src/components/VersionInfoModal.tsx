import React from 'react';
import {
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  User,
  Layers,
  Heart,
  ShieldCheck,
  Smartphone,
  Receipt,
  Keyboard,
  Compass,
} from 'lucide-react';

interface VersionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionInfoModal: React.FC<VersionInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="version-info-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="version-info-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-info-title"
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-linear-to-r from-indigo-50 via-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 id="version-info-title" className="text-lg font-bold text-slate-900 tracking-tight">
                Projektowanie Doświadczeń (UX) & Informacje o Wersji
              </h2>
              <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                  Wersja v2.6.10
                </span>
                <span>•</span>
                <span>Deep Linking & Filter Fixes Edition</span>
              </div>
            </div>
          </div>
          <button
            id="version-info-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          {/* Author Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-100 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Autor Projektu
              </span>
              <h3 className="text-base font-extrabold text-slate-900">
                bobEKam
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Adres e-mail: <span className="font-semibold text-slate-700">bobEKam@gmail.com</span>
              </p>
            </div>
          </div>

          {/* UX Philosophy */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filozofia UX (User Experience Design) w aplikacji</span>
            </h4>
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs text-slate-600 leading-relaxed">
              <p>
                Aplikacja została zaprojektowana zgodnie ze współczesnymi standardami **User Experience (UX)** oraz psychologii poznawczej:
              </p>
              <ul className="space-y-2 list-none">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Prawo Hicka (Hick's Law):</strong> Redukcja czasu podejmowania decyzji poprzez zminimalizowanie kroków do kluczowego celu – dodania transakcji w zaledwie 3 sekundy.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Prawo Fittsa (Fitts's Law):</strong> Główny przycisk szybkiej akcji (FAB) umieszczono w strefie naturalnego zasięgu kciuka (dolny prawy róg), bez potrzeby sięgania na górę ekranu.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Zasada Natychmiastowego Sprzężenia (Feedback):</strong> Każde dodanie lub usunięcie generuje czytelne powiadomienie toast z przyciskiem <em>„Cofnij” (Undo)</em>, co eliminuje stres przed pomyłką.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Dostępność i Ergonomia (Keyboard First):</strong> Klawisz <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded-md font-mono text-[11px] shadow-2xs">+</kbd> lub <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded-md font-mono text-[11px] shadow-2xs">N</kbd> natychmiast wywołuje formularz na komputerze.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Version Changelog v2.6.0 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Opis Wersji: v2.6.10 (Poprawki Nawigacji, Powiadomień i Szybkich Zakupów)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div className="flex items-center space-x-2 mb-1.5 font-bold text-slate-900 text-xs">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Szybki Wpis: Czysty Tytuł & Kategoria</span>
                </div>
                <p className="text-xs text-slate-600">
                  Uproszczony do maksimum formularz szybkiego dodawania artykułów (tylko nazwa i kategoria, bez ilości czy cen). Wszelkie szczegóły wpisujemy w tytule!
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div className="flex items-center space-x-2 mb-1.5 font-bold text-slate-900 text-xs">
                  <Compass className="w-4 h-4 text-indigo-500" />
                  <span>Powiadomienia Przenoszą do Celu</span>
                </div>
                <p className="text-xs text-slate-600">
                  Kliknięcie w alert o rachunku otwiera okno jego opłacenia, powiadomienia budżetowe kierują do limitów, a powiadomienia o aktywności do właściwych sekcji.
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div className="flex items-center space-x-2 mb-1.5 font-bold text-slate-900 text-xs">
                  <Receipt className="w-4 h-4 text-emerald-500" />
                  <span>Pulpit: Filtry Wpłat & Wydatków</span>
                </div>
                <p className="text-xs text-slate-600">
                  Kliknięcie w „Wpływy & dochody” lub „Wydatki łączne” na pulpicie natychmiast przenosi do transakcji z aktywowanym filtrem odpowiedniego typu.
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div className="flex items-center space-x-2 mb-1.5 font-bold text-slate-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span>Kupione Listy Zakupów na Pulpicie</span>
                </div>
                <p className="text-xs text-slate-600">
                  Kliknięcie w listę z pulpitu, w której wszystko zostało kupione, przełącza widok list zakupów prosto na zakładkę „Kupione” z aktywnym filtrem kategorii.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Autor: <strong className="text-slate-600">bobEKam</strong> (bobEKam@gmail.com)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Rozumiem, zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
