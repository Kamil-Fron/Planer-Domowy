import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';
import {
  Bill,
  BudgetLimit,
  Household,
  HouseholdMember,
  ShoppingItem,
  ShoppingList,
  Transaction,
  UserProfile,
  AppNotification,
} from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const auth = getFirebaseAuth();
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * =========================================================================
 * 🔑 KONFIGURACJA GOOGLE FIREBASE (v9/v10/v11 Modular SDK)
 * =========================================================================
 */
export const defaultFirebaseConfig = {
  apiKey: appletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: appletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: appletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: appletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: appletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: appletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: (appletConfig as any).firestoreDatabaseId || undefined,
};

const LOCAL_CONFIG_KEY = 'budget_planner_custom_firebase_config_v1';

export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed.apiKey) {
        return {
          ...defaultFirebaseConfig,
          ...parsed,
        };
      }
    }
  } catch (e) {
    console.warn('Nie udało się odczytać lokalnej konfiguracji Firebase', e);
  }
  return defaultFirebaseConfig;
}

export function saveActiveFirebaseConfig(config: typeof defaultFirebaseConfig) {
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Błąd zapisu konfiguracji Firebase', e);
  }
}

export function clearActiveFirebaseConfig() {
  localStorage.removeItem(LOCAL_CONFIG_KEY);
}

// Lazy initialization of Firebase
let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let firestoreDbInstance: Firestore | null = null;
let googleAuthProvider: GoogleAuthProvider | null = null;

export function isFirebaseConfigured(): boolean {
  const config = getActiveFirebaseConfig();
  return Boolean(config.apiKey && config.projectId && config.apiKey.trim().length > 5);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;

  try {
    if (!firebaseAppInstance) {
      const existingApps = getApps();
      const config = getActiveFirebaseConfig();
      if (existingApps.length > 0) {
        firebaseAppInstance = getApp();
      } else {
        firebaseAppInstance = initializeApp(config);
      }
    }
    return firebaseAppInstance;
  } catch (err) {
    console.error('Błąd inicjalizacji Firebase App:', err);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!firebaseAuthInstance) {
    firebaseAuthInstance = getAuth(app);
  }
  return firebaseAuthInstance;
}

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!firestoreDbInstance) {
    const config = getActiveFirebaseConfig();
    if (config.firestoreDatabaseId) {
      firestoreDbInstance = getFirestore(app, config.firestoreDatabaseId);
    } else {
      firestoreDbInstance = getFirestore(app);
    }
  }
  return firestoreDbInstance;
}

export function getGoogleProvider(): GoogleAuthProvider {
  if (!googleAuthProvider) {
    googleAuthProvider = new GoogleAuthProvider();
    googleAuthProvider.setCustomParameters({
      prompt: 'select_account',
    });
  }
  return googleAuthProvider;
}

// Startup connection verification
export async function testFirestoreConnection(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection successful!');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or connecting...');
    }
    return false;
  }
}

// Automatically test connection if configured
if (isFirebaseConfigured()) {
  testFirestoreConnection().catch(() => {});
}

/**
 * Logowanie przez konto Google (Firebase Auth - Popup)
 */
