import { useState, useEffect, useCallback } from 'react';
import { useWebSocketConnection } from '../hooks/useWebSocketConnection';

export function VoiceTest() {
  const [message, setMessage] = useState('');
  const [transcription, setTranscription] = useState('');
  const [response, setResponse] = useState('');
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Set up WebSocket connection
  const {
    isConnected,
    connectionStatus,
    sendMessage,
    sendBinaryData
  } = useWebSocketConnection({
    url: 'ws://localhost:3000/ws/voice',
    onMessage: (message) => {
      console.log('Received message:', message);
      if (message.type === 'transcription') {
        setTranscription(message.text);
      } else if (message.type === 'response') {
        setResponse(message.text);
      }
    }
  });

  // Request microphone access when recording starts
  const startRecording = useCallback(async () => {
    try {
      if (!isRecording) {
        // Get microphone stream
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(micStream);

        // Create media recorder
        const recorder = new MediaRecorder(micStream);
        setMediaRecorder(recorder);

        // Clear audio chunks
        setAudioChunks([]);

        // Notify server recording started
        if (isConnected) {
          sendMessage({ type: 'start-recording' });
        }

        // Handle data available event
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks((prev) => [...prev, event.data]);
            
            // Send audio data to server
            if (isConnected) {
              // Convert Blob to ArrayBuffer and send
              const reader = new FileReader();
              reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                  sendBinaryData(reader.result);
                }
              };
              reader.readAsArrayBuffer(event.data);
            }
          }
        };

        // Start recording with 100ms chunks
        recorder.start(100);
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [isConnected, isRecording, sendMessage, sendBinaryData]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      
      // Notify server recording stopped
      if (isConnected) {
        sendMessage({ type: 'stop-recording' });
      }
      
      // Stop tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      setMediaRecorder(null);
      setStream(null);
    }
  }, [isConnected, isRecording, mediaRecorder, sendMessage, stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="p-4 border rounded shadow-sm max-w-xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Voice WebSocket Test</h2>
      
      <div className="mb-4">
        <p>WebSocket Status: <span className={`font-semibold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {connectionStatus}
        </span></p>
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          disabled={!isConnected}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      
      <div className="mb-4">
        <h3 className="font-bold">Transcription:</h3>
        <p className="p-2 bg-gray-100 min-h-[50px] rounded">
          {transcription || 'No transcription yet.'}
        </p>
      </div>
      
      <div>
        <h3 className="font-bold">Response:</h3>
        <p className="p-2 bg-gray-100 min-h-[50px] rounded">
          {response || 'No response yet.'}
        </p>
      </div>
    </div>
  );
} 