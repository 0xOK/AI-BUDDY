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
          const message = JSON.parse(data.toString());
          this.handleControlMessage(message);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        try {
          this.sendError('Invalid message format');
        } catch (sendError) {
          console.error('Error sending error response:', sendError);
        }
      }
    });

    this.ws.on('close', () => {
      console.log('Voice WebSocket connection closed');
      this.audioBuffer = [];
    });
    
    this.ws.on('error', (error) => {
      console.error('Voice WebSocket error:', error);
      // Don't try to send error messages on a failed socket
    });
    
    // Send a welcome message to confirm connection
    try {
      this.sendMessage({
        type: 'info',
        text: 'Connected to voice service'
      });
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  private async handleAudioData(data: Buffer): Promise<void> {
    try {
      // Add the audio chunk to our buffer
      this.audioBuffer.push(data);

      // If we have enough audio data (e.g., 5 seconds worth), process it
      if (this.audioBuffer.length >= 5 && !this.isProcessing) { // Reduced threshold for testing
        this.isProcessing = true;

        try {
          // Send transcription to client (mock for now)
          this.sendMessage({
            type: 'transcription',
            text: 'This is a test transcription. Audio processing is working!',
          });

          // Send text response to client
          this.sendMessage({
            type: 'response',
            text: 'I received your audio data successfully. This is a test response.',
          });
        } catch (innerError) {
          console.error('Error in audio processing:', innerError);
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
    
    // Handle different control messages
    if (message.type === 'start-recording') {
      console.log('Starting new recording');
      this.audioBuffer = [];
      this.isProcessing = false;
      this.sendMessage({
        type: 'info',
        text: 'Started recording session',
      });
    } 
    else if (message.type === 'stop-recording') {
      console.log('Stopping recording');
      // Process any remaining audio data if we have enough
      if (this.audioBuffer.length > 0) {
        // Send simple response for testing
        this.sendMessage({
          type: 'transcription',
          text: 'Recording complete. Processing final audio.',
        });
        
        this.sendMessage({
          type: 'response',
          text: 'I\'ve processed your recording. Thank you for testing the voice service!',
        });
      }
      
      // Clear the buffer
      this.audioBuffer = [];
      this.isProcessing = false;
    }
    else if (message.type === 'stop') {
      this.audioBuffer = [];
      this.isProcessing = false;
    }
  }

  public sendAudio(audioData: Buffer): void {
    this.ws.send(audioData);
  }

  public sendMessage(message: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message:', error);
      }
    } else {
      console.warn(`Cannot send message: WebSocket is not open (state: ${this.ws.readyState})`);
    }
  }

  private sendError(message: string): void {
    try {
      this.sendMessage({ type: 'error', message });
    } catch (error) {
      console.error('Error sending error message:', error);
    }
  }
} 