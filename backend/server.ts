import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { VoiceSocket } from './websocket/voiceSocket';
import { ConversationSocket } from './websocket/conversationSocket';
import conversationRoutes from './routes/conversation';

// Extend WebSocket type for ping/pong
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
}

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Create WebSocket servers
const voiceWss = new WebSocketServer({ 
  server,
  path: '/ws/voice'
});

const conversationWss = new WebSocketServer({
  server,
  path: '/ws/conversation'
});

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/conversation', conversationRoutes);

// Define message schema for legacy endpoint
const messageSchema = z.object({
  message: z.string(),
  userId: z.string().optional(),
});

// Legacy API endpoint - redirects to the new conversation endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const validatedData = messageSchema.parse(req.body);
    
    // Forward to the new endpoint structure
    const response = await fetch(`http://localhost:${req.socket.localPort}/api/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: validatedData.message,
        state: {
          sessionId: validatedData.userId || 'anonymous',
          turnCount: 0,
          stage: 'onboarding',
          history: []
        }
      })
    });
    
    const data = await response.json();
    res.json(data.response);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Voice WebSocket connection
voiceWss.on('connection', (ws, req) => {
  console.log(`New client connected to voice stream from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
  
  // Add a ping-pong to keep the connection alive and detect disconnections
  const extWs = ws as ExtendedWebSocket;
  extWs.isAlive = true;
  ws.on('pong', () => {
    (ws as ExtendedWebSocket).isAlive = true;
  });
  
  // Create a new VoiceSocket instance for each connection
  new VoiceSocket(ws);
});

// Conversation WebSocket connection
conversationWss.on('connection', (ws, req) => {
  console.log(`New client connected to conversation stream from ${req.socket.remoteAddress}:${req.socket.remotePort}`);
  
  // Add a ping-pong to keep the connection alive and detect disconnections
  const extWs = ws as ExtendedWebSocket;
  extWs.isAlive = true;
  ws.on('pong', () => {
    (ws as ExtendedWebSocket).isAlive = true;
  });
  
  // Create a new ConversationSocket instance for each connection
  new ConversationSocket(ws);
});

// Setup interval to check for closed connections
const interval = setInterval(() => {
  voiceWss.clients.forEach((ws) => {
    const extWs = ws as ExtendedWebSocket;
    if (!extWs.isAlive) return ws.terminate();
    
    extWs.isAlive = false;
    ws.ping();
  });
  
  conversationWss.clients.forEach((ws) => {
    const extWs = ws as ExtendedWebSocket;
    if (!extWs.isAlive) return ws.terminate();
    
    extWs.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

// Clear interval when server closes
server.on('close', () => {
  clearInterval(interval);
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

// Function to start server with port fallback
function startServer(port: number, retries = 3) {
  try {
    // First check if port is available
    const testServer = http.createServer();
    
    // Set up error and listening handlers
    testServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && retries > 0) {
        console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
        testServer.close();
        startServer(port + 1, retries - 1);
      } else {
        console.error(`Failed to start server: ${err.message}`);
        process.exit(1);
      }
    });
    
    testServer.on('listening', () => {
      // Port is available, close test server and start real one
      testServer.close(() => {
        // Start the actual server on the available port
        server.listen(port)
          .on('listening', () => {
            console.log(`Server running on port ${port}`);
            console.log(`Voice WebSocket available at ws://localhost:${port}/ws/voice`);
            console.log(`Conversation WebSocket available at ws://localhost:${port}/ws/conversation`);
            console.log(`Conversation API available at http://localhost:${port}/api/conversation`);
          })
          .on('error', (err: any) => {
            console.error(`Error starting server on port ${port}:`, err.message);
            if (retries > 0) {
              startServer(port + 1, retries - 1);
            } else {
              console.error('Maximum retries reached. Exiting.');
              process.exit(1);
            }
          });
      });
    });
    
    // Check if port is free
    testServer.listen(port);
    
  } catch (error) {
    console.error('Error during server startup:', error);
    if (retries > 0) {
      // Try next port
      startServer(port + 1, retries - 1);
    } else {
      console.error('Maximum retries reached. Exiting.');
      process.exit(1);
    }
  }
}

// Set up graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
});

// Start server with fallback ports
startServer(Number(PORT));