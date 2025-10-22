"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const googleapis_1 = require("googleapis");
const SettingsService_1 = __importDefault(require("../core/SettingsService"));
const router = (0, express_1.Router)();
// Get OAuth2 client
function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Support both production (Railway/custom domain) and dev (Replit)
    // Priority: PRODUCTION_DOMAIN > RAILWAY_PUBLIC_DOMAIN > REPLIT_DEV_DOMAIN
    const domain = process.env.PRODUCTION_DOMAIN
        || process.env.RAILWAY_PUBLIC_DOMAIN
        || process.env.REPLIT_DEV_DOMAIN
        || 'localhost:8080';
    const redirectUri = `https://${domain}/api/calendar/oauth/callback`;
    if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
    return new googleapis_1.google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
// Initiate OAuth flow - redirect to Google
router.get('/oauth/connect', async (req, res) => {
    try {
        const oauth2Client = getOAuth2Client();
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events',
            ],
            prompt: 'consent', // Force consent to get refresh token
        });
        res.redirect(authUrl);
    }
    catch (error) {
        console.error('OAuth connect error:', error);
        res.status(500).send(`
      <html>
        <body>
          <h1>Google Calendar Setup Required</h1>
          <p>Please configure Google OAuth credentials:</p>
          <ol>
            <li>Go to <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></li>
            <li>Create a new project or select existing</li>
            <li>Enable Google Calendar API</li>
            <li>Create OAuth 2.0 credentials (Web application)</li>
            <li>Add redirect URI: <code>${`https://${process.env.PRODUCTION_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN}/api/calendar/oauth/callback`}</code></li>
            <li>Add secrets in Replit: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET</li>
          </ol>
          <p>Error: ${error.message}</p>
          <a href="/settings">Back to Settings</a>
        </body>
      </html>
    `);
    }
});
// OAuth callback - handle authorization code
router.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>No authorization code received from Google.</p>
          <a href="/settings">Back to Settings</a>
        </body>
      </html>
    `);
    }
    try {
        const oauth2Client = getOAuth2Client();
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        // Store tokens in settings
        if (tokens.access_token) {
            await SettingsService_1.default.updateSetting('google_calendar_access_token', tokens.access_token);
        }
        if (tokens.refresh_token) {
            await SettingsService_1.default.updateSetting('google_calendar_refresh_token', tokens.refresh_token);
        }
        if (tokens.expiry_date) {
            await SettingsService_1.default.updateSetting('google_calendar_token_expiry', tokens.expiry_date.toString());
        }
        // Mark calendar as connected
        await SettingsService_1.default.updateSetting('calendar_connected', 'true');
        console.log('✅ Google Calendar connected successfully');
        // Redirect back to settings with success
        res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="2;url=/" />
        </head>
        <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px;">
            <h1>✅ Google Calendar Connected!</h1>
            <p>Your calendar is now connected. Redirecting to Settings...</p>
          </div>
        </body>
      </html>
    `);
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).send(`
      <html>
        <body>
          <h1>Connection Failed</h1>
          <p>Error: ${error.message}</p>
          <a href="/settings">Back to Settings</a>
        </body>
      </html>
    `);
    }
});
// Disconnect calendar
router.post('/disconnect', async (req, res) => {
    try {
        await SettingsService_1.default.updateSetting('google_calendar_access_token', '');
        await SettingsService_1.default.updateSetting('google_calendar_refresh_token', '');
        await SettingsService_1.default.updateSetting('calendar_connected', 'false');
        res.json({ success: true, message: 'Calendar disconnected' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get calendar connection status
router.get('/status', async (req, res) => {
    try {
        const connected = await SettingsService_1.default.getSetting('calendar_connected');
        const hasAccessToken = await SettingsService_1.default.getSetting('google_calendar_access_token');
        res.json({
            connected: connected === 'true' && !!hasAccessToken,
            provider: 'google'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
