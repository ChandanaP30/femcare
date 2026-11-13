import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { App } from '@capacitor/app';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, AUTH_STORAGE_KEY } from './supabase';
import { readCachedSessionUser, releaseUserData } from './offline';
import { endSession, wipeLocalKeys, classifyDeleteError, type AuthNotice, type DeleteError } from './auth-security';
import type { Profile } from './types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Why the person was signed out, shown on the sign-in screen. */
  notice: AuthNotice | null;
  clearNotice: () => void;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Signs out of this device only. */
  signOut: () => Promise<void>;
  /** Signs out of every device. Needs a connection, so other devices really are signed out. */
  signOutEverywhere: () => Promise<{ error: string | null }>;
  /** Signs out this device because of inactivity or an invalid session. */
  expireSession: (reason: 'idle_timeout' | 'session_expired') => Promise<void>;
  /** Checks the password, deletes the account and all its data on the server, then clears this device. */
  deleteAccount: (password: string) => Promise<{ error: DeleteError | null }>;
  /** Deletes the health records on the server and the local copy. The account stays. */
  deleteHealthData: () => Promise<{ error: DeleteError | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  // A SIGNED_OUT event the person did not ask for (expired or revoked session) shows a message.
  const intentionalSignOut = useRef(false);
  const hadUser = useRef(false);
  hadUser.current = !!user;

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      // Log only the error code: the message can contain personal details.
      console.error('Error fetching profile:', error.code ?? 'unknown');
      return null;
    }
    setProfile(data as Profile | null);
    return data as Profile | null;
  }

  function clearSignedInState() {
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  useEffect(() => {
    const hadStoredLogin = (() => {
      try {
        return !!localStorage.getItem(AUTH_STORAGE_KEY);
      } catch {
        return false;
      }
    })();

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
      } catch {
        // Do not log the error object: a malformed link would be echoed back, tokens included.
        console.error('Unable to process email confirmation callback.');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Offline start: an expired login token cannot be refreshed without internet, so fall back
      // to the user stored on this device. Data still comes from the local copy. The inactivity
      // timeout (SessionGuard) still applies to this fallback.
      const cachedUser = session ? null : readCachedSessionUser<User>(AUTH_STORAGE_KEY);
      const activeUser = session?.user ?? cachedUser;
      setUser(activeUser ?? null);
      if (activeUser) {
        fetchProfile(activeUser.id).finally(() => setLoading(false));
      } else {
        // A login was stored but is no longer valid (expired or revoked): say so.
        if (hadStoredLogin) setNotice('session_expired');
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Keep the stored user when the app starts offline with an expired token (not on real sign-out).
      const cachedUser = !newSession && event !== 'SIGNED_OUT' ? readCachedSessionUser<User>(AUTH_STORAGE_KEY) : null;
      const activeUser = newSession?.user ?? cachedUser;
      setUser(activeUser ?? null);
      if (event === 'SIGNED_OUT') {
        if (!intentionalSignOut.current && hadUser.current) setNotice('session_expired');
        intentionalSignOut.current = false;
      }
      if (event === 'SIGNED_IN') setNotice(null);
      if (activeUser) {
        (async () => {
          await fetchProfile(activeUser.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
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
    setNotice(null);
    return { error: null };
  };

  const signOut = async () => {
    const userId = user?.id;
    intentionalSignOut.current = true;
    try {
      await endSession(supabase.auth, 'local', localStorage, AUTH_STORAGE_KEY);
    } finally {
      intentionalSignOut.current = false;
    }
    // Remove the local copy unless changes are still waiting to sync, and the location caches.
    if (userId) releaseUserData(userId);
    wipeLocalKeys(localStorage);
    clearSignedInState();
  };

  const signOutEverywhere = async () => {
    const userId = user?.id;
    intentionalSignOut.current = true;
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) return { error: 'failed' };
    } catch {
      return { error: 'failed' };
    } finally {
      intentionalSignOut.current = false;
    }
    if (userId) releaseUserData(userId);
    wipeLocalKeys(localStorage);
    clearSignedInState();
    setNotice('signed_out_everywhere');
    return { error: null };
  };

  const expireSession = async (reason: 'idle_timeout' | 'session_expired') => {
    const userId = user?.id;
    intentionalSignOut.current = true;
    try {
      await endSession(supabase.auth, 'local', localStorage, AUTH_STORAGE_KEY);
    } finally {
      intentionalSignOut.current = false;
    }
    if (userId) releaseUserData(userId);
    wipeLocalKeys(localStorage);
    clearSignedInState();
    setNotice(reason);
  };

  const deleteHealthData = async () => {
    if (!user) return { error: 'expired' as DeleteError };
    if (isOffline()) return { error: 'offline' as DeleteError };
    const { error } = await supabase.rpc('delete_my_health_data');
    if (error) return { error: classifyDeleteError(error.message, 'delete') };
    // The deleted records must not stay behind in the on-device copy, so it is removed too.
    releaseUserData(user.id, true);
    return { error: null };
  };

  const deleteAccount = async (password: string) => {
    if (!user || !user.email) return { error: 'expired' as DeleteError };
    if (isOffline()) return { error: 'offline' as DeleteError };
    const userId = user.id;

    // 1. Confirm the password. This also gives a fresh login, which the database function requires.
    const { error: passwordError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (passwordError) return { error: classifyDeleteError(passwordError.message, 'password') };

    // 2. Delete the data and the login itself, in one step on the server.
    const { error: deleteError } = await supabase.rpc('delete_my_account');
    if (deleteError) return { error: classifyDeleteError(deleteError.message, 'delete') };

    // 3. Make sure the server really removed the account. If it still answers for this user,
    //    nothing was deleted and the person is told so, instead of being shown a false success.
    intentionalSignOut.current = true;
    try {
      const { data: still } = await supabase.auth.getUser();
      if (still?.user) return { error: 'failed' as DeleteError };

      // 4. Clear everything kept on this device, including unsynced changes.
      await endSession(supabase.auth, 'local', localStorage, AUTH_STORAGE_KEY);
    } finally {
      intentionalSignOut.current = false;
    }
    releaseUserData(userId, true);
    wipeLocalKeys(localStorage);
    clearSignedInState();
    setNotice('account_deleted');
    return { error: null };
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
      value={{
        session, user, profile, loading, notice,
        clearNotice: () => setNotice(null),
        signUp, signIn, signOut, signOutEverywhere, expireSession, deleteAccount, deleteHealthData,
        resetPassword, refreshProfile, updateProfile,
      }}
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
