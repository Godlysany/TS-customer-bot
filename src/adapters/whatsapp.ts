import makeWASocket, { useMultiFileAuthState, downloadMediaMessage, DisconnectReason, WAMessage, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
// @ts-ignore
import qrcode from 'qrcode-terminal';
// @ts-ignore
import QRCode from 'qrcode';
import { execSync } from 'child_process';
import fs from 'fs';
import axios from 'axios';
import { config } from '../infrastructure/config';
import { supabase } from '../infrastructure/supabase';
import conversationService from '../core/ConversationService';
import messageService from '../core/MessageService';
import aiService from '../core/AIService';
import bookingService from '../core/BookingService';
import settingsService from '../core/SettingsService';
import conversationTakeoverService from '../core/ConversationTakeoverService';
import customerAnalyticsService from '../core/CustomerAnalyticsService';
import bookingChatHandler from '../core/BookingChatHandler';
import questionnaireRuntimeService from '../core/QuestionnaireRuntimeService';
import { QuestionnaireService } from '../core/QuestionnaireService';

const debounceTimers = new Map();
const messageBuffers = new Map();

// Store current QR code for frontend display
let currentQrCode: string | null = null;
export const getQrCode = () => currentQrCode;
export const clearQrCode = () => { currentQrCode = null; };

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

/**
 * Trigger questionnaires based on trigger type
 * Returns a questionnaire message if one should be started, null otherwise
 */
async function checkAndTriggerQuestionnaires(
  conversationId: string,
  contactId: string,
  triggerType: 'first_contact' | 'before_booking' | 'after_booking',
  serviceId?: string
): Promise<string | null> {
  const questionnaireService = new QuestionnaireService();

  // Get active questionnaires for this trigger type
  const questionnaires = await questionnaireService.getActiveQuestionnaires(triggerType);

  if (questionnaires.length === 0) {
    return null; // No questionnaires configured for this trigger
  }

  // For service_specific, filter by service ID
  let targetQuestionnaire = questionnaires[0]; // Default to first one

  if (triggerType === 'before_booking' && serviceId) {
    // Check for service-specific questionnaires first
    const serviceQuestionnaires = await questionnaireService.getQuestionnairesForService(serviceId);
    if (serviceQuestionnaires.length > 0) {
      targetQuestionnaire = serviceQuestionnaires[0];
    }
  }

  // Check if contact already completed this questionnaire
  const alreadyCompleted = await questionnaireService.hasContactCompletedQuestionnaire(
    contactId,
    targetQuestionnaire.id
  );

  if (alreadyCompleted) {
    console.log(`📋 Customer already completed questionnaire "${targetQuestionnaire.name}"`);
    return null;
  }

  // Start the questionnaire
  questionnaireRuntimeService.startQuestionnaire(
    conversationId,
    contactId,
    targetQuestionnaire
  );

  // Return the first question
  const firstQuestion = questionnaireRuntimeService.formatCurrentQuestion(conversationId);
  return firstQuestion;
}

/**
 * Handle customer's response to a questionnaire question
 */
async function handleQuestionnaireResponse(
  conversationId: string,
  response: string,
  contactId: string
): Promise<string> {
  const questionnaireService = new QuestionnaireService();

  // Save the response to current question
  const result = questionnaireRuntimeService.saveResponse(conversationId, response);

  if (!result.valid) {
    // Invalid response - ask again with error message
    const currentQuestion = questionnaireRuntimeService.formatCurrentQuestion(conversationId);
    return `${result.error}\n\n${currentQuestion}`;
  }

  // Check if questionnaire is complete
  if (result.completed) {
    const responses = questionnaireRuntimeService.getResponses(conversationId);
    const questionnaireId = questionnaireRuntimeService.getQuestionnaireId(conversationId);

    // Save responses to database
    try {
      const savedResponse = await questionnaireService.saveResponse({
        questionnaireId: questionnaireId!,
        contactId,
        conversationId,
        responses: responses!,
      });

      questionnaireRuntimeService.clearContext(conversationId);

      // PROMOTION REWARD: Check if this questionnaire completion should award a promotion
      try {
        const marketingCampaignExecutor = (await import('../core/MarketingCampaignExecutor')).default;
        await marketingCampaignExecutor.handleQuestionnaireCompletion(
          savedResponse.id,
          contactId,
          questionnaireId!
        );
      } catch (promoError: any) {
        console.error('Error handling promotion reward:', promoError.message);
        // Don't fail the questionnaire completion if promotion handling fails
      }

      return `✅ Thank you for completing the questionnaire! Your responses have been saved.\n\nHow else can I help you today?`;
    } catch (error: any) {
      console.error('Failed to save questionnaire responses:', error.message);
      return `Thank you for completing the questionnaire! However, there was an error saving your responses. Please contact support.`;
    }
  }

  // More questions remaining - ask next question
  const nextQuestion = questionnaireRuntimeService.formatCurrentQuestion(conversationId);
  return nextQuestion || 'Error loading next question. Please try again.';
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

  const botEnabled = await settingsService.getBotEnabled();
  if (!botEnabled) {
    console.log('🤖 Bot is disabled globally, ignoring message');
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

    // Extract WhatsApp contact name from message
    const whatsappName = (msg as any).pushName || (msg as any).verifiedBizName || null;
    
    const { conversation, contact } = await conversationService.getOrCreateConversation(phoneNumber, whatsappName);

    await messageService.createMessage({
      conversationId: conversation.id,
      content: text,
      messageType,
      direction: 'inbound',
      sender: phoneNumber,
    });

    const messageHistory = await messageService.getConversationMessages(conversation.id);

    const canBotReply = await conversationTakeoverService.canBotReply(conversation.id);
    if (!canBotReply) {
      console.log('👤 Agent has taken over conversation, bot will not reply');
      return;
    }

    // Check for first_contact trigger (only inbound messages, so count should be 1)
    const isFirstContact = messageHistory.filter(m => m.direction === 'inbound').length === 1;
    if (isFirstContact) {
      const questionnaireMessage = await checkAndTriggerQuestionnaires(
        conversation.id,
        contact.id,
        'first_contact'
      );

      if (questionnaireMessage) {
        console.log('📋 Triggered first_contact questionnaire');
        // Save outbound message and send
        const messageRecord = await messageService.createMessage({
          conversationId: conversation.id,
          content: questionnaireMessage,
          messageType: 'text',
          direction: 'outbound',
          sender: 'bot',
          approvalStatus: 'approved',
        });

        await messageService.updateConversationLastMessage(conversation.id);
        await sock.sendMessage(sender, { text: questionnaireMessage });
        return; // Stop here - wait for customer's response to first question
      }
    }

    let replyText: string | null = null;

    try {
      // PRIORITY 0: Check for explicit language change request
      const languageRequest = await aiService.detectLanguageChangeRequest(text);
      if (languageRequest.languageRequested && languageRequest.confidence > 0.7) {
        console.log(`🌍 Language change detected: ${languageRequest.languageRequested} (confidence: ${languageRequest.confidence})`);
        await aiService.updateContactLanguage(contact.id, languageRequest.languageRequested);
        
        const languageNames: Record<string, string> = {
          de: 'Deutsch', en: 'English', fr: 'Français', 
          it: 'Italiano', es: 'Español', pt: 'Português'
        };
        
        replyText = `Perfect! I'll continue our conversation in ${languageNames[languageRequest.languageRequested]}. How can I help you?`;
        
        const messageRecord = await messageService.createMessage({
          conversationId: conversation.id,
          content: replyText,
          messageType: 'text',
          direction: 'outbound',
          sender: 'bot',
          approvalStatus: 'approved',
        });
        
        await messageService.updateConversationLastMessage(conversation.id);
        await sock.sendMessage(sender, { text: replyText });
        console.log(`✅ Language confirmation sent in ${languageRequest.languageRequested}`);
        return;
      }
      
      // PRIORITY 1: Check for active questionnaire (customer is answering questions)
      if (questionnaireRuntimeService.hasActiveQuestionnaire(conversation.id)) {
        console.log('📋 Customer is answering questionnaire');
        replyText = await handleQuestionnaireResponse(conversation.id, text, contact.id);
      }
      // PRIORITY 2: Check for active booking context
      else if (bookingChatHandler.hasActiveContext(conversation.id)) {
        console.log('🔄 Continuing booking conversation flow');
        replyText = await bookingChatHandler.handleContextMessage(
          conversation.id,
          text,
          messageHistory
        );
      } 
      // PRIORITY 3: Normal intent detection
      else {
        const intent = await aiService.detectIntent(text);
        console.log('🎯 Intent detected:', intent);

        if (intent.intent === 'booking_request' || intent.intent === 'booking_modify' || intent.intent === 'booking_cancel') {
          // Start new booking conversation flow
          replyText = await bookingChatHandler.handleBookingIntent(
            intent.intent,
            conversation.id,
            contact.id,
            phoneNumber,
            text,
            messageHistory
          );
        } else {
          // Pass intent to generateReply for context-aware confidence scoring
          replyText = await aiService.generateReply(conversation.id, messageHistory, text, intent.intent, conversation.contactId);
        }
      }
    } catch (aiError: any) {
      console.error('❌ AI processing failed:', aiError.message);
      console.log('📝 Message saved to conversation, but no reply sent (AI not configured)');
      // Conversation and message are already saved - just return without sending a reply
      return;
    }

    // Check if human approval is required before sending
    const requireApprovalSetting = await settingsService.getSetting('require_human_approval');
    const needsApproval = requireApprovalSetting === 'true';

    const messageRecord = await messageService.createMessage({
      conversationId: conversation.id,
      content: replyText,
      messageType: 'text',
      direction: 'outbound',
      sender: 'bot',
      approvalStatus: needsApproval ? 'pending_approval' : 'approved',
    });

    if (needsApproval) {
      console.log('⏸️  Message created, pending human approval before sending to WhatsApp');
      await messageService.updateConversationLastMessage(conversation.id);
      return;
    }

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

    customerAnalyticsService.updateCustomerAnalytics(contact.id).catch(err =>
      console.warn('⚠️ Analytics update failed:', err)
    );

    // Asynchronously extract and save CRM data from conversation
    // This doesn't block the response - runs in background
    aiService.extractCustomerData(conversation.id, messageHistory)
      .then(extractedData => {
        if (extractedData.confidence && extractedData.confidence > 0) {
          return aiService.updateContactWithInsights(contact.id, extractedData);
        }
      })
      .catch(err => console.warn('⚠️ CRM extraction failed:', err));
  } catch (err: any) {
    console.error('❌ Message handling error:', err);
  }
}

async function startSock() {
  if (isStarting) return;
  isStarting = true;

  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();
  
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    getMessage: async () => undefined,
    browser: ['WhatsApp CRM Bot', 'Chrome', '120.0'],
    syncFullHistory: false,
  });

  (global as any).sock = sock;
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
      await settingsService.setWhatsAppConnected(true);
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut && reason !== 405;
      console.log(`🔌 Connection closed (reason ${reason}). Reconnect? ${shouldReconnect}`);
      await settingsService.setWhatsAppConnected(false);
      currentQrCode = null;
      clearTimeout(qrTimeout);
      if (shouldReconnect) {
        isStarting = false;
        setTimeout(startSock, 3000);
      } else if (reason === 405) {
        console.log('⚠️ WhatsApp connection blocked (405). Manual restart required via CRM.');
        console.log('💡 Delete ./auth_info folder and try connecting again.');
        isStarting = false;
      } else if (reason === DisconnectReason.loggedOut) {
        console.log('🚪 Logged out from WhatsApp.');
        isStarting = false;
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

export async function sendProactiveMessage(
  phoneNumber: string,
  message: string,
  contactId: string
): Promise<boolean> {
  try {
    if (!sock) {
      console.error('❌ WhatsApp not connected');
      return false;
    }

    const formattedNumber = phoneNumber.includes('@s.whatsapp.net')
      ? phoneNumber
      : `${phoneNumber}@s.whatsapp.net`;

    await sock.sendMessage(formattedNumber, { text: message });

    const { conversation } = await conversationService.getOrCreateConversation(phoneNumber);
    await messageService.createMessage({
      conversationId: conversation.id,
      content: message,
      messageType: 'text',
      direction: 'outbound',
      sender: 'bot',
    });

    console.log(`📤 Proactive message sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending proactive message to ${phoneNumber}:`, error);
    return false;
  }
}

export async function sendApprovedMessage(message: any): Promise<string | null> {
  try {
    if (!sock) {
      console.error('❌ WhatsApp not connected');
      return null;
    }

    // Get conversation to find phone number
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('contact:contacts(phone_number)')
      .eq('id', message.conversationId)
      .single();

    if (error || !conversation) {
      console.error('❌ Failed to find conversation for approved message');
      return null;
    }

    const phoneNumber = (conversation.contact as any).phone_number;
    const formattedNumber = phoneNumber.includes('@s.whatsapp.net')
      ? phoneNumber
      : `${phoneNumber}@s.whatsapp.net`;

    const sentMessage = await sock.sendMessage(formattedNumber, { text: message.content });
    const messageId = sentMessage?.key?.id || `wa_${Date.now()}`;
    
    console.log(`✅ Approved message sent to ${phoneNumber} (ID: ${messageId})`);
    return messageId;
  } catch (error) {
    console.error('❌ Error sending approved message:', error);
    return null;
  }
}

export { startSock };
export const getSock = () => sock;
export default sock;
