import { createClient } from '@supabase/supabase-js';
import { config } from './config';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  console.error('❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
  if (!config.supabase.url) console.error('   - SUPABASE_URL is missing');
  if (!config.supabase.serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY is missing');
  console.error('⚠️  Server will start but database operations will fail');
  console.error('📝 Add these variables in Railway dashboard → Settings → Variables');
}

export const supabase = createClient(
  config.supabase.url || 'https://placeholder.supabase.co',
  config.supabase.serviceRoleKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default supabase;
