import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

// Create a default session ID to use in case local storage fails
const DEFAULT_SESSION_ID = uuidv4();

export function useSession() {
  const [sessionId, setSessionId] = useState<string>(DEFAULT_SESSION_ID);
  const [messages, setMessages] = useState<Message[]>([]);
  const [initialized, setInitialized] = useState(false);
  const isProcessingRef = useRef(false);

  // Load messages from localStorage when component mounts
  useEffect(() => {
    try {
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
    } catch (error) {
      // If we can't access localStorage (e.g., privacy mode), use the default session ID
      console.error('Error accessing localStorage:', error);
      // We already have a default session ID set in state
    } finally {
      setInitialized(true);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (!initialized) return;
    
    // Always have a session ID (use default if something went wrong)
    const currentSessionId = sessionId || DEFAULT_SESSION_ID;
    
    console.log('Saving messages to localStorage:', messages.length);
    
    try {
      localStorage.setItem(`messages_${currentSessionId}`, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
    
    // Do NOT trigger any automatic actions here based on messages changing
  }, [messages, sessionId, initialized]);

  const addMessage = useCallback(async (content: string, role: 'user' | 'assistant') => {
    // Always use a session ID (default as fallback)
    const currentSessionId = sessionId || DEFAULT_SESSION_ID;
    
    console.log('Adding message:', { content, role, sessionId: currentSessionId });
    
    // Prevent re-entry if we're already processing a message
    if (isProcessingRef.current && role === 'user') {
      console.warn('Preventing duplicate user message while another is being processed');
      return null;
    }
    
    // Set the processing flag if this is a user message
    if (role === 'user') {
      isProcessingRef.current = true;
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
    
    // Clear the processing flag if this is an assistant message (indicating the completion of a turn)
    if (role === 'assistant') {
      isProcessingRef.current = false;
    }

    return newMessage;
  }, [sessionId]);

  const clearSession = useCallback(() => {
    console.log('Clearing session');
    
    try {
      // First, clear all messages from state to ensure UI is updated immediately
      setMessages([]);
      
      // Clear localStorage for current session
      if (sessionId) {
        localStorage.removeItem(`messages_${sessionId}`);
      }
      
      // Generate a new session ID
      const newSessionId = uuidv4();
      console.log('Generated new session ID:', newSessionId);
      
      // Store new session ID and clear the messages for it
      localStorage.setItem('sessionId', newSessionId);
      localStorage.removeItem(`messages_${newSessionId}`);
      
      // Update the session ID in state
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Error clearing session in localStorage:', error);
      // Even if localStorage fails, ensure messages are cleared from state
      setMessages([]);
      // Use a new default session ID if localStorage fails
      setSessionId(uuidv4());
    }
    
    // Reset processing flag
    isProcessingRef.current = false;
    
    console.log('Session cleared successfully');
    
    // Return true to indicate success
    return true;
  }, [sessionId]);

  return {
    sessionId,
    messages,
    addMessage,
    isLoading: !initialized,
    clearSession
  };
} 