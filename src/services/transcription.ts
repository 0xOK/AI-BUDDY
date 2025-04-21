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

// Helper function to convert audio to a proper format (used only if needed)
async function convertAudioFormat(audioBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Create an audio context
      const audioContext = new AudioContext();
      
      // Create audio element to use for conversion
      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(audioBlob);
      
      // Create media source node
      const source = audioContext.createMediaElementSource(audioElement);
      
      // Create destination node
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect nodes
      source.connect(destination);
      
      // Create a new media recorder with WAV format
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/wav'
      });
      
      const chunks: Blob[] = [];
      
      // Collect data
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      // When finished, resolve with the combined blob
      mediaRecorder.onstop = () => {
        const wavBlob = new Blob(chunks, { type: 'audio/wav' });
        resolve(wavBlob);
      };
      
      // Start recording and playing
      mediaRecorder.start();
      audioElement.play();
      
      // Stop when audio finishes playing
      audioElement.onended = () => {
        mediaRecorder.stop();
        audioContext.close();
      };
      
      // Set a timeout in case the audio is too long
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          audioContext.close();
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.error('Error converting audio format:', error);
      // Return the original blob if conversion fails
      resolve(audioBlob);
    }
  });
}

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param audioBlob Audio data as Blob
 * @returns Transcribed text
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    console.log('Transcribing audio, blob size:', audioBlob.size, 'blob type:', audioBlob.type);
    
    // For very small audio blobs (likely empty or corrupted), return an error
    if (audioBlob.size < 2000) {
      console.warn('Audio blob too small (< 2KB), likely no speech detected');
      return {
        text: '',
        error: 'No speech detected or recording too short'
      };
    }
    
    // Always return mock transcription in development mode to avoid API calls
    if (process.env.NODE_ENV === 'development') {
      const mockText = SAMPLE_TRANSCRIPTIONS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTIONS.length)];
      console.log('DEV MODE: Using mock transcription:', mockText);
      return { text: mockText };
    }
    
    // Try to convert the audio to a reliable format
    let finalBlob = audioBlob;
    
    // Set these to WAV format (most reliably decoded by OpenAI's API)
    let mimeType = 'audio/wav';
    let fileExtension = 'wav';
    
    // Log the file creation
    console.log(`Creating file with extension: ${fileExtension}, MIME type: ${mimeType}`);
    
    // Create a new file with the proper MIME type and extension
    const file = new File([finalBlob], `audio.${fileExtension}`, { 
      type: mimeType
    });
    
    try {
      // Make the API request to OpenAI's Whisper API
      console.log(`Sending file to OpenAI: size=${file.size}, type=${file.type}, name=${file.name}`);
      
      // Add a check for silent audio based on file size
      if (file.size < 5000) {
        console.warn('File size is very small, might be silent audio');
        
        // In development, return a mock for testing
        if (process.env.NODE_ENV === 'development') {
          const mockText = SAMPLE_TRANSCRIPTIONS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTIONS.length)];
          console.log('DEV MODE: Using mock transcription for small audio:', mockText);
          return { text: mockText };
        }
        
        return {
          text: '',
          error: 'Recording appears to be silent or too short'
        };
      }
      
      const response = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en'
      });
      
      console.log('Whisper transcription result:', response.text);
      
      // If we got an empty result, use a fallback message
      if (!response.text || response.text.trim() === '') {
        return {
          text: '',
          error: 'No speech detected or too quiet'
        };
      }
      
      return {
        text: response.text
      };
    } catch (apiError) {
      // If the API call fails, log the error and fall back to mock implementation
      console.error('API error in transcription:', apiError);
      
      // In development mode, always use mock transcription
      if (process.env.NODE_ENV === 'development') {
        const mockText = SAMPLE_TRANSCRIPTIONS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTIONS.length)];
        console.log('DEV MODE: Using mock transcription after API error:', mockText);
        return { text: mockText };
      }
      
      // If in development mode and the error is about unsupported format, provide helpful info
      if (process.env.NODE_ENV === 'development' && 
          apiError instanceof Error && 
          apiError.message.includes('Invalid file format')) {
        console.warn('File format issue - OpenAI supports: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm');
        console.warn('Current file type:', file.type);
        console.warn('Try adjusting the audio recording format in useVoiceStream.ts');
        console.warn('We will attempt to use the mock transcription service as a fallback');
        
        // Return a random mock transcription for testing purposes (DEV only)
        if (process.env.NODE_ENV === 'development') {
          const mockTranscription = SAMPLE_TRANSCRIPTIONS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTIONS.length)];
          console.log('Using mock transcription for development:', mockTranscription);
          return {
            text: mockTranscription
          };
        }
      }
      
      // Return an error instead of mock transcription
      return {
        text: '',
        error: apiError instanceof Error ? apiError.message : 'API error occurred'
      };
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 