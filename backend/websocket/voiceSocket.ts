import { WebSocket } from 'ws';
import { transcribeAudio } from '../services/stt/transcribeAudio';
import { generateResponse } from '../services/llm/generateResponse';
import { synthesizeSpeech } from '../services/tts/synthesizeSpeech';
import { ConversationEngine } from '../services/conversation/conversationEngine';

export interface VoiceMessage {
  type: 'audio' | 'control';
  data: Buffer | string;
}

export class VoiceSocket {
  private ws: WebSocket;
  private audioBuffer: Buffer[] = [];
  private conversationEngine: ConversationEngine;
  private isProcessing: boolean = false;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.conversationEngine = new ConversationEngine();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.ws.on('message', (data: Buffer | string) => {
      try {
        if (Buffer.isBuffer(data)) {
          this.handleAudioData(data);
        } else {
          const message = JSON.parse(data);
          this.handleControlMessage(message);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        this.sendError('Invalid message format');
      }
    });

    this.ws.on('close', () => {
      console.log('Voice WebSocket connection closed');
      this.audioBuffer = [];
    });
  }

  private async handleAudioData(data: Buffer): Promise<void> {
    try {
      // Add the audio chunk to our buffer
      this.audioBuffer.push(data);

      // If we have enough audio data (e.g., 5 seconds worth), process it
      if (this.audioBuffer.length >= 20 && !this.isProcessing) { // Adjust this threshold based on your needs
        this.isProcessing = true;
        const completeBuffer = Buffer.concat(this.audioBuffer);
        const transcriptionResult = await transcribeAudio(completeBuffer);

        if (transcriptionResult.error) {
          this.sendError(transcriptionResult.error);
        } else {
          // Send transcription to client
          this.sendMessage({
            type: 'transcription',
            text: transcriptionResult.text,
          });

          // Process the message through the conversation engine
          const assistantResponse = await this.conversationEngine.processMessage(transcriptionResult.text);

          if (assistantResponse.type === 'redirect') {
            // Send redirect message to client
            this.sendMessage({
              type: 'redirect',
              to: assistantResponse.redirectUrl,
            });
          } else {
            // Send text response to client
            this.sendMessage({
              type: 'response',
              text: assistantResponse.content,
            });

            // Generate speech from response
            const speechResult = await synthesizeSpeech(assistantResponse.content);
            
            if (speechResult.error) {
              this.sendError(speechResult.error);
            } else {
              // Send audio data in chunks
              const CHUNK_SIZE = 4096;
              const audioBuffer = speechResult.audioBuffer;
              
              for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
                const chunk = audioBuffer.slice(i, i + CHUNK_SIZE);
                this.sendAudio(chunk);
              }
            }
          }
        }

        // Clear the buffer after processing
        this.audioBuffer = [];
        this.isProcessing = false;
      }
    } catch (error) {
      console.error('Error processing audio data:', error);
      this.sendError('Error processing audio data');
      this.isProcessing = false;
    }
  }

  private handleControlMessage(message: any): void {
    console.log('Received control message:', message);
    // Handle control messages (e.g., stop playback, pause, etc.)
    if (message.type === 'stop') {
      this.audioBuffer = [];
      this.isProcessing = false;
    }
  }

  public sendAudio(audioData: Buffer): void {
    this.ws.send(audioData);
  }

  public sendMessage(message: any): void {
    this.ws.send(JSON.stringify(message));
  }

  private sendError(message: string): void {
    this.sendMessage({ type: 'error', message });
  }
} 