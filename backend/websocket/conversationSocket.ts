import WebSocket from 'ws';
import { ConversationEngine } from '../agents/conversationEngine';

// Store active conversation sockets by sessionId
const activeConversationSockets = new Map<string, ConversationSocket>();

// Message types
interface ClientMessage {
  type: 'message' | 'interrupt' | 'reset';
  sessionId: string;
  input?: string;
  state?: any;
}

interface ServerMessage {
  type: 'response' | 'error' | 'state_update';
  response?: string;
  state?: any;
  error?: string;
}

/**
 * WebSocket handler for real-time conversation interactions
 */
export class ConversationSocket {
  private ws: WebSocket;
  private conversationEngine: ConversationEngine;
  private sessionId: string;
  private isProcessing: boolean = false;

  constructor(ws: WebSocket, sessionId: string = 'anonymous') {
    this.ws = ws;
    this.sessionId = sessionId;
    this.conversationEngine = new ConversationEngine(sessionId);
    
    // Store this socket in the active conversations
    activeConversationSockets.set(sessionId, this);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Send initial state
    this.sendMessage({
      type: 'state_update',
      state: this.conversationEngine.getState()
    });
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers() {
    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        
        // Update session ID if provided
        if (message.sessionId && message.sessionId !== this.sessionId) {
          // Remove from old session ID
          activeConversationSockets.delete(this.sessionId);
          
          // Update to new session ID
          this.sessionId = message.sessionId;
          this.conversationEngine.reset(this.sessionId);
          activeConversationSockets.set(this.sessionId, this);
        }
        
        // Handle message based on type
        switch (message.type) {
          case 'message':
            await this.handleMessage(message);
            break;
          case 'interrupt':
            this.handleInterrupt();
            break;
          case 'reset':
            this.handleReset();
            break;
          default:
            this.sendError('Unknown message type');
        }
      } catch (error) {
        console.error('Error processing message:', error);
        try {
          this.sendError('Failed to parse message');
        } catch (sendError) {
          console.error('Error sending error response:', sendError);
        }
      }
    });
    
    this.ws.on('close', () => {
      // Remove from active sockets
      console.log(`Conversation WebSocket closed for session ${this.sessionId}`);
      activeConversationSockets.delete(this.sessionId);
    });
    
    this.ws.on('error', (error) => {
      console.error(`WebSocket error for session ${this.sessionId}:`, error);
      try {
        this.sendError('WebSocket error occurred');
      } catch (sendError) {
        console.error('Error sending error response:', sendError);
      }
      
      // Ensure socket is removed from active sockets map on error
      activeConversationSockets.delete(this.sessionId);
    });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(message: ClientMessage) {
    if (!message.input) {
      return this.sendError('Missing input parameter');
    }
    
    // Don't process if already processing a message
    if (this.isProcessing) {
      return this.sendError('Already processing a message');
    }
    
    this.isProcessing = true;
    
    try {
      // If state provided, update the conversation engine
      if (message.state) {
        this.conversationEngine.setState(message.state);
      }
      
      // Process the message
      const response = await this.conversationEngine.processMessage(message.input);
      
      // Send response back to client
      this.sendMessage({
        type: 'response',
        response: response.response,
        state: this.conversationEngine.getState()
      });
    } catch (error) {
      this.sendError('Failed to process message');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle interruption request
   */
  private handleInterrupt() {
    if (this.isProcessing) {
      // Mark as interrupted for next request
      const state = this.conversationEngine.getState();
      state.lastInterrupted = true;
      this.conversationEngine.setState(state);
      
      // Send state update
      this.sendMessage({
        type: 'state_update',
        state: this.conversationEngine.getState()
      });
    }
    
    this.isProcessing = false;
  }

  /**
   * Handle reset request
   */
  private handleReset() {
    this.conversationEngine.reset(this.sessionId);
    
    // Send state update
    this.sendMessage({
      type: 'state_update',
      state: this.conversationEngine.getState()
    });
  }

  /**
   * Send message to client
   */
  private sendMessage(message: ServerMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to session ${this.sessionId}:`, error);
      }
    } else {
      console.warn(`Cannot send message: WebSocket for session ${this.sessionId} is not open (state: ${this.ws.readyState})`);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(errorMessage: string) {
    this.sendMessage({
      type: 'error',
      error: errorMessage
    });
  }

  /**
   * Get the conversation engine instance
   */
  public getConversationEngine(): ConversationEngine {
    return this.conversationEngine;
  }
}

/**
 * Get an active conversation socket by session ID
 */
export function getConversationSocket(sessionId: string): ConversationSocket | undefined {
  return activeConversationSockets.get(sessionId);
}

/**
 * Interrupt a conversation by session ID
 */
export function interruptConversation(sessionId: string): boolean {
  const socket = activeConversationSockets.get(sessionId);
  
  if (socket) {
    socket.getConversationEngine().setState({
      ...socket.getConversationEngine().getState(),
      lastInterrupted: true
    });
    return true;
  }
  
  return false;
} 