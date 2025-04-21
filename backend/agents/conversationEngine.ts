import { createClient } from '@supabase/supabase-js';
import { generateResponse } from '../services/llm/generateResponse';
import { Database } from '../types/supabase';

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Fallback scripts to use when Supabase is unavailable
const FALLBACK_SCRIPTS = [
  { 
    id: 1, 
    stage: 1, 
    prompt: "Hello! I'm your AI assistant. How can I help you today?", 
    created_at: new Date().toISOString(),
    active: true 
  },
  { 
    id: 2, 
    stage: 2, 
    prompt: "I see you're interested in our services. Would you like to learn more about our features?", 
    created_at: new Date().toISOString(),
    active: true 
  },
  { 
    id: 3, 
    stage: 3, 
    prompt: "Great! Would you like to register to get full access to all features?", 
    created_at: new Date().toISOString(),
    active: true 
  }
];

// Initialize Supabase client
let supabase: any;
try {
  // Use ESM import (already imported at top)
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // Continue without Supabase - we'll use fallbacks
}

// Types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: string;
}

export interface ConversationState {
  turnCount: number;
  stage: 'onboarding' | 'free';
  history: Message[];
  sessionId?: string;
  lastInterrupted?: boolean;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
}

export type AssistantResponse = {
  response: string;
  action?: "redirect";
  to?: string;
  stage: "onboarding" | "free";
}

