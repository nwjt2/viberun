import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

// When Supabase env vars are not configured, the PWA runs in local mode: all
// state lives in IndexedDB, and the Companion is talked to via its local HTTP
// dev endpoint. See lib/jobs.ts.
export const localMode = supabase == null;
