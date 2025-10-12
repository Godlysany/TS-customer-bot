import makeWASocket, { useMultiFileAuthState, downloadMediaMessage, DisconnectReason, WAMessage } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { execSync } from 'child_process';
import fs from 'fs';
import axios from 'axios';
import { config } from '../infrastructure/config';
import conversationService from '../core/ConversationService';
import messageService from '../core/MessageService';
import aiService from '../core/AIService';
import bookingService from '../core/BookingService';

const debounceTimers = new Map();
const messageBuffers = new Map();

if (config.whatsapp.resetAuth) {
  const authPath = './auth_info';
  try {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('🧹 Deleted ./auth_info to force fresh login.');
  } catch (e) {
    console.warn('⚠️ auth_info folder not found, nothing to delete.');
  }
}

async function transcribeVoice(filePath: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?detect_language=true&punctuate=true&smart_format=true',
      fs.createReadStream(filePath),
      {
        headers: {
          Authorization: `Token ${config.deepgram.apiKey}`,
          'Content-Type': 'audio/ogg',
        },
      }
    );

    const transcript = response.data.results.channels[0].alternatives[0].transcript;
    console.log(`🧠 Transcription:`, transcript);
    return transcript;
  } catch (err: any) {
    console.error('❌ Transcription failed:', err.message);
    return '[transcription failed]';
  }
}

async function textToSpeech(text: string): Promise<string | null> {
  const voiceId = config.elevenlabs.voiceId || 'default-voice-id';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await axios.post(
      url,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.3,
          similarity_boost: 0.7,
        },
      },
      {
        headers: {
          'xi-api-key': config.elevenlabs.apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    const tempRawPath = `./raw-${Date.now()}.mp3`;
    const finalOggPath = `./voice-${Date.now()}.ogg`;

    fs.writeFileSync(tempRawPath, response.data);
    execSync(`ffmpeg -y -i "${tempRawPath}" -ar 16000 -ac 1 -c:a libopus "${finalOggPath}"`);
    fs.unlinkSync(tempRawPath);
    
    return finalOggPath;
  } catch (err: any) {
    console.warn('⚠️ ElevenLabs voice synthesis failed:', err.message);
    return null;
  }
}

function cleanText(text: string): string {
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
let sock: any;

async function handleMessage(msg: WAMessage) {
  const sender = msg.key.remoteJid!;
  const phoneNumber = sender.replace('@s.whatsapp.net', '').replace('@c.us', '');
  
  debounceTimers.delete(sender);

  if (!msg.message) {
    console.log('⚠️ Ignored: Empty message');
    return;
  }

  let text: string;
  let isVoice = false;
  let messageType: 'text' | 'voice' | 'image' | 'file' = 'text';

  try {
    if (msg.message.audioMessage?.ptt) {
      isVoice = true;
      messageType = 'voice';
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      const filePath = `./voice-${Date.now()}.ogg`;
      fs.writeFileSync(filePath, buffer);
      text = await transcribeVoice(filePath);
      fs.unlinkSync(filePath);
    } else if (msg.message.imageMessage) {
      messageType = 'image';
      text = '[image received]';
    } else if (msg.message.documentMessage) {
      messageType = 'file';
      text = '[file received]';
    } else {
      text = msg.message.conversation || msg.message.extendedTextMessage?.text || '[unsupported message]';
    }

    text = cleanText(text);

    const { conversation, contact } = await conversationService.getOrCreateConversation(phoneNumber);

    await messageService.createMessage({
      conversationId: conversation.id,
      content: text,
      messageType,
      direction: 'inbound',
      sender: phoneNumber,
    });

    const messageHistory = await messageService.getConversationMessages(conversation.id);

    const intent = await aiService.detectIntent(text);
    console.log('🎯 Intent detected:', intent);

    let replyText: string;

    if (intent.intent === 'booking_request' || intent.intent === 'booking_modify' || intent.intent === 'booking_cancel') {
      replyText = 'I understand you want to manage a booking. This feature is coming soon! For now, please contact our support team.';
    } else {
      replyText = await aiService.generateReply(conversation.id, messageHistory, text);
    }

    await messageService.createMessage({
      conversationId: conversation.id,
      content: replyText,
      messageType: 'text',
      direction: 'outbound',
      sender: 'bot',
    });

    await messageService.updateConversationLastMessage(conversation.id);

    const shouldSendVoice = config.whatsapp.replyMode === 'voice' || 
      (config.whatsapp.replyMode === 'voice-on-voice' && isVoice);

    if (shouldSendVoice && config.elevenlabs.apiKey) {
      try {
        const audioPath = await textToSpeech(replyText);
        if (audioPath) {
          const audioBuffer = fs.readFileSync(audioPath);
          await sock.sendMessage(sender, {
            audio: audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          });
          fs.unlinkSync(audioPath);
          console.log('✅ Voice note sent');
          return;
        }
      } catch (err: any) {
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
    } catch (e) {
      console.warn('⚠️ Failed to mark as read');
    }
  } catch (err: any) {
    console.error('❌ Message handling error:', err);
  }
}

async function startSock() {
  if (isStarting) return;
  isStarting = true;

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    getMessage: async () => undefined,
  });

  global.sock = sock;
  sock.ev.on('creds.update', saveCreds);

  let lastQrTimestamp = 0;
  let qrTimeout: NodeJS.Timeout;

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && Date.now() - lastQrTimestamp > 12 * 60 * 60 * 1000) {
      lastQrTimestamp = Date.now();
      console.log('📲 Scan this QR to log in (valid for 3 mins):');
      qrcode.generate(qr, { small: true });
      const dataUrl = await QRCode.toDataURL(qr);
      console.log('🔗 QR link:', dataUrl);

      clearTimeout(qrTimeout);
      qrTimeout = setTimeout(() => {
        if (!sock.user) {
          console.log('❌ QR scan timeout. Restarting...');
          process.exit(0);
        }
      }, 180000);
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      clearTimeout(qrTimeout);
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      console.log(`🔌 Connection closed (reason ${reason}). Reconnect? ${shouldReconnect}`);
      if (shouldReconnect) {
        isStarting = false;
        setTimeout(startSock, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }: { messages: WAMessage[] }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid!;

    let currentText = '';
    if (msg.message.conversation) currentText = msg.message.conversation;
    else if (msg.message.extendedTextMessage) currentText = msg.message.extendedTextMessage.text!;
    else if (msg.message.audioMessage?.ptt) currentText = '[voice]';
    else if (msg.message.imageMessage) currentText = '[image]';
    else if (msg.message.documentMessage) currentText = '[file]';
    else currentText = '[unsupported message]';

    currentText = cleanText(currentText);

    if (!messageBuffers.has(sender)) {
      messageBuffers.set(sender, []);
    }
    messageBuffers.get(sender).push(currentText);

    if (debounceTimers.has(sender)) {
      clearTimeout(debounceTimers.get(sender));
    }

    debounceTimers.set(
      sender,
      setTimeout(() => {
        const merged = messageBuffers.get(sender).join(' ');
        msg.message = { conversation: merged };
        messageBuffers.delete(sender);
        handleMessage(msg).catch(err =>
          console.error('❌ Debounced message handling error:', err)
        );
      }, 30000)
    );
  });

  isStarting = false;
}

startSock();

export default sock;
