import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  UserPlus,
  RefreshCw,
  Home,
  LogOut,
  LogIn,
  AlertTriangle,
  Flame,
  Smartphone,
  Database,
  ArrowRight,
  Trash2,
  CheckSquare,
  Square,
  DollarSign,
  Calendar,
  Layers,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';
import {
  Household,
  UserProfile,
  Transaction,
  Bill,
  BudgetLimit,
  ShoppingList,
  ShoppingItem,
} from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  getActiveFirebaseConfig,
  saveActiveFirebaseConfig,
  clearActiveFirebaseConfig,
  isFirebaseConfigured,
  loginWithGoogleFirebase,
  logoutFromFirebase,
  defaultFirebaseConfig,
} from '../firebase';
import { DeleteSelection } from './DeleteDataModal';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  household: Household | null;
  initialTab?: 'household' | 'firebase_config' | 'pwa' | 'delete_data';
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onCreateHousehold: (name: string) => Promise<void> | void;
  onJoinHousehold: (code: string) => Promise<{ success: boolean; message?: string }> | void;
  onLeaveHousehold?: () => Promise<void> | void;
  onInviteMember: (email: string, name: string) => void;
  onRemoveMember: (id: string) => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
  // Data for selective delete
  transactions?: Transaction[];
  bills?: Bill[];
  budgetLimits?: BudgetLimit[];
  shoppingLists?: ShoppingList[];
  shoppingItems?: ShoppingItem[];
  onDeleteSelectedData?: (selection: DeleteSelection) => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  household,
  initialTab = 'household',
  onLoginSuccess,
  onLogout,
  onCreateHousehold,
  onJoinHousehold,
  onLeaveHousehold,
  onInviteMember,
  onRemoveMember,
  onTriggerSync,
  isSyncing = false,
  transactions = [],
  bills = [],
  budgetLimits = [],
  shoppingLists = [],
  shoppingItems = [],
  onDeleteSelectedData,
}) => {
  const [householdNameInput, setHouseholdNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'household' | 'firebase_config' | 'pwa' | 'delete_data'>(initialTab);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Firebase Config Form State
  const [firebaseConfigForm, setFirebaseConfigForm] = useState(getActiveFirebaseConfig());
  const [rawConfigText, setRawConfigText] = useState('');
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [isConfigured, setIsConfigured] = useState(isFirebaseConfigured());

  // Delete Data Tab State
  const [deleteSelection, setDeleteSelection] = useState<DeleteSelection>({
    transactions: true,
    bills: true,
    budgetLimits: false,
    shopping: true,
    household: false,
  });
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    if (isOpen) {
      setFirebaseConfigForm(getActiveFirebaseConfig());
      setIsConfigured(isFirebaseConfigured());
      setAuthError(null);
      setUnauthorizedDomain(null);
      setJoinError(null);
      setActiveTab(initialTab);
      setDeleteConfirmStep(false);
      setDeleteSuccess(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyDomain = () => {
    if (!unauthorizedDomain) return;
    navigator.clipboard.writeText(unauthorizedDomain);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handleCreateHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdNameInput.trim()) return;
    setCreateLoading(true);
    try {
      await onCreateHousehold(householdNameInput.trim());
      setHouseholdNameInput('');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const res = await onJoinHousehold(joinCodeInput.trim().toUpperCase());
      if (res && typeof res === 'object' && res.success === false) {
        setJoinError(res.message || 'Nie udało się dołączyć do domu.');
      } else {
        setJoinCodeInput('');
      }
    } catch (err: any) {
      setJoinError(err?.message || 'Błąd podczas łączenia z domem.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteName.trim() || inviteEmail.split('@')[0]);
    setInviteEmail('');
    setInviteName('');
  };

  const handleGoogleLoginClick = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setUnauthorizedDomain(null);
    try {
      if (!isConfigured) {
        setActiveTab('firebase_config');
        setAuthError(
          'Najpierw wklej konfigurację Firebase (firebaseConfig) w zakładce poniżej.'
        );
        setAuthLoading(false);
        return;
      }
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
        setAuthError(text);
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await logoutFromFirebase();
      onLogout();
    } catch (err) {
      console.error('Błąd wylogowania:', err);
      onLogout();
    }
  };

  // Helper to parse pasted Firebase config object snippet
  const handleParseRawConfig = (text: string) => {
    setRawConfigText(text);
    try {
      const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
      const authDomainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
      const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);
      const storageBucketMatch = text.match(/storageBucket:\s*["']([^"']+)["']/);
      const messagingSenderIdMatch = text.match(/messagingSenderId:\s*["']([^"']+)["']/);
      const appIdMatch = text.match(/appId:\s*["']([^"']+)["']/);

      if (apiKeyMatch || projectIdMatch) {
        setFirebaseConfigForm({
          apiKey: apiKeyMatch ? apiKeyMatch[1] : firebaseConfigForm.apiKey,
          authDomain: authDomainMatch ? authDomainMatch[1] : firebaseConfigForm.authDomain,
          projectId: projectIdMatch ? projectIdMatch[1] : firebaseConfigForm.projectId,
          storageBucket: storageBucketMatch ? storageBucketMatch[1] : firebaseConfigForm.storageBucket,
          messagingSenderId: messagingSenderIdMatch
            ? messagingSenderIdMatch[1]
            : firebaseConfigForm.messagingSenderId,
          appId: appIdMatch ? appIdMatch[1] : firebaseConfigForm.appId,
        });
      }
    } catch (e) {
      console.warn('Nie udało się automatycznie sparsować tekstu', e);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveActiveFirebaseConfig(firebaseConfigForm);
    setIsConfigured(isFirebaseConfigured());
    setConfigSaveSuccess(true);
    setAuthError(null);
    setTimeout(() => {
      setConfigSaveSuccess(false);
    }, 3000);
  };

  const handleResetConfig = () => {
    clearActiveFirebaseConfig();
    setFirebaseConfigForm(defaultFirebaseConfig);
    setIsConfigured(isFirebaseConfigured());
  };

  // Handle selective deletion execution
  const selectedCount = Object.values(deleteSelection).filter(Boolean).length;
  const toggleAllDelete = (val: boolean) => {
    setDeleteSelection({
      transactions: val,
      bills: val,
      budgetLimits: val,
      shopping: val,
      household: val,
    });
  };

  const handleExecuteDelete = () => {
    if (onDeleteSelectedData) {
      onDeleteSelectedData(deleteSelection);
      setDeleteSuccess(true);
      setTimeout(() => {
        setDeleteSuccess(false);
        setDeleteConfirmStep(false);
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold">Konto & Ustawienia</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Firebase Auth & Firestore
                </span>
              </div>
              <p className="text-xs text-slate-300">Zarządzanie domem, chmurą i danymi</p>
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
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 sm:px-4 pt-2 gap-1 sm:gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('household')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'household'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Domownicy</span>
          </button>

          <button
            onClick={() => setActiveTab('firebase_config')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'firebase_config'
                ? 'border-amber-600 text-amber-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Konfiguracja</span>
            {!isConfigured && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('delete_data')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'delete_data'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-rose-600'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Usuń dane</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Telefon (PWA)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* TAB 1: HOUSEHOLD & AUTH */}
          {activeTab === 'household' && (
            <>
              {/* Profile Card / Individual Login State */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full border-2 border-indigo-200 shadow-xs object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {currentUser.name && currentUser.name !== 'Gość'
                          ? currentUser.name.charAt(0).toUpperCase()
                          : 'G'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-slate-900">
                          {currentUser.isLoggedIn ? currentUser.name : 'Niezalogowany (Gość)'}
                        </p>
                        {currentUser.isLoggedIn ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm">
                            Konto Google
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.5 rounded-sm">
                            Tryb lokalny
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {currentUser.isLoggedIn
                          ? currentUser.email
                          : 'Zaloguj się swoim kontem, aby mieć własny profil'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {currentUser.isLoggedIn ? (
                      <button
                        onClick={handleLogoutClick}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Wyloguj</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleGoogleLoginClick}
                        disabled={authLoading}
                        className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{authLoading ? 'Logowanie...' : 'Zaloguj przez Google'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {!currentUser.isLoggedIn && (
                  <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs rounded-xl">
                    <p className="font-semibold flex items-center space-x-1.5">
                      <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Każdy użytkownik loguje się osobno</span>
                    </p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Zaloguj się swoim adresem Google. Dzięki temu Twoje dane są bezpiecznie oddzielone od innych, a do wspólnego gospodarstwa domowego dołączasz za pomocą unikalnego kodu.
                    </p>
                  </div>
                )}

                {/* Auth Error Banner with Domain Helper */}
                {authError && (
                  <div className="mt-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl space-y-2">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-bold">{unauthorizedDomain ? 'Wymagana autoryzacja domeny w Firebase' : 'Błąd uwierzytelniania'}</p>
                        <p className="text-[11px] mt-0.5 text-rose-800">{authError}</p>
                      </div>
                    </div>

                    {unauthorizedDomain && (
                      <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold">Domena:</span>
                          <div className="flex items-center space-x-1">
                            <code className="px-2 py-0.5 bg-slate-100 font-mono text-[11px] text-indigo-700 rounded font-bold">
                              {unauthorizedDomain}
                            </code>
                            <button
                              onClick={handleCopyDomain}
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                              title="Kopiuj domenę"
                            >
                              {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Dodaj tę domenę w Firebase Console ➔ Authentication ➔ Settings ➔ sekcja <strong>Authorized domains</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status bazy Firestore */}
              <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-xl ${isConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-slate-900">Chmura Firestore:</span>
                      {isConfigured ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Połączono</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                          Wymaga konfiguracji
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {isConfigured
                        ? 'Wydatki i listy zakupów synchronizują się w czasie rzeczywistym'
                        : 'Wklej dane w zakładce „Konfiguracja Firebase”, aby włączyć chmurę'}
                    </p>
                  </div>
                </div>

                {onTriggerSync && isConfigured && (
                  <button
                    onClick={onTriggerSync}
                    disabled={isSyncing}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors"
                    title="Wymuś synchronizację"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                )}
              </div>

              {/* Household Management */}
              {!household ? (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <Home className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-slate-900">Wybierz Gospodarstwo Domowe</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Stwórz nowy Dom dla swojej rodziny lub dołącz do istniejącego wpisując kod zaproszenia.
                    </p>
                  </div>

                  {joinError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Błąd łączenia z Domem</p>
                        <p className="text-[11px] mt-0.5 text-rose-700">{joinError}</p>
                      </div>
                    </div>
                  )}

                  {/* Option 1: Create Household */}
                  <form onSubmit={handleCreateHouseholdSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Home className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Opcja 1: Utwórz nowy Dom</span>
                    </h4>
                    <div>
                      <input
                        type="text"
                        required
                        value={householdNameInput}
                        onChange={(e) => setHouseholdNameInput(e.target.value)}
                        placeholder="np. Mieszkanie Warszawa, Dom Kowalskich..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>{createLoading ? 'Tworzenie...' : 'Utwórz i zostań Właścicielem'}</span>
                    </button>
                  </form>

                  {/* Option 2: Join by Code */}
                  <form onSubmit={handleJoinHouseholdSubmit} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Opcja 2: Dołącz do istniejącego Domu (wpisz kod)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Poproś partnera lub współlokatora o kod zaproszenia (np. DOM-1234-PL).
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value)}
                        placeholder="np. DOM-1234-PL"
                        className="flex-1 px-3.5 py-2 text-xs font-mono uppercase bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={joinLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs flex items-center space-x-1"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{joinLoading ? 'Szukanie...' : 'Dołącz'}</span>
                      </button>
                    </div>
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
                          <span>Wspólna baza Firestore aktywna</span>
                        </span>
                      </div>
                    </div>

                    {/* Invite Code Badge */}
                    <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
                      <div className="text-left">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Twój Kod Domu</span>
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
                      <span>Członkowie Domu ({household.members?.length || 1})</span>
                      <span className="text-[11px] text-indigo-600 font-normal">Współdzielony budżet</span>
                    </h4>

                    <div className="space-y-2">
                      {household.members?.map((member) => {
                        const isMe = member.id === currentUser.id || (currentUser.email && member.email === currentUser.email);
                        return (
                          <div
                            key={member.id}
                            className={`p-3 rounded-xl border flex items-center justify-between ${
                              isMe ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                                {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <p className="text-xs font-bold text-slate-900">{member.name}</p>
                                  {isMe && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-sm">
                                      Ty
                                    </span>
                                  )}
                                  {member.role === 'owner' ? (
                                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.2 rounded-sm">
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

                            {member.role !== 'owner' && !isMe && (
                              <button
                                onClick={() => onRemoveMember(member.id)}
                                className="text-xs text-rose-500 hover:text-rose-700 p-1"
                                title="Usuń z domu"
                              >
                                Usuń
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add / Invite Member Form */}
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                      <UserPlus className="w-4 h-4 text-indigo-600" />
                      <span>Zaproś nowego członka (podaj dane lub wyślij kod {household.inviteCode})</span>
                    </h4>

                    <form onSubmit={handleInviteSubmit} className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Email (np. partner@gmail.com)..."
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
                        <span>Dodaj domownika</span>
                      </button>
                    </form>
                  </div>

                  {/* Leave / Disconnect Household */}
                  {onLeaveHousehold && (
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="text-slate-500">Chcesz zmienić lub opuścić ten Dom?</span>
                      <button
                        onClick={onLeaveHousehold}
                        className="text-rose-600 hover:text-rose-700 font-semibold hover:underline"
                      >
                        Odłącz się od tego Domu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 2: FIREBASE CONFIGURATION */}
          {activeTab === 'firebase_config' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span>Połączenie z Google Firebase SDK (v9/modular)</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Aplikacja korzysta z modularnego <strong>Firebase SDK v9</strong> (Firebase Auth + Cloud Firestore).
                  Możesz wkleić dane swojego projektu z <strong>Firebase Console</strong> poniżej lub zaktualizować plik konfiguracyjny.
                </p>
              </div>

              {/* Quick Paste Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Szybkie wklejenie całego kodu (Snippet z Firebase Console):</span>
                  <span className="text-[11px] text-slate-400 font-normal">np. const firebaseConfig = {'{ ... }'};</span>
                </label>
                <textarea
                  rows={3}
                  value={rawConfigText}
                  onChange={(e) => handleParseRawConfig(e.target.value)}
                  placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "twoj-projekt.firebaseapp.com",\n  projectId: "twoj-projekt",\n  ...\n};`}
                  className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                />
              </div>

              {/* Individual Form Fields */}
              <form onSubmit={handleSaveConfig} className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      apiKey
                    </label>
                    <input
                      type="text"
                      required
                      value={firebaseConfigForm.apiKey}
                      onChange={(e) =>
                        setFirebaseConfigForm({ ...firebaseConfigForm, apiKey: e.target.value })
                      }
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      projectId
                    </label>
                    <input
                      type="text"
                      required
                      value={firebaseConfigForm.projectId}
                      onChange={(e) =>
                        setFirebaseConfigForm({ ...firebaseConfigForm, projectId: e.target.value })
                      }
                      placeholder="project-42971582045"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      authDomain
                    </label>
                    <input
                      type="text"
                      value={firebaseConfigForm.authDomain}
                      onChange={(e) =>
                        setFirebaseConfigForm({ ...firebaseConfigForm, authDomain: e.target.value })
                      }
                      placeholder="twoj-projekt.firebaseapp.com"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      storageBucket (opcjonalne)
                    </label>
                    <input
                      type="text"
                      value={firebaseConfigForm.storageBucket}
                      onChange={(e) =>
                        setFirebaseConfigForm({
                          ...firebaseConfigForm,
                          storageBucket: e.target.value,
                        })
                      }
                      placeholder="twoj-projekt.appspot.com"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      messagingSenderId
                    </label>
                    <input
                      type="text"
                      value={firebaseConfigForm.messagingSenderId}
                      onChange={(e) =>
                        setFirebaseConfigForm({
                          ...firebaseConfigForm,
                          messagingSenderId: e.target.value,
                        })
                      }
                      placeholder="42971582045"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      appId
                    </label>
                    <input
                      type="text"
                      value={firebaseConfigForm.appId}
                      onChange={(e) =>
                        setFirebaseConfigForm({ ...firebaseConfigForm, appId: e.target.value })
                      }
                      placeholder="1:42971582045:web:..."
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {configSaveSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Zapisano konfigurację Firebase! Baza jest teraz aktywna.</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetConfig}
                    className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Wyczyść konfigurację
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Zapisz konfigurację Firebase</span>
                  </button>
                </div>
              </form>

              {/* Quick Setup instructions */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-900">
                  📋 3 szybkie kroki w konsoli Firebase:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                  <li>
                    <strong>Firestore Database</strong>: W konsoli Firebase kliknij <em>Create database</em> -&gt; wybierz <em>Start in test mode</em> -&gt; <em>Create</em>.
                  </li>
                  <li>
                    <strong>Authentication</strong>: W sekcji <em>Build -&gt; Authentication</em> kliknij <em>Get started</em> -&gt; zakładka <em>Sign-in method</em> -&gt; włącz <strong>Google</strong>.
                  </li>
                  <li>
                    <strong>Web App Config</strong>: W <em>Project Settings</em> kliknij ikonę <strong>&lt;/&gt; (Web)</strong>, nazwij aplikację i skopiuj obiekt <code>firebaseConfig</code> do formularza powyżej.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: DELETE DATA (SELEKTYWNE USUWANIE DANYCH) */}
          {activeTab === 'delete_data' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-rose-900 font-bold text-sm">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Selektywne czyszczenie danych</span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Możesz wybrać, które kategorie danych chcesz wyczyścić z pamięci i bazy domowej.
                </p>
              </div>

              {deleteSuccess ? (
                <div className="py-6 text-center space-y-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in duration-150">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Zaznaczone dane zostały usunięte!</h3>
                  <p className="text-xs text-slate-500">Pamięć lokalna i baza domowa są zaktualizowane.</p>
                </div>
              ) : !deleteConfirmStep ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Wybierz co usunąć:
                    </span>
                    <div className="flex space-x-2 text-xs">
                      <button
                        onClick={() => toggleAllDelete(true)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Zaznacz wszystkie
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => toggleAllDelete(false)}
                        className="text-slate-500 hover:text-slate-700 font-semibold"
                      >
                        Odznacz
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Transakcje */}
                    <label
                      className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        deleteSelection.transactions
                          ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <div className="mt-0.5">
                          {deleteSelection.transactions ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-slate-700" />
                            <span className="text-xs font-bold text-slate-900">
                              Transakcje & Wydatki
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Wszystkie zarejestrowane transakcje i paragony
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {transactions.length} poz.
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={deleteSelection.transactions}
                        onChange={(e) =>
                          setDeleteSelection({ ...deleteSelection, transactions: e.target.checked })
                        }
                      />
                    </label>

                    {/* Rachunki */}
                    <label
                      className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        deleteSelection.bills
                          ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <div className="mt-0.5">
                          {deleteSelection.bills ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-700" />
                            <span className="text-xs font-bold text-slate-900">
                              Rachunki & Opłaty stałe
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Harmonogram rachunków i płatności
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {bills.length} poz.
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={deleteSelection.bills}
                        onChange={(e) =>
                          setDeleteSelection({ ...deleteSelection, bills: e.target.checked })
                        }
                      />
                    </label>

                    {/* Limity */}
                    <label
                      className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        deleteSelection.budgetLimits
                          ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <div className="mt-0.5">
                          {deleteSelection.budgetLimits ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-700" />
                            <span className="text-xs font-bold text-slate-900">
                              Limity budżetowe
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Ustawione limity wydatków dla kategorii
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {budgetLimits.length} poz.
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={deleteSelection.budgetLimits}
                        onChange={(e) =>
                          setDeleteSelection({ ...deleteSelection, budgetLimits: e.target.checked })
                        }
                      />
                    </label>

                    {/* Listy zakupów */}
                    <label
                      className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        deleteSelection.shopping
                          ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <div className="mt-0.5">
                          {deleteSelection.shopping ? (
                            <CheckSquare className="w-4 h-4 text-rose-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-slate-700" />
                            <span className="text-xs font-bold text-slate-900">
                              Listy zakupów & produkty
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Wszystkie listy i pozycje do kupienia
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {shoppingLists.length} list ({shoppingItems.length} prod.)
                      </span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={deleteSelection.shopping}
                        onChange={(e) =>
                          setDeleteSelection({ ...deleteSelection, shopping: e.target.checked })
                        }
                      />
                    </label>

                    {/* Gospodarstwo Domowe */}
                    {household && (
                      <label
                        className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          deleteSelection.household
                            ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <div className="mt-0.5">
                            {deleteSelection.household ? (
                              <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <Home className="w-3.5 h-3.5 text-slate-700" />
                              <span className="text-xs font-bold text-slate-900">
                                Odłącz powiązanie z Domem ({household.name})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Resetuje przypisanie do gospodarstwa domowego
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          1 dom
                        </span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={deleteSelection.household}
                          onChange={(e) =>
                            setDeleteSelection({ ...deleteSelection, household: e.target.checked })
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setDeleteConfirmStep(true)}
                      disabled={selectedCount === 0}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Usuń zaznaczone ({selectedCount})</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Confirm Step inside Tab */
                <div className="py-4 space-y-3.5 text-center bg-rose-50/50 p-4 rounded-2xl border border-rose-200">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Czy na pewno usunąć wybrane elementy?</h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                      Zaznaczono <strong>{selectedCount}</strong> kategorii do trwałego usunięcia. Tej operacji nie można cofnąć.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setDeleteConfirmStep(false)}
                      className="px-4 py-2 bg-white text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleExecuteDelete}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Potwierdzam usunięcie</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PWA MOBILE */}
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
