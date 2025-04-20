import { useState, useEffect } from 'react';
import { supabase, Script, SCRIPTS_TABLE } from '../lib/supabase';

interface BotScriptsState {
  scripts: Script[];
  currentStage: number;
  isLoading: boolean;
  error: string | null;
}

export const useBotScripts = () => {
  const [state, setState] = useState<BotScriptsState>({
    scripts: [],
    currentStage: 1,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const { data, error } = await supabase
          .from(SCRIPTS_TABLE)
          .select('*')
          .order('stage', { ascending: true });

        if (error) throw error;

        setState(prev => ({
          ...prev,
          scripts: data || [],
          isLoading: false,
        }));
      } catch (error) {
        console.error('Error fetching scripts:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to fetch scripts',
          isLoading: false,
        }));
      }
    };

    fetchScripts();
  }, []);

  const getCurrentScript = (): Script | null => {
    return state.scripts.find(script => script.stage === state.currentStage) || null;
  };

  const advanceStage = () => {
    setState(prev => ({
      ...prev,
      currentStage: prev.currentStage + 1,
    }));
  };

  const resetStage = () => {
    setState(prev => ({
      ...prev,
      currentStage: 1,
    }));
  };

  return {
    scripts: state.scripts,
    currentScript: getCurrentScript(),
    currentStage: state.currentStage,
    isLoading: state.isLoading,
    error: state.error,
    advanceStage,
    resetStage,
  };
}; 