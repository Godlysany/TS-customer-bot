import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },
  
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
  },
  
  whatsapp: {
    replyMode: process.env.REPLY_MODE || 'voice-on-voice',
    resetAuth: process.env.RESET_AUTH === 'true',
  },
  
  calendar: {
    provider: process.env.CALENDAR_PROVIDER || 'google',
  }
};
