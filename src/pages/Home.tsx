import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { VoiceButton } from '@/components/VoiceButton';
import { AssistantResponse } from '@/components/AssistantResponse';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useVoiceStream } from '@/hooks/useVoiceStream';
import { transcribeAudio } from '@/services/transcription';
import { generateChatResponse } from '@/services/openai';
import { generateSpeech as generateElevenLabsSpeech } from '@/services/elevenlabs';
import { generateSpeech as generateOpenAISpeech } from '@/services/openai';
import { useConversationEngine } from '@/hooks/useConversationEngine';

// Welcome message from Buddy
const WELCOME_MESSAGE = "Hi, my name is Buddy, I'm your Binaryx Assistant, how I can help?";

// Which TTS service to use
const USE_ELEVEN_LABS = false; // Set to true to use Eleven Labs, false to use OpenAI TTS

// Registration keywords to detect
const REGISTRATION_KEYWORDS = [
  'register', 
  'sign up', 
  'create account', 
  'registration', 
  'sign me up',
  'create a profile',
  'make an account'
];

// Example responses for the mock assistant
const MOCK_RESPONSES = [
  "I'm your AI assistant. How can I help you today?",
  "That's an interesting question. I'd be happy to help with that.",
  "I understand what you're asking. Let me think about that for a moment.",
  "Great question! Here's what I can tell you about that topic.",
  "I'm processing your request. Is there anything specific you'd like to know?",
  "Thanks for your question. I'm here to assist with whatever you need.",
  "I'm designed to help with a variety of tasks. What would you like to accomplish?",
  "I appreciate your patience. Let me formulate a thoughtful response.",
  "I'm here to make your day easier. How else can I assist you?",
  "I'm constantly learning and improving. Your questions help me get better."
];

