import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, User,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '@/utils/firebase';
import api from '@/utils/api';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isLead: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const res = await api.get('/auth/me');
          setProfile(res.data);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    // Mirrors the web app: register through the backend first (creates the
    // Firebase Auth user + a 'pending' Firestore profile), then sign in.
    await api.post('/auth/register', { email, password, displayName });
    await signInWithEmailAndPassword(auth, email, password);
  };

  // Sends a Firebase password-reset email. The link lets the user choose a
  // new password themselves — matches the web app's "Forgot password?" flow.
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const role = profile?.role ?? '';
  const isAdmin = role === 'Super Admin' || role === 'Operations Manager';
  const isLead  = role === 'Trek Lead';

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signup, resetPassword, logout, isAdmin, isLead }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
