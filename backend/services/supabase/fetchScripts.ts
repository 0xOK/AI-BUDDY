import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Fallback scripts for when Supabase is not available
const FALLBACK_SCRIPTS = [
  { 
    id: 1, 
    prompt: "Hello! I'm your AI assistant. How can I help you today?", 
    stage: 1, 
    created_at: new Date().toISOString(),
    active: true 
  },
  { 
    id: 2, 
    prompt: "I see you're interested in our services. Would you like to learn more about our features?", 
    stage: 2, 
    created_at: new Date().toISOString(),
    active: true 
  },
  { 
    id: 3, 
    prompt: "Great! Would you like to register to get full access to all features?", 
    stage: 3, 
    created_at: new Date().toISOString(),
    active: true 
  }
];

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
let supabase: any = null;
try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient<Database>(
      supabaseUrl,
      supabaseKey
    );
    console.log('Supabase client initialized successfully');
  } else {
    console.warn('Supabase credentials missing, using fallback scripts');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // We'll continue without Supabase and use fallback scripts
}

/**
 * Fetch all active onboarding scripts from Supabase or fallback to predefined ones
 */
export async function fetchAllScripts() {
  // Always get fallback scripts ready
  console.log('Preparing fallback scripts');
  
  // Check if Supabase client is available
  if (!supabase || !supabaseUrl || !supabaseKey) {
    console.log('Using fallback scripts - Supabase credentials not available');
    return FALLBACK_SCRIPTS;
  }

  try {
    // Add timeout to the fetch request to prevent hanging
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Supabase fetch timed out')), 5000);
    });

    // Create the fetch request with the Supabase client
    const fetchPromise = supabase
      .from('scripts')
      .select('*')
      .eq('active', true)
      .order('stage', { ascending: true });

    // Race the timeout against the actual fetch
    const { data, error } = await Promise.race([
      fetchPromise,
      timeoutPromise.then(() => ({ data: null, error: new Error('Fetch timed out') }))
    ]);

    if (error) {
      console.error('Error fetching scripts:', error);
      return FALLBACK_SCRIPTS;
    }

    // If no data or empty array, use fallbacks
    if (!data || data.length === 0) {
      console.log('No scripts found in Supabase, using fallbacks');
      return FALLBACK_SCRIPTS;
    }

    return data;
  } catch (error) {
    console.error('Error fetching scripts:', error);
    return FALLBACK_SCRIPTS;
  }
}

/**
 * Fetch a script for a specific stage
 * @param stage The stage number to fetch
 */
export async function fetchScriptByStage(stage: number) {
  // Check if Supabase client is available
  if (!supabase || !supabaseUrl || !supabaseKey) {
    console.log(`Using fallback script for stage ${stage} - Supabase unavailable`);
    return FALLBACK_SCRIPTS.find(script => script.stage === stage) || FALLBACK_SCRIPTS[0];
  }

  try {
    // Add timeout to the fetch request
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Supabase fetch timed out')), 5000);
    });

    // Create the fetch request
    const fetchPromise = supabase
      .from('scripts')
      .select('*')
      .eq('stage', stage)
      .eq('active', true)
      .single();

    // Race the timeout against the actual fetch
    const { data, error } = await Promise.race([
      fetchPromise,
      timeoutPromise.then(() => ({ data: null, error: new Error('Fetch timed out') }))
    ]);

    if (error) {
      console.error(`Error fetching script for stage ${stage}:`, error);
      return FALLBACK_SCRIPTS.find(script => script.stage === stage) || FALLBACK_SCRIPTS[0];
    }

    return data;
  } catch (error) {
    console.error(`Error fetching script for stage ${stage}:`, error);
    return FALLBACK_SCRIPTS.find(script => script.stage === stage) || FALLBACK_SCRIPTS[0];
  }
}

/**
 * Insert a new script into the database
 */
export async function createScript(script: Database['public']['Tables']['scripts']['Insert']) {
  // Check if Supabase client is available
  if (!supabase || !supabaseUrl || !supabaseKey) {
    console.error('Cannot create script - Supabase unavailable');
    return null;
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