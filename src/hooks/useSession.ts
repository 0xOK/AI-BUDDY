import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load messages from localStorage when component mounts
  useEffect(() => {
    console.log('Initializing session');
    
    // Try to get existing session ID from local storage
    const existingSessionId = localStorage.getItem('sessionId');
    
    if (existingSessionId) {
      console.log('Found existing session:', existingSessionId);
      setSessionId(existingSessionId);
      
      // Load messages for this session
      const savedMessages = localStorage.getItem(`messages_${existingSessionId}`);
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          console.log('Loaded messages:', parsedMessages);
          setMessages(parsedMessages);
        } catch (error) {
          console.error('Error parsing saved messages:', error);
          // If there's an error parsing, start with an empty messages array
          setMessages([]);
          // And clear the corrupted storage
          localStorage.removeItem(`messages_${existingSessionId}`);
        }
      }
    } else {
      // Create new session ID if none exists
      const newSessionId = uuidv4();
      console.log('Created new session:', newSessionId);
      localStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
    }
    
    setInitialized(true);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (!initialized || !sessionId) return;
    
    console.log('Saving messages to localStorage:', messages.length);
    
    try {
      localStorage.setItem(`messages_${sessionId}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  }, [messages, sessionId, initialized]);

  const addMessage = useCallback(async (content: string, role: 'user' | 'assistant') => {
    console.log('Adding message:', { content, role, sessionId });
    if (!sessionId) {
      console.error('Cannot add message: No session ID');
      return null;
    }

    const newMessage: Message = {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date().toISOString(),
    };

    // Update state with the new message
    setMessages(prevMessages => {
      const updatedMessages = [...prevMessages, newMessage];
      console.log('Updated messages array:', updatedMessages.length);
      return updatedMessages;
    });

    return newMessage;
  }, [sessionId]);

  const clearSession = useCallback(() => {
    console.log('Clearing session');
    
    // Clear localStorage
    if (sessionId) {
      localStorage.removeItem(`messages_${sessionId}`);
    }
    
    // Generate a new session ID
    const newSessionId = uuidv4();
    localStorage.setItem('sessionId', newSessionId);
    setSessionId(newSessionId);
    
    // Clear messages
    setMessages([]);
  }, [sessionId]);

  return {
    sessionId,
    messages,
    addMessage,
    isLoading: !initialized,
    clearSession
  };
} 