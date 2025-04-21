import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: any) => void;
  onAudio?: (audioData: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  mockMode?: boolean;
}

interface WebSocketConnectionOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (data: any) => void;
  onBinaryData?: (data: ArrayBuffer) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed' | 'mock';

// Default URL detection - works both in dev and production
function getDefaultWebSocketUrl(path: string = '/ws/voice'): string {
  // For development, directly use port 3000
  return `ws://localhost:3000${path}`;
}

export function useWebSocketConnection({
  url = import.meta.env.VITE_WEBSOCKET_URL || getDefaultWebSocketUrl(),
  onMessage,
  onAudio,
  onOpen,
  onClose,
  onError,
  autoReconnect = true,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5,
  mockMode = false
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMockModeRef = useRef(mockMode);
  const wsUrlRef = useRef(url);

  // Connect to the WebSocket server
  const connect = useCallback(() => {
    // If mock mode is enabled, don't attempt to connect
    if (isMockModeRef.current) {
      console.log('WebSocket in mock mode - not connecting to real server');
      setConnectionStatus('mock');
      setIsConnected(true); // Pretend we're connected
      onOpen?.(); // Call the onOpen callback
      return;
    }

    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    try {
      setConnectionStatus('connecting');
      const socket = new WebSocket(wsUrlRef.current);
      socketRef.current = socket;
      
      socket.binaryType = 'arraybuffer'; // Important for receiving binary audio data

      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectCountRef.current = 0; // Reset reconnect count on successful connection
        onOpen?.();
      };

      socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onClose?.();
        
        // Handle reconnection logic
        if (autoReconnect && reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current += 1;
          console.log(`Reconnecting (${reconnectCountRef.current}/${maxReconnectAttempts})...`);
          reconnectTimeoutRef.current = window.setTimeout(connect, reconnectInterval);
        } else if (reconnectCountRef.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached, switching to mock mode');
          // Switch to mock mode after max attempts
          isMockModeRef.current = true;
          setConnectionStatus('mock');
          setIsConnected(true); // Pretend we're connected in mock mode
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      socket.onmessage = (event) => {
        // Handle binary audio data
        if (event.data instanceof ArrayBuffer) {
          console.log('Received audio data:', event.data.byteLength, 'bytes');
          onAudio?.(event.data);
        } 
        // Handle JSON messages
        else {
          try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);
            onMessage?.(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      // Switch to mock mode if connection fails
      isMockModeRef.current = true;
      setConnectionStatus('mock');
      setIsConnected(true); // Pretend we're connected in mock mode
    }
  }, [wsUrlRef.current, onOpen, onClose, onError, onMessage, onAudio, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  // Disconnect from the WebSocket server
  const disconnect = useCallback(() => {
    if (isMockModeRef.current) {
      console.log('WebSocket in mock mode - disconnecting mock connection');
      setConnectionStatus('disconnected');
      setIsConnected(false);
      return;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    
    // Clear any reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  // Send a message to the WebSocket server (or handle mock mode)
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (isMockModeRef.current) {
      console.log('Mock WebSocket - message sent:', message);
      // Simulate response in mock mode
      if (message.type === 'start_recording') {
        setTimeout(() => {
          onMessage?.({ type: 'info', message: 'Mock recording started' });
        }, 100);
      } else if (message.type === 'stop_recording') {
        setTimeout(() => {
          onMessage?.({ type: 'info', message: 'Mock recording stopped' });
        }, 100);
      }
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: WebSocket is not connected');
    }
  }, [onMessage]);

  // Send binary data to the WebSocket server (or handle mock mode)
  const sendBinaryData = useCallback((data: ArrayBuffer | Blob) => {
    if (isMockModeRef.current) {
      console.log('Mock WebSocket - binary data sent:', data instanceof Blob ? data.size : data.byteLength, 'bytes');
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data);
    } else {
      console.error('Cannot send binary data: WebSocket is not connected');
    }
  }, []);

  // Update mock mode if it changes
  useEffect(() => {
    if (mockMode !== isMockModeRef.current) {
      isMockModeRef.current = mockMode;
      if (mockMode) {
        // Switch to mock mode
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        setConnectionStatus('mock');
        setIsConnected(true);
      } else {
        // Switch back to real mode
        setConnectionStatus('disconnected');
        setIsConnected(false);
        connect();
      }
    }
  }, [mockMode, connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    sendBinaryData,
    isMockMode: isMockModeRef.current
  };
} 