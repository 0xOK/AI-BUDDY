import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/voice' });

// Serve the test client HTML file
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'test-voice-client.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  let audioChunks = [];
  let isProcessing = false;
  
  ws.on('message', (message) => {
    try {
      // Check if the message is binary (audio data)
      if (Buffer.isBuffer(message)) {
        console.log(`Received binary data: ${message.length} bytes`);
        audioChunks.push(message);
        
        // If we have enough chunks (simulating enough audio data), send a response
        if (audioChunks.length >= 5 && !isProcessing) {
          isProcessing = true;
          
          // Simulate processing delay
          setTimeout(() => {
            // Send back a transcription
            ws.send(JSON.stringify({
              type: 'transcription',
              text: 'This is a simulated transcription of your voice input.'
            }));
            
            // Wait a bit and send a response
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'response',
                text: 'This is a simulated response to your voice input. The voice service is working correctly!'
              }));
              
              // Clear the audio chunks
              audioChunks = [];
              isProcessing = false;
            }, 500);
          }, 1000);
        }
      } else {
        // Parse string messages
        const parsedMessage = JSON.parse(message.toString());
        console.log('Received JSON message:', parsedMessage);
        
        if (parsedMessage.type === 'start-recording') {
          console.log('Client started recording');
          audioChunks = [];
        } else if (parsedMessage.type === 'stop-recording') {
          console.log('Client stopped recording');
          
          // If we have any audio chunks, process them
          if (audioChunks.length > 0 && !isProcessing) {
            isProcessing = true;
            
            // Simulate processing
            setTimeout(() => {
              // Send back a transcription
              ws.send(JSON.stringify({
                type: 'transcription',
                text: 'This is a simulated transcription from your complete recording.'
              }));
              
              // Wait a bit and send a response
              setTimeout(() => {
                ws.send(JSON.stringify({
                  type: 'response',
                  text: 'This is a simulated response to your complete recording. The voice service is working correctly!'
                }));
                
                // Clear the audio chunks
                audioChunks = [];
                isProcessing = false;
              }, 500);
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing your input'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
  
  // Send a welcome message
  ws.send(JSON.stringify({
    type: 'info',
    message: 'Connected to Voice WebSocket Server'
  }));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/voice`);
}); 