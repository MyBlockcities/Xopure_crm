import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

export const useReadOnlySupabaseClient = () => {
  const supabaseUrl = process.env.XOPURE_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.XOPURE_SUPABASE_ANON_KEY?.trim();

  const supabase = useMemo(
    () =>
      supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null,
    [supabaseAnonKey, supabaseUrl],
  );

  return {
    supabase,
    configurationError: supabase
      ? null
      : 'Configure XOPURE_SUPABASE_URL and the RLS-scoped XOPURE_SUPABASE_ANON_KEY.',
  };
};
