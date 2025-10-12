# WhatsApp GPT Bot

## Overview
This is a WhatsApp bot that integrates with Make.com webhooks to provide automated responses. The bot can handle text, voice, image, and file messages, with support for voice transcription (via Deepgram) and text-to-speech responses (via ElevenLabs).

## Project Architecture

### Main Components
- **index.js**: Main application file containing:
  - WhatsApp connection logic using Baileys library
  - Express HTTP server for API endpoints
  - Message handling with debouncing (30-second buffer for message bursts)
  - Voice transcription and text-to-speech functionality
  - Make.com webhook integration

- **send.js**: Alternative outbound message sender (standalone)

### Technology Stack
- **Node.js** (v20+)
- **Baileys**: WhatsApp Web API library
- **Express**: HTTP server for API endpoints
- **Deepgram**: Voice transcription service
- **ElevenLabs**: Text-to-speech service
- **FFmpeg**: Audio conversion for WhatsApp-compatible formats

## Configuration

### Required Environment Variables
Create a `.env` file based on `.env.example`:

- `PORT`: Server port (default: 3000)
- `MAKE_WEBHOOK_URL`: Make.com webhook URL for message processing
- `DEEPGRAM_API_KEY`: API key for voice transcription
- `ELEVENLABS_API_KEY`: API key for text-to-speech
- `ELEVENLABS_VOICE_ID`: Voice ID for ElevenLabs
- `REPLY_MODE`: Reply mode (`voice`, `voice-on-voice`, or `text`)
- `RESET_AUTH`: Set to `true` to force fresh WhatsApp login

### API Endpoints
- `GET /`: Health check endpoint
- `POST /send`: Send WhatsApp messages
  - Body: `{ "to": "phone_number", "text": "message" }`

## Features

### Message Processing
1. **Debouncing**: Messages are buffered for 30 seconds to combine rapid message bursts
2. **Voice Transcription**: Automatic transcription of voice messages using Deepgram
3. **Text-to-Speech**: Convert text responses to voice using ElevenLabs
4. **Media Support**: Handles images, files, and documents
5. **Unicode Normalization**: Cleans special characters for JSON compatibility

### Connection Management
- Automatic QR code generation for WhatsApp login
- Persistent authentication using multi-file auth state
- Auto-reconnection on connection loss
- QR code timeout handling (3 minutes)

## Setup Instructions

1. Install dependencies: `npm install`
2. Create `.env` file with required API keys
3. Run the bot: `npm start`
4. Scan QR code in console to authenticate WhatsApp
5. Bot will auto-reconnect on disconnection

## Current State
- ✅ Dependencies installed (including axios and ffmpeg)
- ✅ Express server configured on port 3000
- ✅ WhatsApp bot workflow configured
- ✅ Environment variables documented

## Recent Changes (October 12, 2025)
- Imported from GitHub and configured for Replit environment
- Installed missing dependencies (axios, ffmpeg)
- Created .gitignore for Node.js project
- Created .env.example for environment configuration
- Fixed ffmpeg path from `./ffmpeg` to `ffmpeg` (system-wide)
- Updated Express server configuration for localhost binding
- Set up WhatsApp Bot workflow

## User Preferences
- Not yet specified

## Notes
- The bot requires active WhatsApp authentication (QR scan on first run)
- Voice features require valid Deepgram and ElevenLabs API keys
- Make.com webhook is required for message processing
- Audio files are automatically cleaned up after processing