export async function loginWithGoogleFirebase(): Promise<UserProfile | null> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(
      'Firebase nie jest jeszcze skonfigurowany. Sprawdź konfigurację Firebase w oknie domu.'
    );
  }

  const provider = getGoogleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userProfile: UserProfile = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Użytkownik',
      email: user.email || '',
      avatarUrl: user.photoURL || undefined,
      isLoggedIn: true,
    };

    // Zapisz/zaktualizuj profil w Firestore
    await saveUserProfileToFirestore(userProfile);

    return userProfile;
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';

    // Zamknięcie okna popupu przez użytkownika to celowe anulowanie akcji
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMsg.includes('popup-closed-by-user') ||
      errorMsg.includes('cancelled-popup-request')
    ) {
      console.log('Logowanie Google zostało anulowane przez użytkownika (zamknięto okno).');
      return null;
    }

    if (errorCode === 'auth/popup-blocked') {
      throw new Error(
        'Okno logowania Google zostało zablokowane przez przeglądarkę. Zezwól na wyskakujące okna (pop-up) dla tej witryny.'
      );
    }

    if (
      errorCode === 'auth/unauthorized-domain' ||
      errorMsg.includes('unauthorized-domain') ||
      errorMsg.includes('authorized domain')
    ) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'twoja-domena.github.io';
      throw new Error(
        `UNAUTHORIZED_DOMAIN::${currentHost}::Bieżąca domena (${currentHost}) nie jest dodana do autoryzowanych domen w Twoim projekcie Firebase. Wejdź do Firebase Console -> Authentication -> Settings -> sekcja "Authorized domains" i dodaj domenę: ${currentHost}`
      );
    }

    if (errorCode === 'auth/operation-not-allowed') {
      throw new Error(
        'Logowanie przez konto Google nie jest włączone w Firebase. Włącz je w Firebase Console -> Authentication -> Sign-in method.'
      );
    }

    console.warn('Błąd Firebase Auth:', error);
    throw new Error(errorMsg || 'Wystąpił problem podczas logowania przez Google.');
  }
}

/**
 * Wylogowanie użytkownika z Firebase Auth
 */
export async function logoutFromFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Nasłuchiwanie zmian stanu logowania Firebase Auth
 */
export function subscribeToFirebaseAuthState(
  onUserChanged: (user: UserProfile | null) => void
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    return () => {};
  }

  const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (user) {
      onUserChanged({
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Użytkownik',
        email: user.email || '',
        avatarUrl: user.photoURL || undefined,
        isLoggedIn: true,
      });
    } else {
      onUserChanged(null);
    }
  });

  return unsubscribe;
}

/**
 * Recursively cleanses data to ensure no `undefined` values are passed to Firestore,
 * which would otherwise cause: "Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = sanitizeForFirestore(value);
    }
  }
  return result as T;
}

/**
 * Zapis profilu użytkownika w Firestore (/users/{userId})
 */
export async function saveUserProfileToFirestore(
  user: UserProfile,
  activeHouseholdId?: string
): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !user.id) return;

  const targetPath = `users/${user.id}`;
  try {
    const userRef = doc(db, 'users', user.id);
    const updatePayload: Record<string, any> = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      lastLoginAt: new Date().toISOString(),
    };
    if (activeHouseholdId !== undefined) {
      updatePayload.activeHouseholdId = activeHouseholdId;
    }
    await setDoc(userRef, sanitizeForFirestore(updatePayload), { merge: true });
  } catch (error) {
    console.warn('Błąd zapisu profilu użytkownika do Firestore:', error);
  }
}

/**
 * Pobranie profilu użytkownika z Firestore (/users/{userId})
 */
export async function getUserProfileFromFirestore(
  userId: string
): Promise<{ id: string; name?: string; email?: string; avatarUrl?: string; activeHouseholdId?: string } | null> {
  const db = getFirestoreDb();
  if (!db || !userId) return null;

  const targetPath = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as any;
    }
    return null;
  } catch (error) {
    console.warn('Błąd odczytu profilu użytkownika z Firestore:', error);
    return null;
  }
}

/**
 * Struktura danych domu synchronizowanych w Firestore
 */
export interface HouseholdFirestoreData {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
  members: HouseholdMember[];
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  notifications?: AppNotification[];
  lastUpdatedAt: string;
  lastUpdatedBy?: string;
}

/**
 * Zapisywanie danych domu do Firestore w czasie rzeczywistym
 */
