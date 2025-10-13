"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
if (!config_1.config.supabase.url || !config_1.config.supabase.serviceRoleKey) {
    console.error('❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
    if (!config_1.config.supabase.url)
        console.error('   - SUPABASE_URL is missing');
    if (!config_1.config.supabase.serviceRoleKey)
        console.error('   - SUPABASE_SERVICE_ROLE_KEY is missing');
    console.error('⚠️  Server will start but database operations will fail');
    console.error('📝 Add these variables in Railway dashboard → Settings → Variables');
}
exports.supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url || 'https://placeholder.supabase.co', config_1.config.supabase.serviceRoleKey || 'placeholder-key', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
exports.default = exports.supabase;
