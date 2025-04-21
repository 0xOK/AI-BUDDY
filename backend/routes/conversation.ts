import express, { Request, Response } from 'express';
import { ConversationEngine, ConversationState, handleUserMessage } from '../agents/conversationEngine';

const router = express.Router();

// Store active conversations in memory (in production, use a proper database)
const activeConversations = new Map<string, ConversationEngine>();

// Types for request body
interface ConversationRequest {
  input: string;
  state?: ConversationState;
  interrupted?: boolean;
}

/**
 * Process a message using the conversation engine
 * POST /api/conversation
 */
router.post('/', async (req: Request<{}, any, ConversationRequest>, res: Response) => {
  try {
    const { input, state, interrupted = false } = req.body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid input parameter' });
    }

    let conversationEngine: ConversationEngine;
    const sessionId = state?.sessionId || 'anonymous';

    // If a full state is provided, use that directly
    if (state) {
      // Get or create a conversation engine for this session
      if (!activeConversations.has(sessionId)) {
        conversationEngine = new ConversationEngine(sessionId);
        activeConversations.set(sessionId, conversationEngine);
      } else {
        conversationEngine = activeConversations.get(sessionId)!;
        conversationEngine.setState(state as ConversationState);
      }

      // Process the message
      const response = await conversationEngine.processMessage(input, interrupted);
      
      // Return the response and updated state
      return res.json({
        response,
        updatedState: conversationEngine.getState()
      });
    } else {
      // If no state is provided, use the handleUserMessage function directly
      // Create a new conversation state
      const newState: ConversationState = {
        turnCount: 0,
        stage: 'onboarding',
        history: [],
        sessionId,
        lastInterrupted: false
      };
      
      // Process the message
      const { response, updatedState } = await handleUserMessage(input, newState, interrupted);
      
      // Store the conversation engine for future requests
      conversationEngine = new ConversationEngine(sessionId);
      conversationEngine.setState(updatedState);
      activeConversations.set(sessionId, conversationEngine);
      
      return res.json({
        response,
        updatedState
      });
    }
  } catch (error) {
    console.error('Error processing conversation:', error);
    return res.status(500).json({ 
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Type for route parameters
interface SessionIdParams {
  sessionId: string;
}

/**
 * Reset a conversation
 * DELETE /api/conversation/:sessionId
 */
router.delete('/:sessionId', (req: Request<SessionIdParams>, res: Response) => {
  const { sessionId } = req.params;
  
  if (activeConversations.has(sessionId)) {
    activeConversations.get(sessionId)!.reset(sessionId);
    return res.json({ success: true, message: 'Conversation reset' });
  } else {
    return res.status(404).json({ error: 'Conversation not found' });
  }
});

export default router; 