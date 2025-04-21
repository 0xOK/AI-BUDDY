import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocketConnection } from './useWebSocketConnection';

interface VoiceStreamOptions {
  onData?: (audioChunk: Blob) => void;
  onTranscription?: (text: string) => void;
  chunkSize?: number;
  silenceThreshold?: number;
  silenceTimeout?: number;
  autoStopOnSilence?: boolean;
  useMockWebSocket?: boolean;
}

export function useVoiceStream({
  onData,
  onTranscription,
  chunkSize = 4096,
  silenceThreshold = 0.01,
  silenceTimeout = 1500,
  autoStopOnSilence = false,
  useMockWebSocket = true
}: VoiceStreamOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<{
    audioContext: AudioContext;
    analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode;
    timeoutId: number | null;
  } | null>(null);
  
  // Prevent auto-restart
  const autoRestartRef = useRef<boolean>(false);
  
  // Avoid multiple callbacks
  const isProcessingRef = useRef<boolean>(false);

  // Flag to track if stop was requested
  const stopRequestedRef = useRef<boolean>(false);

  // Create WebSocket connection to backend server
  const { 
    isConnected: isWebSocketConnected, 
    connectionStatus,
    sendBinaryData,
    sendMessage,
    isMockMode
  } = useWebSocketConnection({
    url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000/ws/voice',
    onMessage: (message) => {
      // Handle messages from the server
      console.log('Received message from WebSocket server:', message);
      if (message.type === 'transcription') {
        onTranscription?.(message.text);
      }
    },
    mockMode: useMockWebSocket,
    maxReconnectAttempts: 2
  });

  // Cleanup function to handle cleanup when recording stops
  const cleanup = useCallback(() => {
    // Clear any silence timeout
    if (silenceDetectorRef.current?.timeoutId) {
      clearTimeout(silenceDetectorRef.current.timeoutId);
    }

    // Close audio context
    if (silenceDetectorRef.current) {
      silenceDetectorRef.current.source.disconnect();
      silenceDetectorRef.current.analyser.disconnect();
      silenceDetectorRef.current.audioContext.close().catch(console.error);
      silenceDetectorRef.current = null;
    }

    // Clear media recorder
    mediaRecorderRef.current = null;

    console.log('Voice recording resources cleaned up');
  }, []);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      if (isRecording) {
        console.warn('Already recording!');
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup silence detection with audio context
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      silenceDetectorRef.current = {
        audioContext,
        analyser,
        source,
        timeoutId: null
      };

      // Try to use MP3 format which is most reliable with OpenAI
      const mimeTypes = [
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/webm',
        'audio/webm;codecs=opus'
      ];
      
      // Find the first supported MIME type with preference for MP3
      let mimeType = 'audio/webm';  // Default fallback
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          // If we found MP3 support, prioritize it and break
          if (type.includes('mp3') || type.includes('mpeg')) {
            break;
          }
        }
      }
      console.log('Using MediaRecorder with MIME type:', mimeType);
      
      // Silence detection variables
      let totalAudioLevel = 0;
      let audioSampleCount = 0;
      let hasDetectedSound = false;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Notify server that we're starting to record (both real and mock mode handle this)
      sendMessage({ type: 'start_recording' });

      // Handle data chunks as they become available
      mediaRecorder.ondataavailable = (event) => {
        // Skip processing if stop was requested
        if (stopRequestedRef.current) {
          console.log('Stop requested - skipping audio processing');
          return;
        }
        
        if (event.data.size > 0) {
          // Add chunk to our collection
          audioChunksRef.current.push(event.data);
          
          // Check for silence by analyzing current audio levels
          if (silenceDetectorRef.current) {
            const dataArray = new Uint8Array(silenceDetectorRef.current.analyser.frequencyBinCount);
            silenceDetectorRef.current.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const avg = sum / dataArray.length;
            
            // Track total audio level for the full recording
            totalAudioLevel += avg;
            audioSampleCount++;
            
            // If we detect significant sound at any point, mark as having sound
            if (avg > 10) {
              hasDetectedSound = true;
            }
          }
          
          // Only call onData if we're not already processing, have enough data, and have detected sound
          if (!isProcessingRef.current && onData && audioChunksRef.current.length > 0) {
            // Check if we've collected enough meaningful audio
            const combinedSize = audioChunksRef.current.reduce((size, chunk) => size + chunk.size, 0);
            
            if (combinedSize > 2000 && (hasDetectedSound || combinedSize > 10000)) {
              isProcessingRef.current = true;
              
              // Create a properly formatted audio blob
              // Force MP3 MIME type for better OpenAI compatibility
              const finalMimeType = 'audio/mp3';
              
              const combinedBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
              console.log(`Sending audio for processing, mime type: ${finalMimeType}, size: ${combinedBlob.size} bytes, sound detected: ${hasDetectedSound}`);
              
              // Skip callback if stop was requested after we started preparing the blob
              if (!stopRequestedRef.current) {
                onData(combinedBlob);
              } else {
                console.log('Stop requested during processing - aborting callback');
                isProcessingRef.current = false;
              }
              
              // Clear the chunks but continue recording - don't stop automatically
              audioChunksRef.current = [];
              
              // Reset audio tracking
              totalAudioLevel = 0;
              audioSampleCount = 0;
              hasDetectedSound = false;
              
              // Reset processing flag after a delay to allow new audio to be collected
              // Only if stop wasn't requested
              if (!stopRequestedRef.current) {
                setTimeout(() => {
                  isProcessingRef.current = false;
                }, 1000);
              }
            } else {
              console.log(`Skipping processing - not enough meaningful audio (size: ${combinedSize}, sound: ${hasDetectedSound})`);
            }
          }
          
          // Send audio chunk to server via WebSocket (both real and mock mode handle this)
          sendBinaryData(event.data);
        }
        
        // Only check for silence if autoStopOnSilence is enabled
        if (autoStopOnSilence) {
          // Check for silence
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length / 255; // Normalize to 0-1
          
          // If volume is below threshold, start silence timer
          if (average < silenceThreshold) {
            if (!silenceDetectorRef.current?.timeoutId) {
              console.log('Silence detected, starting timeout');
              silenceDetectorRef.current!.timeoutId = window.setTimeout(() => {
                console.log('Silence timeout reached, stopping recording');
                stopRecording();
              }, silenceTimeout);
            }
          } else {
            // If volume is above threshold, clear silence timer
            if (silenceDetectorRef.current?.timeoutId) {
              clearTimeout(silenceDetectorRef.current.timeoutId);
              silenceDetectorRef.current.timeoutId = null;
            }
          }
        }
      };

      // When recording stops
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(audioBlob);
        setIsRecording(false);
        
        // Notify server that recording has stopped (both real and mock mode handle this)
        sendMessage({ type: 'stop_recording' });
        
        cleanup();
        
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
        
        // Reset the processing flag after stopping
        isProcessingRef.current = false;
      };

      // Start recording
      mediaRecorder.start(chunkSize);
      setIsRecording(true);
      console.log('Recording started with chunk size:', chunkSize);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      cleanup();
    }
  }, [isRecording, onData, cleanup, chunkSize, silenceThreshold, silenceTimeout, autoStopOnSilence, sendMessage, sendBinaryData]);

  // Stop recording audio - add additional safeguards
  const stopRecording = useCallback(() => {
    console.log('Stop recording requested');
    
    try {
      // Check if we're actually recording before attempting to stop
      if (mediaRecorderRef.current && isRecording) {
        // Stop the media recorder if it's active
        mediaRecorderRef.current.stop();
        console.log('Media recorder stopped');
      }
      
      // Reset processing flag
      isProcessingRef.current = false;
    } catch (error) {
      console.error('Error in stopRecording:', error);
      // Ensure recording state is reset even on error
      setIsRecording(false);
      // Still run cleanup even if there was an error
      cleanup();
    }
  }, [isRecording, cleanup]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
      cleanup();
    };
  }, [stopRecording, cleanup]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    webSocketStatus: {
      isConnected: isWebSocketConnected,
      status: connectionStatus,
      isMockMode
    }
  };
} 