// Example transcriptions for demo purposes
const MOCK_TRANSCRIPTIONS = [
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

export function Home() {
  const navigate = useNavigate();
  const { messages, addMessage, clearSession } = useSession();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [welcomeMessageShown, setWelcomeMessageShown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { playAudio, stopAudio, isPlaying } = useAudioPlayer();
  
  // Add conversation engine hook
  const {
    state: conversationState,
    isProcessing: isConversationProcessing,
    sendMessage: sendToConversationEngine,
    interrupt: interruptConversation,
    resetConversation
  } = useConversationEngine();
  
  // Debug logs
  useEffect(() => {
    console.log('Current messages array:', messages);
    console.log('Conversation state:', conversationState);
  }, [messages, conversationState]);
  
  // Scroll to top whenever messages change
  const scrollToTop = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  useEffect(() => {
    scrollToTop();
  }, [messages]);
  
  // Show welcome message but don't play audio automatically
  const showWelcomeMessage = async (playAudioMessage = false) => {
    // Only show welcome message if it hasn't been shown and there are no messages
    if (!welcomeMessageShown && (!messages || messages.length === 0)) {
      console.log('Showing welcome message');
      const welcomeMsg = await addMessage(WELCOME_MESSAGE, 'assistant');
      setWelcomeMessageShown(true);
      
      // Generate and play speech for welcome message only if requested
      if (playAudioMessage) {
        try {
          const speechData = USE_ELEVEN_LABS 
            ? await generateElevenLabsSpeech(WELCOME_MESSAGE)
            : await generateOpenAISpeech(WELCOME_MESSAGE);
          
          if (speechData) {
            await playAudio(speechData);
          }
        } catch (error) {
          console.error('Error generating welcome speech:', error);
        }
      }
    }
  };
  
  // Initialize welcome message without audio on component mount
  useEffect(() => {
    showWelcomeMessage(false);
  }, []);
  
  // Get a random response from our mocks
  const getRandomResponse = () => {
    return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  };
  
  // Get a random transcription from our mocks
  const getRandomTranscription = () => {
    return MOCK_TRANSCRIPTIONS[Math.floor(Math.random() * MOCK_TRANSCRIPTIONS.length)];
  };
  
  // Check if text contains registration intent
  const checkForRegistrationIntent = (text: string): boolean => {
    const lowercaseText = text.toLowerCase();
    return REGISTRATION_KEYWORDS.some(keyword => lowercaseText.includes(keyword));
  };
  
  // Process user message and generate response
  const processMessage = useCallback(async (userMessage: string) => {
    console.log('Processing message:', userMessage);
    setProcessing(true);
    setStatus('processing');
    
    try {
      // Check if the user wants to register
      const hasRegistrationIntent = checkForRegistrationIntent(userMessage);
      
      if (hasRegistrationIntent) {
        console.log('Registration intent detected, will redirect after response');
        
        // Generate a confirmation response
        const registrationResponse = {
          text: "I'd be happy to help you register. I'll take you to the registration page now."
        };
        
        // Generate speech for the response
        let audioData: ArrayBuffer | null = null;
        try {
          audioData = USE_ELEVEN_LABS
            ? await generateElevenLabsSpeech(registrationResponse.text)
            : await generateOpenAISpeech(registrationResponse.text);
        } catch (error) {
          console.error('Error generating registration speech:', error);
        }
        
        setProcessing(false);
        setStatus('idle');
        
        // Return the response with a redirect action
        return { 
          assistantResponse: registrationResponse.text,
          audio: audioData,
          action: 'redirect',
          to: '/register'
        };
      }
      
      // Normal response flow
      const response = await generateChatResponse(userMessage);
      console.log('ChatGPT response:', response);
      
      // Generate speech from the response text
      let audioData: ArrayBuffer | null = null;
      try {
        audioData = USE_ELEVEN_LABS
          ? await generateElevenLabsSpeech(response.text)
          : await generateOpenAISpeech(response.text);
      } catch (error) {
        console.error('Error generating speech:', error);
      }
      
      setProcessing(false);
      setStatus('idle');
      
      return { 
        assistantResponse: response.text,
        audio: audioData
      };
    } catch (error) {
      console.error('Error in processMessage:', error);
      setProcessing(false);
      setStatus('idle');
      return { 
        assistantResponse: "I'm sorry, I encountered an error processing your request.",
        audio: null
      };
    }
  }, [checkForRegistrationIntent]);
  
  // Voice recording functionality with interruption support
  const { isRecording, startRecording, stopRecording, webSocketStatus } = useVoiceStream({
    onData: async (audioBlob) => {
      console.log('Received audio blob:', audioBlob.size);
      
      try {
        // Indicate processing state
        setStatus('processing');
        setProcessing(true);
        setErrorMessage(null);
        
        // Check if audio blob is too small (likely no speech)
        if (audioBlob.size < 5000) {
          console.warn('Audio blob too small, likely no speech detected');
          setErrorMessage('I couldn\'t hear anything. Please try speaking louder or check your microphone.');
          setStatus('error');
          
          // Reset after a few seconds
          setTimeout(() => {
            setErrorMessage(null);
            setStatus('idle');
          }, 3000);
          
          setProcessing(false);
          return;
        }
        
        // Transcribe the audio
        const transcription = await transcribeAudio(audioBlob);
        console.log('Transcription result:', transcription);
        
        if (!transcription.text || transcription.text.trim() === '') {
          console.warn('No transcription text received or empty text');
          
          // Show friendly error message based on the actual error
          let userMessage = 'I couldn\'t understand what you said. Please try again.';
          
          if (transcription.error) {
            if (transcription.error.includes('silent') || 
                transcription.error.includes('No speech') || 
                transcription.error.includes('too short')) {
              userMessage = 'I didn\'t hear anything. Please speak louder or check your microphone.';
            } else if (transcription.error.includes('format')) {
              userMessage = 'There was a technical issue with the audio. Please try again.';
            }
          }
          
          setErrorMessage(userMessage);
          setStatus('error');
          
          // Reset after a few seconds
          setTimeout(() => {
            setErrorMessage(null);
            setStatus('idle');
          }, 3000);
          
          setProcessing(false);
          return;
        }
        
        // Capture the input text before adding to session
        const userInput = transcription.text.trim();
        console.log('User said:', userInput);
        
        // Add user message - store the returned message object
        const userMessage = await addMessage(userInput, 'user');
        console.log('Added user message:', userMessage);
        
        // Process the message using the conversation engine
        const response = await sendToConversationEngine(userInput, false);
        console.log('Got response from conversation engine:', response);
        
        // Add assistant response
        const assistantMessage = await addMessage(response.response, 'assistant');
        console.log('Added assistant message:', assistantMessage);
        
        // Play audio response if available
        let audioData: ArrayBuffer | null = null;
        try {
          audioData = USE_ELEVEN_LABS
            ? await generateElevenLabsSpeech(response.response)
            : await generateOpenAISpeech(response.response);
            
          if (audioData) {
            await playAudio(audioData);
          }
        } catch (error) {
          console.error('Error generating response speech:', error);
        }
        
        // Handle redirect if needed
        if (response.action === 'redirect') {
          // Wait a bit for the audio to be heard before redirecting
          setTimeout(() => {
            navigate(response.to!);
          }, 2000);
        }
      } catch (error) {
        console.error('Error processing voice input:', error);
        
        // Show error to user
        setErrorMessage('An error occurred processing your voice input. Please try again.');
        setStatus('error');
        
        // Reset after a few seconds
        setTimeout(() => {
          setErrorMessage(null);
          setStatus('idle');
        }, 3000);
      } finally {
        // Don't automatically stop recording, just end processing state
        setProcessing(false);
        // Status is already set in success/error handlers
      }
    },
    // Configure voice activity detection
    silenceThreshold: 0.05,    // Increase this value if it stops too early
    silenceTimeout: 1500,      // 1.5 seconds of silence to stop recording
    autoStopOnSilence: false,  // Disable automatic stopping on silence
    useMockWebSocket: true     // Use mock WebSocket mode to prevent connection errors
  });

  // Handle button press to start/stop recording
  const handleStartRecording = async () => {
    // If already recording, processing, or playing - stop those activities
    if (recording || processing || isPlaying) {
      if (isPlaying) {
        stopAudio();
      }
      if (recording) {
        stopRecording();
        setRecording(false);
      }
      return;
    }
    
    console.log('Handle start recording called');
    setStatus('listening');
    
    // If this is the first time starting, play the welcome message
    if (!welcomeMessageShown) {
      await showWelcomeMessage(true);
      
      // After showing welcome message, start recording
      setRecording(true);
      setStatus('listening');
      await startRecording();
    } else if (welcomeMessageShown && messages.length <= 1) {
      // If only welcome message exists but no conversation yet, play it
      try {
        const speechData = USE_ELEVEN_LABS 
          ? await generateElevenLabsSpeech(WELCOME_MESSAGE)
          : await generateOpenAISpeech(WELCOME_MESSAGE);
        
        if (speechData) {
          await playAudio(speechData);
          
          // Wait a bit for the welcome message to finish before starting to record
          setTimeout(async () => {
            setRecording(true);
            setStatus('listening');
            await startRecording();
          }, 500);
        }
      } catch (error) {
        console.error('Error generating welcome speech:', error);
        // Even if there's an error, still start recording
        setRecording(true);
        setStatus('listening');
        await startRecording();
      }
    } else {
      // Normal flow - just start recording
      setRecording(true);
      setStatus('listening');
      await startRecording();
    }
  };

  // Handle stopping recording and processing
  const handleStopRecording = () => {
    console.log('Handle stop recording called - will stop all active processes');
    
    // Cancel any active requests by interrupting the conversation
    interruptConversation();
    console.log('Interrupted any ongoing conversation');
    
    // Stop recording
    if (recording) {
      console.log('Stopping voice recording');
      stopRecording();
      setRecording(false);
    } else {
      console.log('No active recording to stop');
    }
    
    // Stop any playing audio
    if (isPlaying) {
      console.log('Stopping audio playback');
      stopAudio();
    } else {
      console.log('No audio playing to stop');
    }
    
    // Reset all processing states
    setProcessing(false);
    setStatus('idle');
    setErrorMessage(null);
    processingMessageRef.current = false;
    
    // Force all hooks to update, in case there are any stale states
    setTimeout(() => {
      console.log('Reset complete - all processes stopped');
    }, 100);
  };
  
  // Handle interruptions of ongoing process
  const handleInterruptProcessing = () => {
    console.log('Interrupting processing...');
    
    // Stop any ongoing audio playback
    if (isPlaying) {
      stopAudio();
    }
    
    // Stop recording if active
    if (recording) {
      stopRecording();
      setRecording(false);
    }
    
    // Interrupt the conversation engine
    interruptConversation();
    
    // Reset request processing refs and flags
    processingMessageRef.current = false;
    
    // Update local state
    setProcessing(false);
    setStatus('idle');
    setErrorMessage(null);
    
    console.log('All processes interrupted');
  };

  // Add a debug flag to track if we're in a loop prevention state
  const processingMessageRef = useRef(false);

  const handleSendMessage = async () => {
    if (!inputText.trim() || processing || isPlaying || processingMessageRef.current) return;
    
    // Set our loop prevention flag
    processingMessageRef.current = true;
    
    // Stop audio playback if playing
    if (isPlaying) {
      stopAudio();
    }
    
    // Store the user text before clearing input field
    const userText = inputText.trim();
    setInputText(''); // Clear input immediately for better UX
    
    // Save the message to state before processing
    console.log('Adding user text message:', userText);
    const userMessage = await addMessage(userText, 'user');
    console.log('Added user text message:', userMessage);
    
    // Process the message with the conversation engine
    setProcessing(true);
    setStatus('processing');
    const response = await sendToConversationEngine(userText, false);
    console.log('Got response from conversation engine:', response);
    setProcessing(false);
    setStatus('idle');
    
    // Add assistant response
    const assistantMessage = await addMessage(response.response, 'assistant');
    console.log('Added assistant text response:', assistantMessage);
    
    // Play audio response if available
    try {
      const audioData = USE_ELEVEN_LABS
        ? await generateElevenLabsSpeech(response.response)
        : await generateOpenAISpeech(response.response);
        
      if (audioData) {
        await playAudio(audioData);
      }
    } catch (error) {
      console.error('Error generating speech:', error);
    }
    
    // Handle redirect if needed
    if (response.action === 'redirect') {
      // Wait a bit for the audio to be heard before redirecting
      setTimeout(() => {
        navigate(response.to!);
      }, 2000);
    }
    
    // Release our loop prevention flag
    setTimeout(() => {
      processingMessageRef.current = false;
    }, 500); // Add a small delay to prevent rapid consecutive triggers
  };

  // Handle clearing session
  const handleClearSession = () => {
    if (window.confirm('Are you sure you want to clear all message history?')) {
      // Stop any playing audio
      if (isPlaying) {
        stopAudio();
      }
      
      // Clear the conversation engine state
      resetConversation();
      
      // Clear the session
      clearSession();
      setWelcomeMessageShown(false);
      
      // Reset states
      setInputText('');
      setRecording(false);
      setProcessing(false);
      setStatus('idle');
      
      // Reinitialize welcome message without audio
      setTimeout(() => {
        showWelcomeMessage(false);
      }, 100);
    }
  };

  // Status indicator styles
  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Ready to listen';
      case 'listening':
        return 'Listening...'; 
      case 'processing':
        return 'Processing...';
      case 'error':
        return errorMessage || 'Error occurred';
      default:
        return 'Ready';
    }
  };

  // Get a copy of messages in reverse chronological order
  const reversedMessages = [...(messages || [])].reverse();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">AI Assistant</h1>
          <button 
            onClick={handleClearSession}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            Clear History
          </button>
        </div>
        
        <div className="flex flex-col items-center mb-8">
          <VoiceButton
            isRecording={recording}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onInterrupt={handleInterruptProcessing}
            isProcessing={processing}
            label="Start Conversation"
          />
          <div className="mt-4 flex items-center">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} mr-2 animate-pulse`}></div>
            <span className="text-sm">
              {getStatusText()}
            </span>
          </div>
        </div>
        
        {/* Input Area */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden p-4 flex items-center">
          <input
            type="text"
            className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              // Only trigger send on Enter if not processing
              if (e.key === 'Enter' && !processing && !isPlaying) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            className="btn-primary rounded-l-none"
            onClick={handleSendMessage}
            disabled={processing || isPlaying || !inputText.trim()}
          >
            Send
          </button>
        </div>
        
        {/* Chat Interface */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col h-96">
          {/* Reference for scrolling */}
          <div ref={messagesEndRef} />
          
          {/* Chat Messages - reversed order (newest first) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {reversedMessages && reversedMessages.length > 0 ? (
              <>
                {reversedMessages.map((message) => (
                  <AssistantResponse
                    key={message.id}
                    message={message.content}
                    role={message.role}
                    timestamp={message.timestamp}
                  />
                ))}
              </>
            ) : (
              <p className="text-center text-gray-500">Your conversation will appear here</p>
            )}
          </div>
        </div>
        
        {/* Conversation Stage Debug Info - Remove in production */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-4 p-2 bg-gray-100 text-xs text-gray-500 rounded">
            <div>Conversation Stage: {conversationState.stage}</div>
            <div>Turn Count: {conversationState.turnCount}</div>
            <div>Last Interrupted: {conversationState.lastInterrupted ? 'Yes' : 'No'}</div>
            <div>History Items: {conversationState.history.length}</div>
            <div>WebSocket: {webSocketStatus.isMockMode ? 'Mock Mode' : webSocketStatus.status}</div>
          </div>
        )}
      </div>
    </div>
  );
} 