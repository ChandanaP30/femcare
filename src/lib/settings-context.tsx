import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { UserSettings, Theme } from './types';
import { useAuth } from './auth-context';

interface SettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  updateSettings: (updates: Partial<UserSettings>) => Promise<{ error: string | null }>;
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    async function load() {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading settings:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .insert({ user_id: user.id })
          .select()
          .single();
        if (insertError) {
          console.error('Error creating settings:', insertError);
        } else {
          setSettings(newSettings as UserSettings);
        }
      } else {
        setSettings(data as UserSettings);
      }
      setLoading(false);
    }

    load();
  }, [user]);

  useEffect(() => {
    if (!settings?.theme) return;
    const theme = settings.theme;
    try { localStorage.setItem('femcare_theme', theme); } catch { /* storage unavailable */ }
    applyTheme(theme);
  }, [settings?.theme]);

  function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('user_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) return { error: error.message };
    setSettings(data as UserSettings);
    return { error: null };
  };

  const setTheme = async (theme: Theme) => {
    applyTheme(theme);
    await updateSettings({ theme });
  };

  return (
    <SettingsContext.Provider
      value={{ settings, loading, updateSettings, theme: settings?.theme || 'system', setTheme }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
