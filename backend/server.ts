import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { ConversationEngine } from './services/conversation/conversationEngine';
import { z } from 'zod';
import { VoiceSocket } from './websocket/voiceSocket';

// Define message interfaces
interface UserMessage {
  text: string;
  userId?: string;
}

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Create a WebSocket server for voice streaming
const wss = new WebSocketServer({ 
  server,
  path: '/ws/voice'
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize conversation engine
const conversationEngine = new ConversationEngine();

// Define message schema
const messageSchema = z.object({
  message: z.string(),
  userId: z.string().optional(),
});

// API endpoints
app.post('/api/chat', async (req, res) => {
  try {
    const validatedData = messageSchema.parse(req.body);
    const userMessage: UserMessage = {
      text: validatedData.message,
      userId: validatedData.userId
    };
    const response = await conversationEngine.processMessage(userMessage);
    
    res.json(response);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// WebSocket connection for voice streaming
wss.on('connection', (ws) => {
  console.log('New client connected to voice stream');
  
  // Create a new VoiceSocket instance for each connection
  new VoiceSocket(ws);
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Basic Express routes
app.get('/', (req, res) => {
  res.send('AI Assistant API is running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws/voice`);
});