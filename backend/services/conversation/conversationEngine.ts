import OpenAI from 'openai';
import { generateResponse, generateResponseFromPrompt, ChatResponse } from '../llm/generateResponse';
import { fetchAllScripts, fetchScriptByStage } from '../supabase/fetchScripts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ConversationResponse {
  type: 'text' | 'redirect';
  content: string;
  redirectUrl?: string;
}

interface UserMessage {
  text: string;
  userId?: string;
}

interface Script {
  id: number;
  prompt: string;
  stage: number;
  created_at: string;
  active: boolean;
}

export class ConversationEngine {
  private context: string[] = [];
  private currentStage: number = 1;
  private isOnboarding: boolean = true;
  private scripts: Script[] = [];

  constructor() {
    // Load scripts immediately but don't await
    this.loadScripts().catch(error => {
      console.error('Failed to load scripts during initialization:', error);
      // Already handled in loadScripts by setting empty array
    });
  }

  private async loadScripts() {
    try {
      console.log('Loading conversation scripts...');
      const scripts = await fetchAllScripts();
      
      // Ensure we have valid scripts array
      if (Array.isArray(scripts) && scripts.length > 0) {
        this.scripts = scripts;
        console.log(`Loaded ${scripts.length} conversation scripts successfully`);
      } else {
        console.warn('No scripts loaded, will use fallbacks');
        this.scripts = [];
      }
    } catch (error) {
      console.error('Error loading scripts:', error);
      this.scripts = [];
    }
  }

  // Get a fallback response when scripts aren't available
  private getFallbackResponse(stage: number): string {
    const fallbacks = [
      "Hello! I'm your AI assistant. How can I help you today?",
      "I see you're interested in our services. Would you like to learn more about our features?",
      "Great! Would you like to register to get full access to all features?"
    ];
    
    // If stage is out of bounds, return the first one
    if (stage < 1 || stage > fallbacks.length) {
      return fallbacks[0];
    }
    
    return fallbacks[stage - 1];
  }

  private getCurrentScript(): Script | null {
    const script = this.scripts.find(script => script.stage === this.currentStage);
    
    if (!script) {
      console.warn(`No script found for stage ${this.currentStage}, using fallback`);
    }
    
    return script || null;
  }

  private async advanceStage() {
    this.currentStage++;
    if (this.currentStage > 3) {
      this.isOnboarding = false;
    }
  }

  async processMessage(message: UserMessage): Promise<ConversationResponse> {
    try {
      // Add message to context
      this.context.push(message.text);

      let response: ChatResponse;

      if (this.isOnboarding) {
        const currentScript = this.getCurrentScript();
        if (currentScript) {
          // Use script-based response
          response = {
            text: currentScript.prompt,
            error: undefined,
          };
        } else {
          // No script available, use fallback
          response = {
            text: this.getFallbackResponse(this.currentStage),
            error: undefined,
          };
        }
        
        // Advance to next stage
        await this.advanceStage();
      } else {
        // Use LLM for normal conversation
        try {
          response = await generateResponseFromPrompt(message.text);
        } catch (llmError) {
          console.error('Error generating LLM response:', llmError);
          response = {
            text: "I'm sorry, I'm having trouble processing your request right now. Could you try again?",
            error: undefined,
          };
        }
      }

      // Check if response contains a redirect action
      if (response.text.includes('REDIRECT:')) {
        const redirectUrl = response.text.split('REDIRECT:')[1].trim();
        return {
          type: 'redirect',
          content: 'Redirecting you to the requested page...',
          redirectUrl
        };
      }

      // Add response to context
      this.context.push(response.text);

      return {
        type: 'text',
        content: response.text
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        type: 'text',
        content: 'I apologize, but I encountered an error processing your message.'
      };
    }
  }

  clearContext() {
    this.context = [];
    this.currentStage = 1;
    this.isOnboarding = true;
  }
} 