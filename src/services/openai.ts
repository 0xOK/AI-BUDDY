import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser environments
});

interface ChatResponse {
  text: string;
  error?: string;
}

/**
 * Generate a response using OpenAI's chat completion API
 * @param prompt User's message
 * @returns Generated response text
 */
export async function generateChatResponse(prompt: string): Promise<ChatResponse> {
  try {
    console.log('Generating chat response for:', prompt);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using gpt-3.5-turbo for faster/cheaper responses
      messages: [
        {
          role: "system",
          content: "You are Buddy, a helpful assistant from Binaryx. Keep your responses concise and natural-sounding for voice interaction. Be friendly and helpful."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const responseText = completion.choices[0]?.message?.content || 
      "I'm sorry, I couldn't generate a response.";
    
    console.log('Generated response:', responseText);
    
    return {
      text: responseText,
    };
  } catch (error) {
    console.error('Error generating chat response:', error);
    return {
      text: "I'm sorry, I'm having trouble connecting to my brain right now. Could you try again?",
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate speech from text using OpenAI's TTS API
 * @param text Text to convert to speech
 * @returns Audio data as ArrayBuffer
 */
export async function generateSpeech(text: string): Promise<ArrayBuffer | null> {
  try {
    console.log('Generating speech for:', text);
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // Options: alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    const buffer = await mp3.arrayBuffer();
    console.log('Speech generated successfully');
    
    return buffer;
  } catch (error) {
    console.error('Error generating speech:', error);
    return null;
  }
} 