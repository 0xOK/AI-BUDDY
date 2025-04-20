import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from './useAudioPlayer';

interface UseVoiceStreamProps {
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onMessage?: (message: { type: string; text: string }) => void;
}

export const useVoiceStream = ({
  onError,
  onConnected,
  onDisconnected,
  onMessage,
}: UseVoiceStreamProps = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const { playAudioChunk, stopPlayback } = useAudioPlayer();

  const connect = () => {
    try {
      const ws = new WebSocket('ws://localhost:3000');
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        onConnected?.();
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnected?.();
      };

      ws.onerror = (error) => {
        onError?.(new Error('WebSocket connection error'));
        console.error('WebSocket error:', error);
      };

      ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob) {
            // Handle binary audio data
            const arrayBuffer = await event.data.arrayBuffer();
            playAudioChunk(arrayBuffer);
          } else {
            // Handle JSON messages
            const message = JSON.parse(event.data);
            onMessage?.(message);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
    } catch (error) {
      onError?.(new Error('Failed to create WebSocket connection'));
      console.error('Connection error:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          
          // Convert Float32Array to Int16Array
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          
          wsRef.current.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (error) {
      onError?.(new Error('Failed to access microphone'));
      console.error('Microphone access error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopRecording();
    stopPlayback();
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isRecording,
    isConnected,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}; 