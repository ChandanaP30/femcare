import { createClient } from '@supabase/supabase-js';
import { createOfflineFetch, setSyncHook, installOfflineListeners } from './offline';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// supabase-js stores the login session under this key (used to start the app without internet).
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Offline support: reads fall back to a local copy and writes are queued (see offline.ts).
  global: { fetch: createOfflineFetch() },
});

// When the connection returns, any request pushes queued changes first. This one is harmless.
setSyncHook(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.from('profiles').select('id').eq('id', data.session.user.id).limit(1);
});
installOfflineListeners();
