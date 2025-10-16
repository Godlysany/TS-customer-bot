"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearQrCode = exports.getQrCode = void 0;
exports.sendProactiveMessage = sendProactiveMessage;
exports.startSock = startSock;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
// @ts-ignore
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
// @ts-ignore
const qrcode_1 = __importDefault(require("qrcode"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../infrastructure/config");
const ConversationService_1 = __importDefault(require("../core/ConversationService"));
const MessageService_1 = __importDefault(require("../core/MessageService"));
const AIService_1 = __importDefault(require("../core/AIService"));
const SettingsService_1 = __importDefault(require("../core/SettingsService"));
const ConversationTakeoverService_1 = __importDefault(require("../core/ConversationTakeoverService"));
const CustomerAnalyticsService_1 = __importDefault(require("../core/CustomerAnalyticsService"));
const BookingChatHandler_1 = __importDefault(require("../core/BookingChatHandler"));
const debounceTimers = new Map();
const messageBuffers = new Map();
// Store current QR code for frontend display
let currentQrCode = null;
const getQrCode = () => currentQrCode;
exports.getQrCode = getQrCode;
const clearQrCode = () => { currentQrCode = null; };
exports.clearQrCode = clearQrCode;
if (config_1.config.whatsapp.resetAuth) {
    const authPath = './auth_info';
    try {
        fs_1.default.rmSync(authPath, { recursive: true, force: true });
        console.log('🧹 Deleted ./auth_info to force fresh login.');
    }
    catch (e) {
        console.warn('⚠️ auth_info folder not found, nothing to delete.');
    }
}
async function transcribeVoice(filePath) {
    try {
        const response = await axios_1.default.post('https://api.deepgram.com/v1/listen?detect_language=true&punctuate=true&smart_format=true', fs_1.default.createReadStream(filePath), {
            headers: {
                Authorization: `Token ${config_1.config.deepgram.apiKey}`,
                'Content-Type': 'audio/ogg',
            },
        });
        const transcript = response.data.results.channels[0].alternatives[0].transcript;
        console.log(`🧠 Transcription:`, transcript);
        return transcript;
    }
    catch (err) {
        console.error('❌ Transcription failed:', err.message);
        return '[transcription failed]';
    }
}
async function textToSpeech(text) {
    const voiceId = config_1.config.elevenlabs.voiceId || 'default-voice-id';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    try {
        const response = await axios_1.default.post(url, {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.3,
                similarity_boost: 0.7,
            },
        }, {
            headers: {
                'xi-api-key': config_1.config.elevenlabs.apiKey,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
        });
        const tempRawPath = `./raw-${Date.now()}.mp3`;
        const finalOggPath = `./voice-${Date.now()}.ogg`;
        fs_1.default.writeFileSync(tempRawPath, response.data);
        (0, child_process_1.execSync)(`ffmpeg -y -i "${tempRawPath}" -ar 16000 -ac 1 -c:a libopus "${finalOggPath}"`);
        fs_1.default.unlinkSync(tempRawPath);
        return finalOggPath;
    }
    catch (err) {
        console.warn('⚠️ ElevenLabs voice synthesis failed:', err.message);
        return null;
    }
}
function cleanText(text) {
    return text
        .replace(/[""„‟″❝❞]/g, '"')
        .replace(/[''‚‛′❛❜]/g, "'")
        .replace(/[–—–—−]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\uFEFF/g, '')
        .replace(/\r?\n|\r/g, ' ')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .normalize('NFC')
        .trim();
}
let isStarting = false;
let sock;
async function handleMessage(msg) {
    const sender = msg.key.remoteJid;
    const phoneNumber = sender.replace('@s.whatsapp.net', '').replace('@c.us', '');
    debounceTimers.delete(sender);
    if (!msg.message) {
        console.log('⚠️ Ignored: Empty message');
        return;
    }
    const botEnabled = await SettingsService_1.default.getBotEnabled();
    if (!botEnabled) {
        console.log('🤖 Bot is disabled globally, ignoring message');
        return;
    }
    let text;
    let isVoice = false;
    let messageType = 'text';
    try {
        if (msg.message.audioMessage?.ptt) {
            isVoice = true;
            messageType = 'voice';
            const buffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {});
            const filePath = `./voice-${Date.now()}.ogg`;
            fs_1.default.writeFileSync(filePath, buffer);
            text = await transcribeVoice(filePath);
            fs_1.default.unlinkSync(filePath);
        }
        else if (msg.message.imageMessage) {
            messageType = 'image';
            text = '[image received]';
        }
        else if (msg.message.documentMessage) {
            messageType = 'file';
            text = '[file received]';
        }
        else {
            text = msg.message.conversation || msg.message.extendedTextMessage?.text || '[unsupported message]';
        }
        text = cleanText(text);
        const { conversation, contact } = await ConversationService_1.default.getOrCreateConversation(phoneNumber);
        await MessageService_1.default.createMessage({
            conversationId: conversation.id,
            content: text,
            messageType,
            direction: 'inbound',
            sender: phoneNumber,
        });
        const messageHistory = await MessageService_1.default.getConversationMessages(conversation.id);
        const canBotReply = await ConversationTakeoverService_1.default.canBotReply(conversation.id);
        if (!canBotReply) {
            console.log('👤 Agent has taken over conversation, bot will not reply');
            return;
        }
        let replyText;
        // CRITICAL: Check for active booking context BEFORE intent detection
        // This ensures follow-up messages (like "1" or "next Monday") route to the handler
        if (BookingChatHandler_1.default.hasActiveContext(conversation.id)) {
            console.log('🔄 Continuing booking conversation flow');
            replyText = await BookingChatHandler_1.default.handleContextMessage(conversation.id, text, messageHistory);
        }
        else {
            // No active context - detect intent normally
            const intent = await AIService_1.default.detectIntent(text);
            console.log('🎯 Intent detected:', intent);
            if (intent.intent === 'booking_request' || intent.intent === 'booking_modify' || intent.intent === 'booking_cancel') {
                // Start new booking conversation flow
                replyText = await BookingChatHandler_1.default.handleBookingIntent(intent.intent, conversation.id, contact.id, phoneNumber, text, messageHistory);
            }
            else {
                replyText = await AIService_1.default.generateReply(conversation.id, messageHistory, text);
            }
        }
        await MessageService_1.default.createMessage({
            conversationId: conversation.id,
            content: replyText,
            messageType: 'text',
            direction: 'outbound',
            sender: 'bot',
        });
        await MessageService_1.default.updateConversationLastMessage(conversation.id);
        const shouldSendVoice = config_1.config.whatsapp.replyMode === 'voice' ||
            (config_1.config.whatsapp.replyMode === 'voice-on-voice' && isVoice);
        if (shouldSendVoice && config_1.config.elevenlabs.apiKey) {
            try {
                const audioPath = await textToSpeech(replyText);
                if (audioPath) {
                    const audioBuffer = fs_1.default.readFileSync(audioPath);
                    await sock.sendMessage(sender, {
                        audio: audioBuffer,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt: true
                    });
                    fs_1.default.unlinkSync(audioPath);
                    console.log('✅ Voice note sent');
                    return;
                }
            }
            catch (err) {
                console.warn('⚠️ Voice failed, fallback to text:', err.message);
            }
        }
        const replyParts = replyText.split('\n\n').filter(p => p.trim());
        for (const part of replyParts) {
            await sock.sendPresenceUpdate('composing', sender);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sock.sendMessage(sender, { text: part.trim() });
            console.log('✅ Text sent:', part.trim());
        }
        try {
            await sock.readMessages([msg.key]);
        }
        catch (e) {
            console.warn('⚠️ Failed to mark as read');
        }
        CustomerAnalyticsService_1.default.updateCustomerAnalytics(contact.id).catch(err => console.warn('⚠️ Analytics update failed:', err));
    }
    catch (err) {
        console.error('❌ Message handling error:', err);
    }
}
async function startSock() {
    if (isStarting)
        return;
    isStarting = true;
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)('./auth_info');
    sock = (0, baileys_1.default)({
        auth: state,
        printQRInTerminal: false,
        getMessage: async () => undefined,
        browser: ['WhatsApp CRM Bot', 'Chrome', '120.0'],
        syncFullHistory: false,
    });
    global.sock = sock;
    sock.ev.on('creds.update', saveCreds);
    let lastQrTimestamp = 0;
    let qrTimeout;
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && Date.now() - lastQrTimestamp > 12 * 60 * 60 * 1000) {
            lastQrTimestamp = Date.now();
            console.log('📲 Scan this QR to log in (valid for 3 mins):');
            qrcode_terminal_1.default.generate(qr, { small: true });
            const dataUrl = await qrcode_1.default.toDataURL(qr);
            console.log('🔗 QR link:', dataUrl);
            // Store QR code for frontend
            currentQrCode = dataUrl;
            clearTimeout(qrTimeout);
            qrTimeout = setTimeout(() => {
                if (!sock.user) {
                    console.log('❌ QR scan timeout. Stopping connection attempt...');
                    isStarting = false;
                    if (sock) {
                        sock.end(undefined);
                    }
                }
            }, 180000);
        }
        if (connection === 'open') {
            console.log('✅ Connected to WhatsApp!');
            clearTimeout(qrTimeout);
            currentQrCode = null; // Clear QR code on successful connection
            await SettingsService_1.default.setWhatsAppConnected(true);
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== baileys_1.DisconnectReason.loggedOut && reason !== 405;
            console.log(`🔌 Connection closed (reason ${reason}). Reconnect? ${shouldReconnect}`);
            await SettingsService_1.default.setWhatsAppConnected(false);
            currentQrCode = null;
            clearTimeout(qrTimeout);
            if (shouldReconnect) {
                isStarting = false;
                setTimeout(startSock, 3000);
            }
            else if (reason === 405) {
                console.log('⚠️ WhatsApp connection blocked (405). Manual restart required via CRM.');
                console.log('💡 Delete ./auth_info folder and try connecting again.');
                isStarting = false;
            }
            else if (reason === baileys_1.DisconnectReason.loggedOut) {
                console.log('🚪 Logged out from WhatsApp.');
                isStarting = false;
            }
        }
    });
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe)
            return;
        const sender = msg.key.remoteJid;
        let currentText = '';
        if (msg.message.conversation)
            currentText = msg.message.conversation;
        else if (msg.message.extendedTextMessage)
            currentText = msg.message.extendedTextMessage.text;
        else if (msg.message.audioMessage?.ptt)
            currentText = '[voice]';
        else if (msg.message.imageMessage)
            currentText = '[image]';
        else if (msg.message.documentMessage)
            currentText = '[file]';
        else
            currentText = '[unsupported message]';
        currentText = cleanText(currentText);
        if (!messageBuffers.has(sender)) {
            messageBuffers.set(sender, []);
        }
        messageBuffers.get(sender).push(currentText);
        if (debounceTimers.has(sender)) {
            clearTimeout(debounceTimers.get(sender));
        }
        debounceTimers.set(sender, setTimeout(() => {
            const merged = messageBuffers.get(sender).join(' ');
            msg.message = { conversation: merged };
            messageBuffers.delete(sender);
            handleMessage(msg).catch(err => console.error('❌ Debounced message handling error:', err));
        }, 30000));
    });
    isStarting = false;
}
async function sendProactiveMessage(phoneNumber, message, contactId) {
    try {
        if (!sock) {
            console.error('❌ WhatsApp not connected');
            return false;
        }
        const formattedNumber = phoneNumber.includes('@s.whatsapp.net')
            ? phoneNumber
            : `${phoneNumber}@s.whatsapp.net`;
        await sock.sendMessage(formattedNumber, { text: message });
        const { conversation } = await ConversationService_1.default.getOrCreateConversation(phoneNumber);
        await MessageService_1.default.createMessage({
            conversationId: conversation.id,
            content: message,
            messageType: 'text',
            direction: 'outbound',
            sender: 'bot',
        });
        console.log(`📤 Proactive message sent to ${phoneNumber}`);
        return true;
    }
    catch (error) {
        console.error(`❌ Error sending proactive message to ${phoneNumber}:`, error);
        return false;
    }
}
exports.default = sock;
