import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  UserPlus,
  Home,
  LogOut,
  LogIn,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Household, UserProfile } from '../types';
import { loginWithGoogleFirebase, logoutFromFirebase } from '../firebase';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  household: Household | null;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onCreateHousehold: (name: string) => Promise<void> | void;
  onJoinHousehold: (code: string) => Promise<{ success: boolean; message?: string }> | void;
  onLeaveHousehold?: () => Promise<void> | void;
  onInviteMember: (email: string, name: string) => void;
  onRemoveMember: (id: string) => void;
  onApproveJoinRequest?: (requestId: string) => Promise<void> | void;
  onRejectJoinRequest?: (requestId: string) => Promise<void> | void;
  pendingJoinInfo?: { householdName: string; requestId: string } | null;
  onCancelPendingJoin?: () => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  household,
  onLoginSuccess,
  onLogout,
  onCreateHousehold,
  onJoinHousehold,
  onLeaveHousehold,
  onInviteMember,
  onRemoveMember,
  onApproveJoinRequest,
  onRejectJoinRequest,
  pendingJoinInfo,
  onCancelPendingJoin,
}) => {
  const [householdNameInput, setHouseholdNameInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccessMessage, setJoinSuccessMessage] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [creationMode, setCreationMode] = useState<'join' | 'create'>('create');

  const isHouseholdAdmin =
    !household ||
    !currentUser.isLoggedIn ||
    household.createdBy === currentUser.id ||
    household.members?.find((m) => m.id === currentUser.id)?.role === 'owner';

  useEffect(() => {
    if (isOpen) {
      setAuthError(null);
      setJoinError(null);
      setInviteSuccess(null);
      setJoinSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLoginClick = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const user = await loginWithGoogleFirebase();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Błąd logowania:', err);
      setAuthError(err?.message || 'Nie udało się zalogować przez Google.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    try {
      await logoutFromFirebase();
    } catch (e) {
      console.warn('Błąd wylogowania Firebase:', e);
    }
    onLogout();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdNameInput.trim()) return;
    try {
      setCreateLoading(true);
      await onCreateHousehold(householdNameInput.trim());
      setHouseholdNameInput('');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    try {
      setJoinLoading(true);
      setJoinError(null);
      setJoinSuccessMessage(null);
      const res = await onJoinHousehold(joinCodeInput.trim().toUpperCase());
      if (res && !res.success) {
        setJoinError(res.message || 'Nie znaleziono gospodarstwa o podanym kodzie.');
      } else {
        setJoinCodeInput('');
        if (res && res.message) {
          setJoinSuccessMessage(res.message);
        }
      }
    } catch (err: any) {
      setJoinError(err?.message || 'Błąd dołączania do gospodarstwa.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() && !inviteName.trim()) return;
    onInviteMember(inviteEmail.trim(), inviteName.trim());
    setInviteSuccess(`Wysłano zaproszenie dla ${inviteName || inviteEmail}`);
    setInviteEmail('');
    setInviteName('');
    setTimeout(() => setInviteSuccess(null), 3000);
  };

  const handleCopyCode = () => {
    if (household?.inviteCode) {
      navigator.clipboard.writeText(household.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Konto & Gospodarstwo Domowe</h2>
              <p className="text-xs text-slate-500">Zarządzaj profilem, domownikami i synchronizacją</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* 1. Profil użytkownika */}
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
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {currentUser.isLoggedIn ? currentUser.name : 'Niezalogowany (Gość)'}
                    </p>
                    {currentUser.isLoggedIn ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                        Konto Google
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.5 rounded-md">
                        Lokalnie
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {currentUser.isLoggedIn
                      ? currentUser.email
                      : 'Zaloguj się kontem Google, aby synchronizować z domem'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {currentUser.isLoggedIn ? (
                  <button
                    onClick={handleLogoutClick}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors font-semibold"
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

            {authError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p>{authError}</p>
              </div>
            )}
          </div>

          {/* 2. Gospodarstwo Domowe */}
          {household ? (
            <div className="space-y-4">
              {/* Informacja o gospodarstwie & Kod zaproszenia */}
              <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-indigo-950">{household.name}</h3>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                      Aktywne
                    </span>
                  </div>
                  <p className="text-xs text-indigo-700 mt-0.5">
                    Domownicy mają dostęp do wspólnych rachunków, list i wydatków.
                  </p>
                </div>

                {household.inviteCode && (
                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs self-start sm:self-auto">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                        Kod zaproszenia
                      </span>
                      <span className="font-mono font-bold text-sm tracking-widest text-indigo-700">
                        {household.inviteCode}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
                      title="Kopiuj kod zaproszenia"
                    >
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Lista Domowników */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Domownicy ({household.members?.length || 1})</span>
                  </h4>
                </div>

                <div className="space-y-2">
                  {household.members?.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.name}{' '}
                            {member.id === currentUser.id && (
                              <span className="text-[10px] text-indigo-600 font-normal">(Ty)</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{member.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {member.role === 'owner' ? 'Właściciel' : 'Domownik'}
                        </span>
                        {member.id !== currentUser.id && (
                          <button
                            onClick={() => onRemoveMember(member.id)}
                            className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition-colors"
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Oczekujące prośby o dołączenie do gospodarstwa (tylko dla Administratora) */}
              {isHouseholdAdmin && household.pendingRequests && household.pendingRequests.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                      <UserPlus className="w-4 h-4 text-amber-600" />
                      <span>Oczekujące prośby o dołączenie ({household.pendingRequests.length})</span>
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                      Wymaga zgody
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Nowe osoby dołączające kodem oczekują na Twoje zatwierdzenie zanim uzyskają dostęp do budżetu domowego.
                  </p>

                  <div className="space-y-2">
                    {household.pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {req.avatarUrl ? (
                            <img
                              src={req.avatarUrl}
                              alt={req.name}
                              className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                              {req.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{req.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{req.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {onApproveJoinRequest && (
                            <button
                              onClick={() => onApproveJoinRequest(req.id)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs"
                              title="Zatwierdź domownika"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Zatwierdź</span>
                            </button>
                          )}
                          {onRejectJoinRequest && (
                            <button
                              onClick={() => onRejectJoinRequest(req.id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors border border-rose-200"
                              title="Odrzuć prośbę"
                            >
                              Odrzuć
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informacja o uprawnieniach domowników */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Uprawnienia ról:</strong> Członkowie domu mogą wspólnie przeglądać i rejestrować wydatki, paragony oraz zakupy. Operacje zbiorczego usuwania danych z bazy oraz przywracania kopii zapasowych są zablokowane i zarezerwowane wyłącznie dla Administratora gospodarstwa.
                </p>
              </div>

              {/* Zaproś nowego domownika */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Zaproś domownika</span>
                </h4>
                <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Imię (np. Kasia)"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Adres e-mail"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs"
                  >
                    Dodaj
                  </button>
                </form>
                {inviteSuccess && (
                  <p className="text-xs text-emerald-600 font-semibold">{inviteSuccess}</p>
                )}
              </div>

              {/* Opuść gospodarstwo */}
              {onLeaveHousehold && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={onLeaveHousehold}
                    className="text-xs text-slate-400 hover:text-rose-600 font-medium transition-colors"
                  >
                    Opuść to gospodarstwo domowe
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Brak gospodarstwa - Utwórz lub Dołącz */
            <div className="space-y-4">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCreationMode('create')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    creationMode === 'create'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Utwórz gospodarstwo
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('join')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    creationMode === 'join'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dołącz kodem
                </button>
              </div>

              {creationMode === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nazwa gospodarstwa domowego
                    </label>
                    <input
                      type="text"
                      required
                      value={householdNameInput}
                      onChange={(e) => setHouseholdNameInput(e.target.value)}
                      placeholder="np. Mieszkanie Lipowa 4, Dom Rodzinny"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createLoading || !householdNameInput.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    {createLoading ? 'Tworzenie...' : 'Utwórz i wygeneruj kod zaproszenia'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  {pendingJoinInfo && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Oczekujesz na zatwierdzenie przez administratora</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Wysłano zgłoszenie do gospodarstwa: <strong>{pendingJoinInfo.householdName}</strong>. Administrator musi zaakceptować Twoją prośbę, aby udostępnić finanse.
                      </p>
                      {onCancelPendingJoin && (
                        <button
                          type="button"
                          onClick={onCancelPendingJoin}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline"
                        >
                          Anuluj wysłaną prośbę
                        </button>
                      )}
                    </div>
                  )}

                  {joinSuccessMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed">{joinSuccessMessage}</p>
                    </div>
                  )}

                  <form onSubmit={handleJoin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Wpisz 6-znakowy kod zaproszenia
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={joinCodeInput}
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                        placeholder="np. DOM123"
                        className="w-full px-3.5 py-2 font-mono uppercase tracking-widest text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {joinError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                        {joinError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={joinLoading || joinCodeInput.trim().length < 3}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                      {joinLoading ? 'Wysyłanie prośby...' : 'Wyślij prośbę o dołączenie'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Autor: <strong className="text-slate-700">bobEKam</strong> (bobEKam@gmail.com) • <span className="font-semibold text-indigo-600">v2.5.0</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
};
