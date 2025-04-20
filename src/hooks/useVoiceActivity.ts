import { useState, useEffect, useRef, useCallback } from 'react';

// Augment the Window interface to include webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface VoiceActivityOptions {
  threshold?: number;        // Volume threshold (0-1)
  timeThreshold?: number;    // How long (ms) volume must exceed threshold to trigger
  onSpeechDetected?: () => void;
  enabled?: boolean;
}

/**
 * A hook that detects voice activity using audio input
 * Used for detecting user interruptions during assistant response
 */
export function useVoiceActivity({
  threshold = 0.15,          // Default volume threshold
  timeThreshold = 200,       // Default time threshold in ms
  onSpeechDetected,
  enabled = false
}: VoiceActivityOptions = {}) {
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const requestAnimationFrameIdRef = useRef<number | null>(null);
  const thresholdExceededStartRef = useRef<number | null>(null);
  
  const stop = useCallback(() => {
    if (requestAnimationFrameIdRef.current) {
      cancelAnimationFrame(requestAnimationFrameIdRef.current);
      requestAnimationFrameIdRef.current = null;
    }
    
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
    setIsListening(false);
  }, []);
  
  const start = useCallback(async () => {
    if (isListening) return;
    
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;
      
      // Set up AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Connect the microphone stream to the analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Set up data array for analyser
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // Start monitoring
      setIsListening(true);
      monitorVolume();
    } catch (error) {
      console.error('Error starting voice activity detection:', error);
    }
  }, [isListening]);
  
  const monitorVolume = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    // Get volume data
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Calculate average volume (0-1)
    const average = dataArrayRef.current.reduce((sum, value) => sum + value, 0) / 
      dataArrayRef.current.length / 255;
    
    setVolume(average);
    
    // Check if volume exceeds threshold
    if (average > threshold) {
      if (thresholdExceededStartRef.current === null) {
        thresholdExceededStartRef.current = Date.now();
      } else if (Date.now() - thresholdExceededStartRef.current > timeThreshold) {
        // Volume has exceeded threshold for long enough
        setIsActive(true);
        onSpeechDetected?.();
      }
    } else {
      // Reset if volume drops below threshold
      thresholdExceededStartRef.current = null;
      setIsActive(false);
    }
    
    // Continue monitoring
    requestAnimationFrameIdRef.current = requestAnimationFrame(monitorVolume);
  }, [threshold, timeThreshold, onSpeechDetected]);
  
  // Start/stop listening based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    
    return () => {
      stop();
    };
  }, [enabled, start, stop]);
  
  return {
    isActive,       // Whether voice is currently detected
    volume,         // Current volume level (0-1)
    isListening,    // Whether the hook is actively listening
    start,          // Manually start listening
    stop            // Manually stop listening
  };
} 