GOALS: 
- Create a voice assistant that can transcribe audio, generate responses, and handle basic user interactions.
- Use WebSocket for real-time audio streaming.
- Implement a simple session management system.
- Store conversation history in MongoDB.
- Add basic voice interruption support.

HOW TO RUN:
Check that document. It's Splitted for Phases and Tasks. Start from Phase 1 and Task 1.Then go file by file, using our task doc and this structure.

START FROM HERE:
“Create the file backend/server.ts and set up an Express.js app that also supports WebSocket connections using the ws package.”

FILES STRUCTURE:
✅ Backend First
backend/server.ts – setup Express + WebSocket server

backend/websocket/voiceSocket.ts – set up voice socket logic

backend/services/stt/transcribeAudio.ts – connect to Whisper STT

backend/services/llm/generateResponse.ts – connect to ChatGPT API

backend/services/tts/synthesizeSpeech.ts – connect to Eleven Labs TTS

backend/services/supabase/fetchScripts.ts – pull onboarding prompts

backend/agents/conversationEngine.ts – assistant logic (turns, redirect)

backend/models/session.ts – MongoDB schema for session/message storage

✅ Then Frontend
src/hooks/useVoiceStream.ts – mic streaming to backend via WebSocket

src/components/VoiceButton.tsx – control UI

src/hooks/useAudioPlayer.ts – playback streamed audio

src/hooks/useBotScripts.ts – fetch onboarding scripts from Supabase

src/agent/useConversationEngine.ts – UI logic layer using backend engine

src/lib/supabase.ts – Supabase client setup

src/components/AssistantResponse.tsx – render voice + text

src/pages/Home.tsx – chat interface (voice only)

src/pages/Register.tsx – registration form (shadcn/ui)


🟩 PHASE 1: Setup & Real-Time Voice Streaming

### 🟩 Task 1: Setup WebSocket Server in Express.js
Add WebSocket support to my existing Express.js backend (Node.js).  
Use the `ws` npm package.  
Create a `voiceSocket.ts` module that:
- Accepts WebSocket connections at `/ws/voice`
- Logs incoming binary audio data or JSON messages
- Allows sending messages back to the client  
Mount the WebSocket listener inside `server.ts`.  
Use TypeScript. Output one file.

### 🟩 Task 2: Stream Microphone Audio from Frontend to WebSocket
In my React + Vite frontend, create a custom hook `useVoiceStream()` that:
- Uses `getUserMedia({ audio: true })` to capture microphone input
- Sends small chunks of audio (e.g. every 250ms) as binary over WebSocket to `/ws/voice`
- Handles connect/disconnect cleanly  
Use TypeScript and show how I’d use this hook in a `VoiceButton` component.

🟨 PHASE 2: Transcription, LLM & TTS

🟨 Task 3: Transcribe Audio Using Whisper API
In the Express backend, create a service `transcribeAudio()` using OpenAI’s Whisper API.  
It should accept a binary audio buffer and return the recognized text.  
Use the `/v1/audio/transcriptions` endpoint with form-data.  

🟨 Task 4: Send Transcribed Text to ChatGPT API
Create a backend function `generateResponse()` that sends a prompt to OpenAI ChatGPT (GPT-4).  
- Use `stream: true` mode  
- Return streamed chunks to a callback  
- Assume system instructions like “you are a helpful voice assistant”

🟨 Task 5: Convert Text to Speech Using Eleven Labs
Create a service `synthesizeSpeech()` in `services/tts/` that:
- Uses the Eleven Labs API `/v1/text-to-speech/{voice_id}`
- Takes a string of text, returns an audio buffer (MP3 or PCM)
- Uses an API key from `.env`

🟨 Task 6: Stream TTS Audio Back to Frontend
In the WebSocket controller `voiceSocket.ts`, after generating a TTS response:
- Send the audio buffer back to the frontend in small binary chunks (simulate stream)
- On the frontend, receive and play the audio stream using Web Audio API  
Provide both server and React logic. Use hooks if needed (`useAudioPlayer()`)

🟧 PHASE 3: Assistant Intelligence Layer

🟧 Task 7: Build `conversationEngine.ts` — Assistant Logic Controller
Create `conversationEngine.ts` that handles assistant logic.  
It should:
- Track the number of turns (Q/A count)
- After 2–3 turns, ask user: “Would you like to register?”
- Detect yes/no intent using simple keyword match
- If yes → return `{ action: 'redirect', to: '/register' }`
- Else → return `{ response: string }` to continue conversation  
Make this logic reusable and independent of UI.

🟧 Task 8: Connect Supabase & Fetch Assistant Scripts
In the frontend, create a hook `useBotScripts()` that:
- Connects to my Supabase project (using `@supabase/supabase-js`)
- Fetches onboarding scripts from a table called `scripts`
- Returns `{ prompt: string, stage: number }` for the assistant
- Uses React Query for caching  
Also provide an example of the Supabase table schema.

🟧 Task 9: Modify `conversationEngine.ts` to Use Supabase Scripts First
Modify the `conversationEngine.ts` logic to:
- Use the onboarding script from Supabase for the first few questions
- After 3rd message, switch to ChatGPT responses
- If registration intent is detected, return `{ action: 'redirect', to: '/register' }`  
Provide full updated engine logic.

🟥 PHASE 4: Registration Logic & Routing

🟥 Task 10: Implement Redirect to `/register` Page
In the frontend:
- Create a React route `/register` using React Router
- When the assistant response includes `{ action: 'redirect' }`, trigger `navigate('/register')`
- Show a basic registration page (email, password) using shadcn/ui and React Hook Form

🟥 Task 11: Track Anonymous Sessions Before Registration
Add support for anonymous sessions before registration.
- Generate a `sessionId` (UUID) in local storage
- Pass it in all messages to backend
- Store each session’s turns + messages in MongoDB (schema: sessionId, messages[], timestamp)

🟥 Task 12: Interrupt Handling (VAD and Control Flow)
Add basic voice interruption support:
- Use volume threshold or VAD to detect when user starts talking
- If detected during assistant playback, send `{ type: 'interrupt' }` over WebSocket
- Stop TTS playback immediately, cancel any LLM/TTS processing  
Show both frontend and backend logic.


🟦 PHASE 5: Optional Add-Ons (After MVP)

🟦 Task 13: Save dialog transcripts to Supabase  
🟦 Task 14: Add multi-language support for STT/TTS  
🟦 Task 15: Build admin panel to manage Supabase scripts  
🟦 Task 16: Add user authentication with Supabase Auth  
🟦 Task 17: Add analytics/logging (PostHog, Sentry, etc.)