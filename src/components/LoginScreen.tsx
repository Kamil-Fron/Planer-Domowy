import React, { useState } from 'react';
import {
  Wallet,
  LogIn,
  AlertTriangle,
  Copy,
  Check,
  Flame,
  ShieldCheck,
  Receipt,
  ShoppingCart,
  Calendar,
  Users,
  Settings,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  isFirebaseConfigured,
  loginWithGoogleFirebase,
} from '../firebase';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onContinueAsGuest: () => void;
  onOpenFirebaseConfig: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  onOpenFirebaseConfig,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const isConfigured = isFirebaseConfigured();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setUnauthorizedDomain(null);

    if (!isConfigured) {
      setLoading(false);
      onOpenFirebaseConfig();
      setErrorMsg('Najpierw skonfiguruj projekt Firebase (wprowadź firebaseConfig).');
      return;
    }

    try {
      const user = await loginWithGoogleFirebase();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      const msg: string = err?.message || 'Wystąpił błąd podczas logowania przez Google.';
      if (msg.startsWith('UNAUTHORIZED_DOMAIN::')) {
        const parts = msg.split('::');
        const host = parts[1] || window.location.hostname;
        const text = parts[2] || 'Domena nie jest autoryzowana w Firebase.';
        setUnauthorizedDomain(host);
        setErrorMsg(text);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDomain = () => {
    if (!unauthorizedDomain) return;
    navigator.clipboard.writeText(unauthorizedDomain);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg text-white tracking-tight block">
              Planer Budżetu Domowego
            </span>
            <span className="text-[11px] text-slate-400">Wspólne finanse, rachunki & paragony AI</span>
          </div>
        </div>

        <button
          onClick={onOpenFirebaseConfig}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          title="Konfiguracja Firebase"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Konfiguracja Firebase</span>
          <Settings className="w-3.5 h-3.5 text-slate-400 sm:hidden" />
        </button>
      </header>

      {/* Main Login Hero & Gate */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col justify-center items-center relative z-10">
        <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/50 text-slate-900 animate-in fade-in zoom-in-95 duration-200">
          {/* Logo & Headline */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-3 shadow-xs">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Witaj w Planerze Domowym
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Zaloguj się swoim kontem Google, aby zarządzać domowym budżetem i synchronizować dane z rodziną.
            </p>
          </div>

          {/* Error & Unauthorized Domain Banner */}
          {errorMsg && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-rose-900">
                    {unauthorizedDomain ? 'Wymagana autoryzacja domeny w Firebase' : 'Błąd logowania'}
                  </p>
                  <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              </div>

              {/* Action for GitHub Pages domain fix */}
              {unauthorizedDomain && (
                <div className="bg-white/90 p-3 rounded-xl border border-rose-200 space-y-2 text-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700">Domena do dodania:</span>
                    <div className="flex items-center space-x-1.5">
                      <code className="px-2 py-1 bg-slate-100 rounded-md font-mono text-[11px] font-bold text-indigo-700 select-all">
                        {unauthorizedDomain}
                      </code>
                      <button
                        onClick={handleCopyDomain}
                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                        title="Kopiuj nazwę domeny"
                      >
                        {copiedDomain ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                    <p className="font-semibold text-slate-800">👉 Jak naprawić błąd na GitHub Pages / innej domenie:</p>
                    <ol className="list-decimal list-inside space-y-0.5 pl-0.5 text-slate-600">
                      <li>Otwórz <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-2.5 h-2.5" /></a></li>
                      <li>Wejdź w <strong>Authentication</strong> ➔ zakładka <strong>Settings</strong></li>
                      <li>Przejdź do sekcji <strong>Authorized domains</strong> ➔ kliknij <strong>Add domain</strong></li>
                      <li>Wklej skopiowaną domenę: <strong>{unauthorizedDomain}</strong> i zapisz.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Login Actions */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-75"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              <span>{loading ? 'Logowanie przez Google...' : 'Zaloguj się przez konto Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                lub
              </span>
            </div>

            <button
              onClick={onContinueAsGuest}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition-colors flex items-center justify-center space-x-2"
            >
              <span>Wypróbuj w trybie Gościa (Offline / Lokalnie)</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-900">Wspólny Dom</p>
                <p className="text-[10px] text-slate-500">Współdzielenie budżetu z partnerem</p>
              </div>
            </div>

            <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <Receipt className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-900">Skaner Paragonów</p>
                <p className="text-[10px] text-slate-500">Automatyczny odczyt pozycji</p>
              </div>
            </div>

            <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-900">Terminy Rachunków</p>
                <p className="text-[10px] text-slate-500">Powiadomienia o płatnościach</p>
              </div>
            </div>

            <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <ShoppingCart className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-900">Listy Zakupów</p>
                <p className="text-[10px] text-slate-500">Odznaczanie w czasie rzeczywistym</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-[11px] text-slate-500 relative z-10">
        Planer Budżetu Domowego &copy; 2026 &bull; Bezpieczne szyfrowanie w Google Firebase
      </footer>
    </div>
  );
};
