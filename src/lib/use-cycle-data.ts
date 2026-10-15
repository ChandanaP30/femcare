import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import type { Period, SymptomEntry } from './types';

export function useCycleData(userId?: string) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (uid: string) => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', uid).order('start_date', { ascending: true }),
      supabase.from('symptoms').select('*').eq('user_id', uid).order('entry_date', { ascending: true }),
    ]);
    setPeriods((pRes.data as unknown as Period[]) || []);
    setSymptoms((sRes.data as unknown as SymptomEntry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) fetchData(userId);
  }, [userId, fetchData]);

  return { periods, symptoms, loading, fetchData, setPeriods, setSymptoms };
}