export async function saveHouseholdToFirestore(
  householdId: string,
  data: Partial<HouseholdFirestoreData>
): Promise<void> {
  const db = getFirestoreDb();
  if (!db || !householdId) return;

  const targetPath = `households/${householdId}`;
  try {
    const householdRef = doc(db, 'households', householdId);
    const rawPayload = {
      ...data,
      lastUpdatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(householdRef, sanitizedPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

/**
 * Pobranie danych gospodarstwa domowego po ID
 */
export async function getHouseholdFromFirestore(
  householdId: string
): Promise<HouseholdFirestoreData | null> {
  const db = getFirestoreDb();
  if (!db || !householdId) return null;

  const targetPath = `households/${householdId}`;
  try {
    const householdRef = doc(db, 'households', householdId);
    const snap = await getDoc(householdRef);
    if (snap.exists()) {
      return snap.data() as HouseholdFirestoreData;
    }
    return null;
  } catch (error) {
    console.warn('Błąd pobierania domu:', error);
    return null;
  }
}

/**
 * Wyszukanie domu po kodzie zaproszenia (np. DOM-1234-PL, DOM-4681-PL lub 4681)
 */
export async function findHouseholdByInviteCode(
  code: string
): Promise<HouseholdFirestoreData | null> {
  const db = getFirestoreDb();
  if (!db || !code) return null;

  const cleanCode = code.trim().toUpperCase();
  const normalizedInput = cleanCode.replace(/[^A-Z0-9]/g, '');
  const targetPath = `households`;
  try {
    // 1. Bezpośrednie zapytanie indeksowane po kodzie
    const q = query(collection(db, 'households'), where('inviteCode', '==', cleanCode));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      return firstDoc.data() as HouseholdFirestoreData;
    }

    // 2. Elastyczne dopasowanie (np. jeśli użytkownik wpisał kod z myślnikami/bez myślników)
    const allHouseholdsSnap = await getDocs(collection(db, 'households'));
    for (const docSnap of allHouseholdsSnap.docs) {
      const data = docSnap.data() as HouseholdFirestoreData;
      if (data.inviteCode) {
        const docCode = data.inviteCode.trim().toUpperCase();
        const normalizedDocCode = docCode.replace(/[^A-Z0-9]/g, '');
        if (
          docCode === cleanCode ||
          normalizedDocCode === normalizedInput ||
          (normalizedInput.length >= 4 && normalizedDocCode.includes(normalizedInput)) ||
          (normalizedDocCode.length >= 4 && normalizedInput.includes(normalizedDocCode))
        ) {
          return data;
        }
      }
    }
    return null;
  } catch (error) {
    console.warn('Błąd wyszukiwania domu po kodzie:', error);
    handleFirestoreError(error, OperationType.LIST, targetPath);
    return null;
  }
}

/**
 * Wyszukanie gospodarstw domowych, do których użytkownik został zaproszony po adresie e-mail
 */
export async function findHouseholdsByMemberEmail(
  email: string
): Promise<HouseholdFirestoreData[]> {
  const db = getFirestoreDb();
  if (!db || !email) return [];

  const cleanEmail = email.trim().toLowerCase();
  const targetPath = `households`;
  try {
    const allHouseholdsSnap = await getDocs(collection(db, 'households'));
    const matched: HouseholdFirestoreData[] = [];
    for (const docSnap of allHouseholdsSnap.docs) {
      const data = docSnap.data() as HouseholdFirestoreData;
      if (data.members && Array.isArray(data.members)) {
        const isMember = data.members.some(
          (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
        );
        if (isMember) {
          matched.push(data);
        }
      }
    }
    return matched;
  } catch (error) {
    console.warn('Błąd wyszukiwania gospodarstw po adresie email:', error);
    return [];
  }
}

/**
 * Nasłuchiwanie zmian w dokumencie Gospodarstwa Domowego (Realtime Snapshot)
 */
export function subscribeToHouseholdFirestore(
  householdId: string,
  onUpdate: (data: HouseholdFirestoreData, hasPendingWrites?: boolean) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db || !householdId) {
    return () => {};
  }

  const targetPath = `households/${householdId}`;
  const householdRef = doc(db, 'households', householdId);
  return onSnapshot(
    householdRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HouseholdFirestoreData;
        onUpdate(data, snapshot.metadata.hasPendingWrites);
      }
    },
    (err) => {
      console.warn('Błąd odczytu w czasie rzeczywistym z Firestore:', err);
      if (onError) onError(err);
    }
  );
}
