import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from './useSession'

// Types that match backend types
export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  role: MessageRole
  content: string
  timestamp?: string
}

export interface ConversationState {
  turnCount: number
  stage: 'onboarding' | 'free'
  history: Message[]
  sessionId?: string
  lastInterrupted?: boolean
  lastUserMessage?: string
  lastAssistantMessage?: string
}

export type AssistantResponse = {
  response: string
  action?: "redirect"
  to?: string
  stage: "onboarding" | "free"
}

/**
 * Custom hook for interacting with the conversation engine
 */
export function useConversationEngine() {
  const { sessionId } = useSession()
  const [state, setState] = useState<ConversationState>({
    turnCount: 0,
    stage: 'onboarding',
    history: [],
    sessionId: sessionId || undefined,
    lastInterrupted: false,
    lastUserMessage: undefined,
    lastAssistantMessage: undefined
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState<AssistantResponse | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInterruptingRef = useRef<boolean>(false)

  // Initialize conversation state
  useEffect(() => {
    if (sessionId) {
      setState(prev => ({ ...prev, sessionId }))
    }
  }, [sessionId])

  // Handle message sending
  const sendMessage = useCallback(async (
    input: string, 
    interrupted: boolean = false
  ): Promise<AssistantResponse> => {
    // Set processing state
    setIsProcessing(true)

    // Cancel any in-progress requests if this is an interruption
    if (interrupted && abortControllerRef.current) {
      console.log('Interrupting current request')
      isInterruptingRef.current = true
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    try {
      // Call backend API to process message
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          state,
          interrupted: interrupted || isInterruptingRef.current
        }),
        signal
      })

      // Reset interruption flag
      isInterruptingRef.current = false

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Update local state with the new state from backend
      setState(data.updatedState)
      
      // Store the response for access by components
      setLastResponse(data.response)
      
      return data.response
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        console.error('Error sending message:', error)
      }
      
      // If this was an interruption that got aborted, don't consider it an error
      if (isInterruptingRef.current) {
        isInterruptingRef.current = false
        const interruptResponse: AssistantResponse = {
          response: "I stopped to listen to you.",
          stage: state.stage
        }
        setLastResponse(interruptResponse)
        return interruptResponse
      }
      
      // Return a fallback response on error
      const errorResponse: AssistantResponse = {
        response: "I'm sorry, I couldn't process your message. Please try again.",
        stage: state.stage
      }
      
      setLastResponse(errorResponse)
      return errorResponse
    } finally {
      setIsProcessing(false)
      // Only clear the abort controller if this wasn't an interruption
      if (!isInterruptingRef.current) {
        abortControllerRef.current = null
      }
    }
  }, [state])

  // Interrupt the current conversation
  const interrupt = useCallback(() => {
    if (abortControllerRef.current && isProcessing) {
      console.log('Interrupting conversation')
      isInterruptingRef.current = true
      abortControllerRef.current.abort()
      setIsProcessing(false)
      
      // Update state to reflect interruption
      setState(prev => ({
        ...prev,
        lastInterrupted: true
      }))
    }
  }, [isProcessing])

  // Reset the conversation
  const resetConversation = useCallback(() => {
    // Interrupt any ongoing processing
    interrupt()
    
    // Reset to initial state
    setState({
      turnCount: 0,
      stage: 'onboarding',
      history: [],
      sessionId: sessionId || undefined,
      lastInterrupted: false,
      lastUserMessage: undefined,
      lastAssistantMessage: undefined
    })
    
    setLastResponse(null)
  }, [sessionId, interrupt])

  // Local utility to simulate backend responses during development
  const mockSendMessage = useCallback(async (
    input: string,
    interrupted: boolean = false
  ): Promise<AssistantResponse> => {
    setIsProcessing(true)
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Handle interruptions
    if (interrupted) {
      // Update state to reflect interruption
      setState(prev => {
        const newState = { ...prev, lastInterrupted: true }
        
        // If the last message was from the assistant, remove it
        if (newState.history.length > 0 && 
            newState.history[newState.history.length - 1].role === 'assistant') {
          newState.history.pop()
        }
        
        // Merge with previous message if available
        if (newState.lastUserMessage) {
          input = `${newState.lastUserMessage} ${input}`
        }
        
        return newState
      })
    }
    
    // Store current message
    setState(prev => ({
      ...prev,
      lastUserMessage: input
    }))
    
    // Update turn count
    const newTurnCount = interrupted ? state.turnCount : state.turnCount + 1
    
    // Detect registration intent
    const registrationRegex = /\b(register|sign\s*up|create\s*account|yes|sure|okay)\b/i
    const hasRegistrationIntent = registrationRegex.test(input.toLowerCase())
    
    let response: AssistantResponse
    
    if (hasRegistrationIntent) {
      response = {
        response: "Great! I'll redirect you to the registration page now.",
        action: "redirect",
        to: "/register",
        stage: state.stage
      }
    } else if (state.stage === 'onboarding' && newTurnCount === 2) {
      // After first user message, prompt for registration
      response = {
        response: "I'd be happy to help with that. Would you like to register an account with us?",
        stage: 'onboarding'
      }
    } else if (newTurnCount > 3) {
      // After third exchange, switch to free-form
      response = {
        response: "Here's what I can tell you about that. Is there anything else you'd like to know?",
        stage: 'free'
      }
    } else {
      // Add some variability to responses
      const fillers = ["Well, ", "So, ", "Hmm, ", "Let's see. ", "Actually, "]
      const useFiller = Math.random() < 0.3
      const filler = useFiller ? fillers[Math.floor(Math.random() * fillers.length)] : ''
      
      // Default response
      response = {
        response: `${filler}I understand you said "${input}". How can I help you with that?`,
        stage: 'onboarding'
      }
    }
    
    // Add response to history
    setState(prev => ({
      ...prev,
      turnCount: newTurnCount,
      stage: newTurnCount > 3 ? 'free' : 'onboarding',
      history: [
        ...prev.history,
        { role: 'user', content: input, timestamp: new Date().toISOString() },
        { role: 'assistant', content: response.response, timestamp: new Date().toISOString() }
      ],
      lastAssistantMessage: response.response
    }))
    
    setLastResponse(response)
    setIsProcessing(false)
    return response
  }, [state])

  // WebSocket for real-time communication (interruptions)
  useEffect(() => {
    // In development mode, use mock WebSocket to avoid connection errors
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Using mock WebSocket');
      return;
    }
    
    // Connect to WebSocket directly on port 3000 where we know the server is running
    const wsPath = '/ws/conversation';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:3000${wsPath}`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    let socket: WebSocket | null = null;
    
    // We'll use a simple reconnect mechanism
    const maxRetries = 3;
    let retryCount = 0;
    let isConnecting = false;
    
    const connect = () => {
      if (isConnecting) return;
      isConnecting = true;
      
      try {
        // Create a new WebSocket
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log(`Connected to conversation WebSocket on port 3000`);
          retryCount = 0;
          isConnecting = false;
          
          // Send session info
          if (socket && sessionId) {
            try {
              socket.send(JSON.stringify({
                type: 'init',
                sessionId
              }));
            } catch (error) {
              console.error('Error sending session info:', error);
            }
          }
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle state updates
            if (data.type === 'state_update' && data.state) {
              setState(data.state);
            }
            
            // Handle responses
            if (data.type === 'response' && data.response) {
              setLastResponse({
                response: data.response,
                stage: data.state?.stage || state.stage
              });
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          isConnecting = false;
          // Don't try to reconnect on error - will happen on close
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          isConnecting = false;
          
          // Try to reconnect with backoff
          if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            retryCount++;
            console.log(`Retry attempt ${retryCount}/${maxRetries} in ${delay}ms`);
            setTimeout(connect, delay);
          } else {
            console.log(`Max retries reached (${maxRetries}). Using fallback mode.`);
          }
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        isConnecting = false;
      }
    };
    
    // Start connection
    connect();
    
    // Cleanup WebSocket on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [sessionId, state.stage]);

  return {
    state,
    isProcessing,
    lastResponse,
    sendMessage: process.env.NODE_ENV === 'development' ? mockSendMessage : sendMessage,
    interrupt,
    resetConversation
  }
}

export default useConversationEngine 