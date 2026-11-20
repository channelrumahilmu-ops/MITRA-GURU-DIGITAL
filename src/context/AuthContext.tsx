import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type { ApiKeySlots, UserProfile } from '../types';
import { loadApiKeysFromStorage } from '../utils/apiKeys';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  apiKeys: ApiKeySlots;
  setApiKeys: (keys: ApiKeySlots) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeySlots>(() => loadApiKeysFromStorage());

  const fetchUserProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const docPath = `users/${currentUser.uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, docPath);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        void fetchUserProfile(firebaseUser).catch((err) => {
          console.error(err);
        });
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchUserProfile]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchUserProfile(auth.currentUser);
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        profile,
        profileLoading,
        apiKeys,
        setApiKeys,
        signInWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return context;
}
