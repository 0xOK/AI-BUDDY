import { useState, useCallback, useRef } from 'react';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  error: string | null;
  playAudio: (audioData: ArrayBuffer) => Promise<void>;
  stopAudio: () => void;
}

/**
 * Hook for playing audio data
 * @returns Audio player controls
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  /**
   * Play audio from ArrayBuffer data
   */
  const playAudio = useCallback(async (audioData: ArrayBuffer) => {
    try {
      // Stop any currently playing audio
      stopAudio();
      
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      console.log('Playing audio, data size:', audioData.byteLength);
      setIsPlaying(true);
      setError(null);
      
      // Decode the audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      
      // Create a source node
      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContextRef.current.destination);
      
      // Set up event handlers
      sourceNode.onended = () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        sourceNodeRef.current = null;
      };
      
      // Store the source node for later use
      sourceNodeRef.current = sourceNode;
      
      // Start playback
      sourceNode.start();
      console.log('Audio playback started');
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsPlaying(false);
      setError(err instanceof Error ? err.message : 'Unknown error playing audio');
    }
  }, []);

  /**
   * Stop audio playback
   */
  const stopAudio = useCallback(() => {
    try {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
    } catch (err) {
      console.error('Error stopping audio:', err);
    }
  }, []);

  return {
    isPlaying,
    error,
    playAudio,
    stopAudio
  };
} 