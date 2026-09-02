import React, { useState } from 'react';
import {
  Home,
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  Smartphone,
  Cloud,
  LogOut,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  HelpCircle,
  X,
  Share2,
} from 'lucide-react';
import { Household, HouseholdMember, UserProfile } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  household: Household | null;
  onLoginWithGoogle: (email?: string, name?: string) => void;
  onLogout: () => void;
  onCreateHousehold: (name: string) => void;
  onInviteMember: (email: string, name: string) => void;
  onRemoveMember: (id: string) => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  household,
  onLoginWithGoogle,
  onLogout,
  onCreateHousehold,
  onInviteMember,
  onRemoveMember,
}) => {
  const [householdNameInput, setHouseholdNameInput] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginNameInput, setLoginNameInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'household' | 'pwa' | 'github_info'>('household');
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCreateHouseholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdNameInput.trim()) return;
    onCreateHousehold(householdNameInput.trim());
    setHouseholdNameInput('');
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteName.trim() || inviteEmail.split('@')[0]);
    setInviteEmail('');
    setInviteName('');
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailInput.trim()) return;
    onLoginWithGoogle(loginEmailInput.trim(), loginNameInput.trim() || loginEmailInput.split('@')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Dom & Synchronizacja Rodzinna</h2>
              <p className="text-xs text-slate-300">Wspólny budżet i listy zakupów dla całej rodziny</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('household')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'household'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Członkowie Domu</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Telefon (PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('github_info')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'github_info'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>GitHub Pages & Serwer</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {activeTab === 'household' && (
            <>
              {/* Profile Card / Login State */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-slate-900">{currentUser.name}</p>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-sm">
                          Zalogowany
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{currentUser.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Wyloguj"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Household Status or Creation */}
              {!household ? (
                <div className="space-y-4">
                  <div className="text-center py-3">
                    <Home className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-slate-900">Utwórz swój Dom</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Stwórz wspólne gospodarstwo domowe i zaproś partnera lub rodzinę do wspólnego zarządzania wydatkami i listą zakupów.
                    </p>
                  </div>

                  <form onSubmit={handleCreateHouseholdSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nazwa Gospodarstwa Domowego
                      </label>
                      <input
                        type="text"
                        required
                        value={householdNameInput}
                        onChange={(e) => setHouseholdNameInput(e.target.value)}
                        placeholder="np. Dom Kowalskich, Nasze Mieszkanie..."
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-xs"
                    >
                      Utwórz i włącz synchronizację
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Household Details */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Home className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-slate-900 text-sm">{household.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Synchronizacja w czasie rzeczywistym aktywna</span>
                        </span>
                      </div>
                    </div>

                    {/* Invite Code Badge */}
                    <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200">
                      <div className="text-left">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Kod Domu</span>
                        <span className="font-mono text-xs font-bold text-slate-800">{household.inviteCode}</span>
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        title="Kopiuj kod zaproszenia"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Members List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Członkowie Domu ({household.members.length})</span>
                      <span className="text-[11px] text-indigo-600 font-normal">Wspólny dostęp</span>
                    </h4>

                    <div className="space-y-2">
                      {household.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                <p className="text-xs font-bold text-slate-900">{member.name}</p>
                                {member.role === 'owner' ? (
                                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded-sm">
                                    Właściciel
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded-sm">
                                    Członek
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">{member.email}</p>
                            </div>
                          </div>

                          {member.role !== 'owner' && (
                            <button
                              onClick={() => onRemoveMember(member.id)}
                              className="text-xs text-rose-500 hover:text-rose-700 p-1"
                              title="Usuń z domu"
                            >
                              Usuń
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add / Invite Member Form */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                      <UserPlus className="w-4 h-4 text-indigo-600" />
                      <span>Zaproś kolejnego członka rodziny (przez Gmail)</span>
                    </h4>

                    <form onSubmit={handleInviteSubmit} className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Email (np. zona@gmail.com)..."
                          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                        />
                        <input
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Imię (np. Kasia)..."
                          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Dodaj członka do Domu</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <Smartphone className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-900">Aplikacja na Telefonie (PWA)</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Możesz zainstalować tę aplikację jako pełnoekranową aplikację na smartfonie bez sklepu Google Play / App Store.
                </p>
              </div>

              {/* Install Button & Status */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Status instalacji na urządzeniu:</span>
                  {isInstalled ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Zainstalowano jako PWA</span>
                    </span>
                  ) : (
                    <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      Wersja przeglądarkowa
                    </span>
                  )}
                </div>

                {isInstallable && !isInstalled && (
                  <button
                    onClick={install}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Zainstaluj aplikację na tym telefonie</span>
                  </button>
                )}

                {/* iPhone / iOS Guide */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>📱 Instrukcja instalacji na iPhone (Safari):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                    <li>Otwórz stronę w przeglądarce <strong>Safari</strong> na telefonie.</li>
                    <li>Dotknij przycisku <strong>Udostępnij (Share)</strong> na dolnym pasku (ikona kwadratu ze strzałką w górę).</li>
                    <li>Wybierz opcję <strong>„Do ekranu początkowego” (Add to Home Screen)</strong>.</li>
                    <li>Aplikacja pojawi się jako ikona obok innych aplikacji na telefonie.</li>
                  </ol>
                </div>

                {/* Android Guide */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <p className="font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>🤖 Instrukcja na telefony Android (Chrome):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                    <li>Otwórz stronę w <strong>Google Chrome</strong>.</li>
                    <li>Dotknij menu (trzy kropki w prawym górnym rogu).</li>
                    <li>Wybierz <strong>„Zainstaluj aplikację”</strong> lub <strong>„Dodaj do ekranu głównego”</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'github_info' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2.5">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <Cloud className="w-5 h-5 text-indigo-600" />
                  <span>Jak działa GitHub Pages a baza w chmurze?</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>GitHub Pages</strong> to darmowy hosting plików statycznych (HTML, JavaScript, grafika). <strong>Sam GitHub Pages nie posiada bazy danych ani serwera backendowego.</strong>
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>1. Tylko GitHub Pages (Pamięć lokalna localStorage)</span>
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Jeśli aplikacja działa tylko na GitHub Pages bez zewnętrznej bazy, dane zapisują się w pamięci danej przeglądarki. <strong>Wtedy drugi telefon lub inna przeglądarka nie widzi tych samych danych.</strong>
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/30 space-y-1.5">
                  <h4 className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>2. GitHub Pages + Firebase (Zalecane rozwiązanie!)</span>
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Strona może być hostowana na <strong>GitHub Pages</strong>, a dane i logowanie przez Gmail łączą się z darmową bazą <strong>Google Firebase (Firestore)</strong>. Wtedy Ty i członek rodziny logujecie się mailem i natychmiast macie dostęp do tego samego Domu z każdego telefonu i komputera!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
