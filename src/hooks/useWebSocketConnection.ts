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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

export function useWebSocketConnection({
  url = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3000/ws',
  onMessage,
  onAudio,
  onOpen,
  onClose,
  onError,
  autoReconnect = true,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Connect to the WebSocket server
  const connect = useCallback(() => {
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    try {
      setConnectionStatus('connecting');
      const socket = new WebSocket(url);
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
          console.error('Max reconnection attempts reached');
          setConnectionStatus('failed');
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
      setConnectionStatus('failed');
    }
  }, [url, onOpen, onClose, onError, onMessage, onAudio, autoReconnect, maxReconnectAttempts, reconnectInterval]);

  // Disconnect from the WebSocket server
  const disconnect = useCallback(() => {
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

  // Send a message to the WebSocket server
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.error('Cannot send message: WebSocket is not connected');
    }
  }, []);

  // Send binary data to the WebSocket server
  const sendBinaryData = useCallback((data: ArrayBuffer | Blob) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data);
    } else {
      console.error('Cannot send binary data: WebSocket is not connected');
    }
  }, []);

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
    sendBinaryData
  };
} 