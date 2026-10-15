import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { App } from '@capacitor/app';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, AUTH_STORAGE_KEY } from './supabase';
import { readCachedSessionUser, releaseUserData } from './offline';
import type { Profile } from './types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    setProfile(data as Profile | null);
    return data as Profile | null;
  }

  useEffect(() => {
    let mounted = true;

    const deepLinkListener = App.addListener('appUrlOpen', async ({ url }) => {
      try {
        const callbackUrl = new URL(url);

        if (callbackUrl.protocol !== 'com.femcare.app:' ||
            callbackUrl.hostname !== 'login-callback') {
          return;
        }

        const code = callbackUrl.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error('Email confirmation callback failed:', error.message);
        } else {
          const hash = callbackUrl.hash.startsWith('#')
            ? callbackUrl.hash.substring(1)
            : callbackUrl.hash;
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) console.error('Email confirmation callback failed:', error.message);
          } else {
            console.error('Email confirmation callback did not contain a session code or tokens.');
          }
        }
      } catch (error) {
        console.error('Unable to process email confirmation callback:', error);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Offline start: an expired login token cannot be refreshed without internet, so fall back
      // to the user stored on this device. Data still comes from the local copy.
      const cachedUser = session ? null : readCachedSessionUser<User>(AUTH_STORAGE_KEY);
      const activeUser = session?.user ?? cachedUser;
      setUser(activeUser ?? null);
      if (activeUser) {
        fetchProfile(activeUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Keep the stored user when the app starts offline with an expired token (not on real sign-out).
      const cachedUser = !newSession && event !== 'SIGNED_OUT' ? readCachedSessionUser<User>(AUTH_STORAGE_KEY) : null;
      const activeUser = newSession?.user ?? cachedUser;
      setUser(activeUser ?? null);
      if (activeUser) {
        (async () => {
          await fetchProfile(activeUser.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      void deepLinkListener.then(listener => listener.remove());
    };
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: "com.femcare.app://login-callback",
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    const userId = user?.id;
    await supabase.auth.signOut();
    // Remove the local copy of the user's data unless changes are still waiting to sync.
    if (userId) releaseUserData(userId);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (error) return { error: error.message };
    setProfile(data as Profile);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signUp, signIn, signOut, resetPassword, refreshProfile, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
