import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocketConnection } from './useWebSocketConnection';

interface VoiceStreamOptions {
  onData?: (audioChunk: Blob) => void;
  onTranscription?: (text: string) => void;
  chunkSize?: number;
  silenceThreshold?: number;
  silenceTimeout?: number;
}

export function useVoiceStream({
  onData,
  onTranscription,
  chunkSize = 4096,
  silenceThreshold = 0.01,
  silenceTimeout = 1500
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

  // Create WebSocket connection to backend server
  const { 
    isConnected: isWebSocketConnected, 
    connectionStatus,
    sendBinaryData,
    sendMessage
  } = useWebSocketConnection({
    url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000/ws/voice',
    onMessage: (message) => {
      // Handle messages from the server
      console.log('Received message from WebSocket server:', message);
      if (message.type === 'transcription') {
        onTranscription?.(message.text);
      }
    }
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

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Notify server that we're starting to record
      if (isWebSocketConnected) {
        sendMessage({ type: 'start_recording' });
      }

      // Handle data chunks as they become available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          onData?.(event.data);
          
          // Send audio chunk to server via WebSocket if connected
          if (isWebSocketConnected) {
            sendBinaryData(event.data);
          }
        }
        
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
      };

      // When recording stops
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setIsRecording(false);
        
        // Notify server that recording has stopped
        if (isWebSocketConnected) {
          sendMessage({ type: 'stop_recording' });
        }
        
        cleanup();
        
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
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
  }, [isRecording, onData, cleanup, chunkSize, silenceThreshold, silenceTimeout, isWebSocketConnected, sendMessage, sendBinaryData]);

  // Stop recording audio
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      console.log('Recording stopped');
    }
  }, [isRecording]);

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
      status: connectionStatus
    }
  };
} 