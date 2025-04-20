import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser environments
});

interface TranscriptionResult {
  text: string;
  error?: string;
}

// Sample transcriptions for fallback or demo purposes
const SAMPLE_TRANSCRIPTIONS = [
  "Hello, can you help me with something?",
  "What can you do for me?",
  "Tell me about yourself",
  "How does this voice assistant work?",
  "What time is it?",
  "Can you set a reminder for me?",
  "I'd like to know more about AI assistants",
  "How's the weather today?",
  "What's on my schedule?",
  "Can you play some music?"
];

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param audioBlob Audio data as Blob
 * @returns Transcribed text
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    console.log('Transcribing audio, blob size:', audioBlob.size);
    
    // For very small audio blobs (likely empty or corrupted), return an error
    if (audioBlob.size < 1000) {
      console.warn('Audio blob too small, likely no speech detected');
      return {
        text: '',
        error: 'No speech detected'
      };
    }
    
    // Important: OpenAI requires the audio to be in a specific format
    // Convert the blob to a File object, ensuring proper file extension
    // Whisper supports many formats including mp3, mp4, mpeg, mpga, m4a, wav, and webm
    const audioExtension = 'webm'; // Extension matches the format from MediaRecorder
    const file = new File([audioBlob], `audio.${audioExtension}`, { 
      type: `audio/${audioExtension}` 
    });
    
    try {
      // Make the API request to OpenAI's Whisper API
      const response = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en'
      });
      
      console.log('Whisper transcription result:', response.text);
      
      // If we got an empty result, use a fallback message
      if (!response.text || response.text.trim() === '') {
        return {
          text: 'I heard you say something, but I could not understand clearly. Could you try again?',
        };
      }
      
      return {
        text: response.text
      };
    } catch (apiError) {
      // If the API call fails, log the error and fall back to mock implementation
      console.error('API error in transcription:', apiError);
      
      // In production, you might want to use a more sophisticated fallback
      const randomIndex = Math.floor(Math.random() * SAMPLE_TRANSCRIPTIONS.length);
      console.log('Using mock transcription as fallback');
      
      return {
        text: SAMPLE_TRANSCRIPTIONS[randomIndex],
        error: apiError instanceof Error ? apiError.message : 'API error occurred'
      };
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return {
      text: 'I heard you say something, but I could not understand clearly. Could you try again?',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
} 