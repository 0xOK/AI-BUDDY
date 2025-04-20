import { createClient } from '@supabase/supabase-js';
import { Database, Script, Message, Profile } from './supabase.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const SCRIPTS_TABLE = 'scripts';
export const MESSAGES_TABLE = 'messages';
export const PROFILES_TABLE = 'profiles';

export type { Script, Message, Profile };