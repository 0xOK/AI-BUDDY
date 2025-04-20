import OpenAI from 'openai';
import { generateResponse, ChatResponse } from '../llm/generateResponse';
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
    this.loadScripts();
  }

  private async loadScripts() {
    try {
      this.scripts = await fetchAllScripts();
    } catch (error) {
      console.error('Error loading scripts:', error);
      this.scripts = [];
    }
  }

  private getCurrentScript(): Script | null {
    return this.scripts.find(script => script.stage === this.currentStage) || null;
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
          await this.advanceStage();
        } else {
          // Fallback to LLM if no script is available
          response = await generateResponse(message.text);
        }
      } else {
        // Use LLM for normal conversation
        response = await generateResponse(message.text);
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