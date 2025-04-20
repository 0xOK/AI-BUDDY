import { Voice, VoiceSettings } from 'elevenlabs/api';

// Eleven Labs API key from environment variables
const API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY;

// Voice ID to use (this is a default voice, but you can use any voice ID from your Eleven Labs account)
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Rachel voice

/**
 * Generate speech using Eleven Labs API
 * @param text Text to convert to speech
 * @param voiceId Optional voice ID to use (defaults to 'Rachel')
 * @returns Audio data as ArrayBuffer
 */
export async function generateSpeech(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<ArrayBuffer | null> {
  if (!API_KEY) {
    console.error('Eleven Labs API key not found');
    return null;
  }

  try {
    console.log('Generating Eleven Labs speech for:', text);
    
    // Set up the request parameters
    const options = {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    };

    // Make the API request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      options
    );

    if (!response.ok) {
      throw new Error(`Eleven Labs API error: ${response.status} ${response.statusText}`);
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();
    console.log('Eleven Labs speech generated successfully');
    
    return audioData;
  } catch (error) {
    console.error('Error generating Eleven Labs speech:', error);
    return null;
  }
}

/**
 * Get available voices from Eleven Labs
 * @returns List of available voices
 */
export async function getVoices(): Promise<Voice[]> {
  if (!API_KEY) {
    console.error('Eleven Labs API key not found');
    return [];
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Eleven Labs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Error fetching voices:', error);
    return [];
  }
} 