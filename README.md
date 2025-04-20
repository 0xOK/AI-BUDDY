# AI Assistant

A voice-enabled AI assistant with real-time transcription, response generation, and text-to-speech capabilities.

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [Supabase](https://supabase.com)
2. Get your project URL and anon key from Project Settings > API
3. Update `.env` file with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run the SQL migration in `supabase/migrations/20240420000000_create_scripts_table.sql` in the Supabase SQL editor

### 2. OpenAI Setup

1. Get your API key from [OpenAI](https://platform.openai.com)
2. Update `.env` file:
   ```
   OPENAI_API_KEY=your-openai-api-key
   ```

### 3. Eleven Labs Setup

1. Get your API key from [Eleven Labs](https://elevenlabs.io)
2. Update `.env` file:
   ```
   ELEVEN_LABS_API_KEY=your-eleven-labs-api-key
   ```

### 4. Installation

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

## Features

- Real-time voice streaming using WebSocket
- Audio transcription using OpenAI Whisper
- Response generation using OpenAI GPT
- Text-to-speech using Eleven Labs
- Onboarding scripts stored in Supabase
- Conversation engine with stage-based responses
- Voice interruption support

## Project Structure

```
├── backend/                 # Express.js backend
│   ├── server.ts           # Main server file
│   ├── websocket/          # WebSocket handlers
│   └── services/           # External service integrations
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   └── pages/             # Page components
└── supabase/              # Supabase migrations
    └── migrations/        # Database migrations
```

## Development

The project is split into phases as described in `PRD for AI Assistant.md`. Each phase builds upon the previous one, implementing new features and capabilities.
