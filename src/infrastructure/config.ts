import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  whatsapp: {
    resetAuth: process.env.RESET_AUTH === 'true',
    replyMode: process.env.WHATSAPP_REPLY_MODE || 'text',
  },
  
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || '',
  },
  
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
  },
};
