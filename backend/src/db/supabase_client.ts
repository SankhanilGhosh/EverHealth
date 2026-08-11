import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  : null;

if (isSupabaseConfigured) {
  console.log(`[Supabase DB] Connected to Supabase project at ${SUPABASE_URL}`);
} else {
  console.log(`[Supabase DB] Note: SUPABASE_URL or SUPABASE_ANON_KEY not set in .env. Operating in high-speed local memory mode.`);
}
