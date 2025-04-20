import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  error?: string;
}

export async function generateResponse(messages: Message[]): Promise<ChatResponse> {
  try {
    // Add system message if it doesn't exist
    const systemMessage = messages.find(msg => msg.role === 'system');
    const messagesWithSystem = systemMessage 
      ? [...messages]
      : [
          {
            role: "system" as const,
            content: "You are a helpful voice assistant. Keep your responses concise and natural-sounding for voice interaction."
          },
          ...messages
        ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 150,
    });

    return {
      text: completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.",
    };
  } catch (error) {
    console.error('Error generating response:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// For backward compatibility
export async function generateResponseFromPrompt(prompt: string): Promise<ChatResponse> {
  return generateResponse([
    {
      role: "user",
      content: prompt
    }
  ]);
} 