// Constants
const MAX_ONBOARDING_TURNS = 3; // After this many turns, switch to free-form conversation
const REGISTRATION_INTENT_REGEX = /\b(register|sign\s*up|create\s*account|yes|sure|okay|let'?s\s*do\s*it)\b/i;

// Filler phrases to make responses sound more natural
const NATURAL_LANGUAGE_FILLERS = [
  "Well, ", "So, ", "Hmm, ", "Let's see. ", "Actually, ", 
  "You know, ", "I think ", "Oh, ", "Right, "
];

/**
 * Fetch a script from Supabase based on the turn count
 */
async function fetchScriptFromSupabase(turnCount: number): Promise<string | null> {
  // Use fallback scripts if Supabase is not initialized or URL is missing
  if (!supabase || !supabaseUrl || !supabaseKey) {
    console.log('Using fallback script for stage:', turnCount);
    const fallbackScript = FALLBACK_SCRIPTS.find(s => s.stage === turnCount);
    return fallbackScript?.prompt || "I'm here to help. What can I do for you?";
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('prompt')
      .eq('stage', turnCount)
      .single();

    if (error) {
      console.error('Error fetching script:', error);
      // Use fallback if there's a Supabase error
      const fallbackScript = FALLBACK_SCRIPTS.find(s => s.stage === turnCount);
      return fallbackScript?.prompt || "I'm here to help. What can I do for you?";
    }

    return data?.prompt || null;
  } catch (error) {
    console.error('Error in fetchScriptFromSupabase:', error);
    // Use fallback if there's an exception
    const fallbackScript = FALLBACK_SCRIPTS.find(s => s.stage === turnCount);
    return fallbackScript?.prompt || "I'm here to help. What can I do for you?";
  }
}

/**
 * Make response sound more natural with occasional filler words
 */
function makeResponseNatural(response: string): string {
  // Add filler words about 30% of the time
  if (Math.random() < 0.3) {
    const filler = NATURAL_LANGUAGE_FILLERS[Math.floor(Math.random() * NATURAL_LANGUAGE_FILLERS.length)];
    return filler + response.charAt(0).toLowerCase() + response.slice(1);
  }
  return response;
}

/**
 * Generate a response using the LLM (ChatGPT)
 */
async function generateResponseWithLLM(text: string, history: Message[]): Promise<string> {
  try {
    // Prepare conversation history for the LLM
    const llmHistory = [
      {
        role: 'system' as const,
        content: 'You are Buddy, a helpful voice assistant. Be concise, friendly, and natural-sounding. Use conversational language and occasionally add brief pauses using commas. Limit responses to 2-3 sentences when possible. Respond as if in a real conversation.'
      },
      ...history
    ];

    // Generate response using the correct function signature
    const result = await generateResponse(llmHistory);
    return makeResponseNatural(result.text);
  } catch (error) {
    console.error('Error in generateResponseWithLLM:', error);
    
    // Fallback responses that sound natural
    const fallbacks = [
      "I'm sorry, I didn't catch that properly. Could you repeat that?",
      "Hmm, I'm having a bit of trouble understanding. Could you try saying that again?",
      "Sorry about that—my systems are being a little slow. Could you repeat your question?",
      "I seem to be having a moment. Could you say that again please?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

/**
 * Detect registration intent from user input
 */
function detectRegistrationIntent(text: string): boolean {
  return REGISTRATION_INTENT_REGEX.test(text);
}

/**
 * Main function to handle user messages
 * Implements the requirements in the PRD
 */
export async function handleUserMessage(
  input: string,
  state: ConversationState,
  interrupted: boolean = false
): Promise<{ response: AssistantResponse, updatedState: ConversationState }> {
  // Create a copy of the state to modify
  const updatedState: ConversationState = { ...state };
  
  // ✅ Requirement 1: Interrupt-Aware Response Handling
  if (interrupted && updatedState.history.length > 0) {
    console.log('Handling interruption');
    
    // If the last message was from the assistant, remove it (it was interrupted)
    if (updatedState.history[updatedState.history.length - 1].role === 'assistant') {
      updatedState.history.pop();
      console.log('Removed interrupted assistant message');
    }
    
    // Merge the new input with the previous user message if available
    if (updatedState.lastUserMessage) {
      input = `${updatedState.lastUserMessage} ${input}`;
      console.log('Merged with previous user message:', input);
    }
    
    updatedState.lastInterrupted = true;
  } else {
    updatedState.lastInterrupted = false;
  }

  // Store the current user message for potential future merges
  updatedState.lastUserMessage = input;
  
  // Add user message to history
  updatedState.history.push({
    role: 'user',
    content: input,
    timestamp: new Date().toISOString()
  });

  // Determine if we should advance to the next turn
  // Only increment turn if this is not an interruption
  if (!interrupted) {
    updatedState.turnCount++;
  }

  // ✅ Requirement 2: Smarter Conversation Stage Control
  // Check if we should switch from onboarding to free-form
  if (updatedState.stage === 'onboarding' && updatedState.turnCount > MAX_ONBOARDING_TURNS) {
    updatedState.stage = 'free';
    console.log('Switching to free-form conversation mode');
  }

  // ✅ Requirement 3: Inline Intent Detection
  // Check for registration intent in the user's message
  const hasRegistrationIntent = detectRegistrationIntent(input);
  if (hasRegistrationIntent) {
    console.log('Registration intent detected');
    const registrationResponse: AssistantResponse = {
      response: "Great! I'll redirect you to the registration page now.",
      action: "redirect",
      to: "/register",
      stage: updatedState.stage
    };

    // Store this assistant message
    updatedState.lastAssistantMessage = registrationResponse.response;
    
    // Add assistant response to history
    updatedState.history.push({
      role: 'assistant',
      content: registrationResponse.response,
      timestamp: new Date().toISOString()
    });

    return { response: registrationResponse, updatedState };
  }

  let responseText: string;

  try {
    // Generate response based on the current stage
    if (updatedState.stage === 'onboarding') {
      // For onboarding, use scripted responses from Supabase
      const script = await fetchScriptFromSupabase(updatedState.turnCount);
      
      // ✅ Requirement 4: Graceful Fallbacks
      if (script) {
        responseText = script;
      } else {
        // Fallback to default welcome or LLM if script is not found
        if (updatedState.turnCount === 1) {
          responseText = "Welcome! Let's get started. How can I help you today?";
        } else {
          // Fallback to LLM if not the first turn
          responseText = await generateResponseWithLLM(input, updatedState.history);
        }
      }
    } else {
      // For free-form conversation, use the LLM
      responseText = await generateResponseWithLLM(input, updatedState.history);
    }

    // After the 2nd onboarding response, ask about registration
    if (updatedState.stage === 'onboarding' && updatedState.turnCount === 2) {
      responseText += " Would you like to register an account with us?";
    }
  } catch (error) {
    // ✅ Requirement 4: Graceful Fallbacks
    console.error('Error generating response:', error);
    responseText = "I'm sorry, I didn't catch that. Can you repeat?";
  }

  // Store this assistant message
  updatedState.lastAssistantMessage = responseText;
  
  // ✅ Requirement 5: Update History Safely
  // Add assistant response to history
  updatedState.history.push({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString()
  });

  const response: AssistantResponse = {
    response: responseText,
    stage: updatedState.stage
  };

  return { response, updatedState };
}

/**
 * Create a new conversation state
 */
export function createConversationState(sessionId?: string): ConversationState {
  return {
    turnCount: 0,
    stage: 'onboarding',
    history: [],
    sessionId,
    lastInterrupted: false,
    lastUserMessage: undefined,
    lastAssistantMessage: undefined
  };
}

/**
 * Class-based implementation of the Conversation Engine
 */
export class ConversationEngine {
  private state: ConversationState;

  constructor(sessionId?: string) {
    this.state = createConversationState(sessionId);
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(input: string, interrupted: boolean = false): Promise<AssistantResponse> {
    const { response, updatedState } = await handleUserMessage(input, this.state, interrupted);
    
    // Update the internal state
    this.state = updatedState;
    
    return response;
  }

  /**
   * Get the current conversation state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Set the conversation state
   */
  setState(state: ConversationState): void {
    this.state = { ...state };
  }

  /**
   * Reset the conversation
   */
  reset(sessionId?: string): void {
    this.state = createConversationState(sessionId);
  }
}

export default ConversationEngine; 