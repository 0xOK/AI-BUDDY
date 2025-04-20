import { generateResponse, Message as LLMMessage } from '../services/llm/generateResponse';
import { fetchScriptByStage } from '../services/supabase/fetchScripts';

// Registration keywords to detect
const REGISTRATION_KEYWORDS = [
  'register', 
  'sign up', 
  'create account', 
  'registration', 
  'sign me up',
  'create a profile',
  'make an account',
  'yes'
];

interface ConversationContext {
  sessionId: string;
  messages: LLMMessage[];
  turnCount: number;
  scriptStage: number;
  isUsingScript: boolean;
}

interface ConversationResponse {
  text: string;
  action?: 'continue' | 'redirect';
  to?: string;
  error?: string;
}

/**
 * Conversation Engine handles the conversation logic including:
 * - Tracking turns
 * - Using Supabase scripts for onboarding
 * - Detecting registration intents
 * - Generating responses from LLM
 */
export class ConversationEngine {
  private context: ConversationContext;
  private MAX_SCRIPT_STAGE = 3; // After this stage, we switch to LLM responses
  private REGISTRATION_PROMPT_TURN = 3; // On this turn, we ask about registration

  constructor(sessionId: string = '') {
    this.context = {
      sessionId,
      messages: [],
      turnCount: 0,
      scriptStage: 1,
      isUsingScript: true
    };
  }

  /**
   * Process a message from the user and generate a response
   */
  public async processMessage(message: string): Promise<ConversationResponse> {
    // Add user message to context
    this.context.messages.push({
      role: 'user',
      content: message
    });

    // Increment turn count
    this.context.turnCount++;

    try {
      // Check if we should prompt for registration
      if (this.context.turnCount === this.REGISTRATION_PROMPT_TURN) {
        const response = {
          text: "I hope I've been helpful. Would you like to register an account to save our conversation history?",
          action: 'continue' as const
        };

        // Add assistant message to context
        this.context.messages.push({
          role: 'assistant',
          content: response.text
        });

        return response;
      }

      // Check if the user's message contains registration intent
      if (this.context.turnCount > this.REGISTRATION_PROMPT_TURN && 
          this.hasRegistrationIntent(message)) {
        const response = {
          text: "Great! I'll take you to the registration page now.",
          action: 'redirect' as const,
          to: '/register'
        };

        // Add assistant message to context
        this.context.messages.push({
          role: 'assistant',
          content: response.text
        });

        return response;
      }

      // If we're still using scripts and haven't reached the max stage
      if (this.context.isUsingScript && this.context.scriptStage <= this.MAX_SCRIPT_STAGE) {
        // Get the appropriate script for this stage
        const script = await fetchScriptByStage(this.context.scriptStage);
        
        if (script) {
          const response = {
            text: script.prompt,
            action: 'continue' as const
          };

          // Add assistant message to context
          this.context.messages.push({
            role: 'assistant',
            content: response.text
          });

          // Advance to the next script stage
          this.context.scriptStage++;
          
          // If we reached the end of scripts, switch to LLM
          if (this.context.scriptStage > this.MAX_SCRIPT_STAGE) {
            this.context.isUsingScript = false;
          }

          return response;
        } else {
          // If script not found, fall back to LLM
          this.context.isUsingScript = false;
        }
      }

      // Use LLM to generate response
      const llmResponse = await generateResponse(this.context.messages);
      
      // Add assistant message to context
      this.context.messages.push({
        role: 'assistant',
        content: llmResponse.text
      });

      return {
        text: llmResponse.text,
        action: 'continue'
      };
    } catch (error) {
      console.error('Error in conversation engine:', error);
      return {
        text: "I'm sorry, I encountered an error processing your request.",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if text contains registration intent
   */
  private hasRegistrationIntent(text: string): boolean {
    const lowercaseText = text.toLowerCase();
    return REGISTRATION_KEYWORDS.some(keyword => lowercaseText.includes(keyword));
  }

  /**
   * Get the current conversation context
   */
  public getContext(): ConversationContext {
    return { ...this.context };
  }

  /**
   * Reset the conversation
   */
  public reset(sessionId: string = ''): void {
    this.context = {
      sessionId: sessionId || this.context.sessionId,
      messages: [],
      turnCount: 0,
      scriptStage: 1,
      isUsingScript: true
    };
  }
}

export default ConversationEngine; 