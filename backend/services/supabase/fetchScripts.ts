import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Define the database schema types
interface Database {
  public: {
    Tables: {
      scripts: {
        Row: {
          id: number;
          prompt: string;
          stage: number;
          created_at: string;
          active: boolean;
        };
        Insert: {
          id?: number;
          prompt: string;
          stage: number;
          created_at?: string;
          active?: boolean;
        };
        Update: {
          id?: number;
          prompt?: string;
          stage?: number;
          created_at?: string;
          active?: boolean;
        };
      };
    };
  };
}

// Initialize the Supabase client
const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || ''
);

/**
 * Fetch all active onboarding scripts from Supabase
 */
export async function fetchAllScripts() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('active', true)
      .order('stage', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching scripts:', error);
    throw error;
  }
}

/**
 * Fetch a script for a specific stage
 * @param stage The stage number to fetch
 */
export async function fetchScriptByStage(stage: number) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('stage', stage)
      .eq('active', true)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching script for stage ${stage}:`, error);
    throw error;
  }
}

/**
 * Insert a new script into the database
 */
export async function createScript(script: Database['public']['Tables']['scripts']['Insert']) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured');
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .insert(script)
      .select();

    if (error) {
      throw error;
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Error creating script:', error);
    throw error;
  }
}

export default {
  fetchAllScripts,
  fetchScriptByStage,
  createScript
}; 