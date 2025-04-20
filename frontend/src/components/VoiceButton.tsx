import React from 'react';
import { useVoiceStream } from '../hooks/useVoiceStream';

interface VoiceButtonProps {
  onMessage?: (message: { type: string; text: string }) => void;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onMessage }) => {
  const {
    isRecording,
    isConnected,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoiceStream({
    onError: (error) => {
      console.error('Voice stream error:', error);
      alert(error.message);
    },
    onConnected: () => {
      console.log('Connected to WebSocket server');
    },
    onDisconnected: () => {
      console.log('Disconnected from WebSocket server');
    },
    onMessage,
  });

  const handleClick = async () => {
    if (!isConnected) {
      connect();
      return;
    }

    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`voice-button ${isRecording ? 'recording' : ''} ${isConnected ? 'connected' : ''}`}
      style={{
        padding: '1rem 2rem',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: isRecording ? '#ff4444' : isConnected ? '#4CAF50' : '#2196F3',
        color: 'white',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      }}
    >
      {!isConnected ? 'Connect' : isRecording ? 'Stop' : 'Start'}
    </button>
  );
}; 