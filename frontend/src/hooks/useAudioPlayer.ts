import { useEffect, useRef } from 'react';

export const useAudioPlayer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const initializeAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  const playAudioChunk = async (audioData: ArrayBuffer) => {
    try {
      const audioContext = initializeAudioContext();
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      
      // Create a new source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      
      // Connect to the audio context's destination
      sourceNode.connect(audioContext.destination);
      
      // Play the audio
      sourceNode.start();
      
      // Store the source node reference
      sourceNodeRef.current = sourceNode;
      
      // Clean up when playback is complete
      sourceNode.onended = () => {
        sourceNodeRef.current = null;
      };
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    playAudioChunk,
    stopPlayback,
  };
}; 