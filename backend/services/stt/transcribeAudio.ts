import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile } from 'fs/promises';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionResult {
  text: string;
  error?: string;
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
  try {
    // Create a temporary file
    const tempFilePath = join(tmpdir(), `audio-${Date.now()}.wav`);
    await writeFile(tempFilePath, audioBuffer);

    // Create a readable stream from the temporary file
    const audioStream = createReadStream(tempFilePath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "en", // Optional: specify language for better accuracy
    });

    return {
      text: transcription.text,
    };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
} 