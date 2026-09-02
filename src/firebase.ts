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
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import {
  Bill,
  BudgetLimit,
  Household,
  ShoppingItem,
  ShoppingList,
  Transaction,
  UserProfile,
} from './types';

/**
 * =========================================================================
 * 🔑 KONFIGURACJA GOOGLE FIREBASE (v9/v10/v11 Modular SDK)
 * =========================================================================
 * Tutaj możesz wkleić swoje dane z Firebase Console:
 * Firebase Console -> Project Settings -> General -> Twoje aplikacje -> Web App (</>)
 * =========================================================================
 */
export const defaultFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const LOCAL_CONFIG_KEY = 'budget_planner_custom_firebase_config_v1';

export function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed.apiKey) {
        return parsed;
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
    // Reinitialize or reload
  } catch (e) {
    console.error('Błąd zapisu konfiguracji Firebase', e);
  }
}

export function clearActiveFirebaseConfig() {
  localStorage.removeItem(LOCAL_CONFIG_KEY);
}

// Lazy / Safe initialization of Firebase
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
    firestoreDbInstance = getFirestore(app);
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

/**
 * Logowanie przez konto Google (Firebase Auth - Popup)
 */
export async function loginWithGoogleFirebase(): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error(
      'Firebase nie jest jeszcze skonfigurowany. Wklej dane firebaseConfig w zakładce konfiguracji.'
    );
  }

  const provider = getGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userProfile: UserProfile = {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Użytkownik',
    email: user.email || '',
    avatarUrl: user.photoURL || undefined,
    isLoggedIn: true,
  };

  return userProfile;
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
 * Struktura danych domu synchronizowanych w Firestore
 */
export interface HouseholdFirestoreData {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
  members: any[];
  transactions: Transaction[];
  bills: Bill[];
  budgetLimits: BudgetLimit[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
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

  try {
    const householdRef = doc(db, 'households', householdId);
    await setDoc(
      householdRef,
      {
        ...data,
        lastUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Błąd zapisu danych do Firestore:', error);
    throw error;
  }
}

/**
 * Nasłuchiwanie zmian w dokumencie Gospodarstwa Domowego (Realtime Snapshot)
 */
export function subscribeToHouseholdFirestore(
  householdId: string,
  onUpdate: (data: HouseholdFirestoreData) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db || !householdId) {
    return () => {};
  }

  const householdRef = doc(db, 'households', householdId);
  return onSnapshot(
    householdRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HouseholdFirestoreData;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Błąd odczytu w czasie rzeczywistym z Firestore:', err);
      if (onError) onError(err);
    }
  );
}
