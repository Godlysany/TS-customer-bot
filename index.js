// WhatsApp bot: stable QR, voice/text/file/image handling, admin messages, robust reconnect
require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const fetch = require("node-fetch");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const fs = require("fs");
const axios = require("axios");
const express = require("express");
const debounceTimers = new Map(); // ⏳ Tracks debounce timers per sender
const messageBuffers = new Map(); // 🧠 Buffers message text fragments per sender
const { execSync } = require("child_process");

if (process.env.RESET_AUTH === "true") {
  const authPath = "./auth_info";
  try {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log("🧹 Deleted ./auth_info to force fresh login.");
  } catch (e) {
    console.warn("⚠️ auth_info folder not found, nothing to delete.");
  }
}

const app = express();
app.use(express.json());

app.get("/", (_, res) => res.send("🤖 WhatsApp bot is running"));

app.post("/send", async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) {
    console.error("❌ Missing 'to' or 'text'", req.body);
    return res.status(400).send("Missing 'to' or 'text'");
  }

  try {
    await global.sock.sendMessage(to + "@s.whatsapp.net", { text });
    res.send("✅ Message sent");
  } catch (err) {
    console.error("❌ Failed to send message:", err);
    res.status(500).send("Error sending message");
  }
});

app.listen(process.env.PORT || 3000, "localhost", () => {
  console.log(`✅ HTTP server running on port ${process.env.PORT || 3000}`);
});

async function transcribeVoice(filePath) {
  try {
    const response = await axios.post(
      "https://api.deepgram.com/v1/listen?detect_language=true&punctuate=true&smart_format=true",
      fs.createReadStream(filePath),
      {
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/ogg",
        },
      }
    );

    const detected = response.data.metadata.detected_language || "und";
    const transcript = response.data.results.channels[0].alternatives[0].transcript;

    console.log(`🧠 Transcription (${detected}):`, transcript);
    return transcript;
  } catch (err) {
    console.warn("⚠️ Auto-detection failed. Falling back to German...");

    try {
      const fallback = await axios.post(
        "https://api.deepgram.com/v1/listen?language=de&punctuate=true&smart_format=true",
        fs.createReadStream(filePath),
        {
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            "Content-Type": "audio/ogg",
          },
        }
      );
      const transcript = fallback.data.results.channels[0].alternatives[0].transcript;
      console.log("🧠 Transcription (fallback DE):", transcript);
      return transcript;
    } catch (fallbackErr) {
      console.error("❌ Both detection and fallback failed:", fallbackErr);
      return "[transcription failed]";
    }
  }
}




// Function to convert text to speech using ElevenLabs API

async function textToSpeech(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "default-voice-id";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await axios.post(
      url,
      {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.3,
          similarity_boost: 0.7,
        },
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    const tempRawPath = `./raw-${Date.now()}.mp3`;
    const finalOggPath = `./voice-${Date.now()}.ogg`;

    // Write raw file from ElevenLabs
    fs.writeFileSync(tempRawPath, response.data);

    // Convert to WhatsApp-compatible OGG (libopus, mono, 16kHz)
    execSync(
      `ffmpeg -y -i "${tempRawPath}" -ar 16000 -ac 1 -c:a libopus "${finalOggPath}"`
    );
    

    fs.unlinkSync(tempRawPath);
    return finalOggPath;
  } catch (err) {
    console.warn("⚠️ ElevenLabs voice synthesis failed:", err.message);
    return null; // Trigger fallback to text
  }
}



let isStarting = false;
let sock;

async function startSock() {
  if (isStarting) return;
  isStarting = true;

  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    getMessage: async () => null,
  });

  global.sock = sock;
  sock.ev.on("creds.update", saveCreds);

  let lastQrTimestamp = 0;
  let qrTimeout;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && Date.now() - lastQrTimestamp > 12 * 60 * 60 * 1000) {
      lastQrTimestamp = Date.now();
      console.log("📲 Scan this QR to log in (valid for 3 mins):");
      qrcode.generate(qr);
      const dataUrl = await QRCode.toDataURL(qr);
      console.log("🔗 QR link:", dataUrl);

      clearTimeout(qrTimeout);
      qrTimeout = setTimeout(() => {
        if (!sock.user) {
          console.log("❌ QR scan timeout. Restarting...");
          process.exit(0);
        }
      }, 180000);
    }

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");
      clearTimeout(qrTimeout);
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      console.log(`🔌 Connection closed (reason ${reason}). Reconnect? ${shouldReconnect}`);
      if (shouldReconnect) {
        isStarting = false;
        setTimeout(startSock, 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
  
    const sender = msg.key.remoteJid;
  
    // Get and clean current message text (logic same as in handleMessage, but inline here)
    let currentText = "";
    if (msg.message.conversation) currentText = msg.message.conversation;
    else if (msg.message.extendedTextMessage) currentText = msg.message.extendedTextMessage.text;
    else if (msg.message.audioMessage?.ptt) currentText = "[voice]";
    else if (msg.message.imageMessage) currentText = "[image]";
    else if (msg.message.documentMessage) currentText = "[file]";
    else currentText = "[unsupported message]";
  
    // Clean as done in handleMessage (can refactor to util later)
    currentText = currentText?.toString()
      .replace(/[“”„‟″❝❞]/g, '"')
      .replace(/[‘’‚‛′❛❜]/g, "'")
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
      .normalize("NFC")
      .trim();
  
    // Buffer the message text
    if (!messageBuffers.has(sender)) {
      messageBuffers.set(sender, []);
    }
    messageBuffers.get(sender).push(currentText);
  
    // Debounce to wait for message burst
    if (debounceTimers.has(sender)) {
      clearTimeout(debounceTimers.get(sender));
    }
  
    debounceTimers.set(
      sender,
      setTimeout(() => {
        const merged = messageBuffers.get(sender).join(" ");
        msg.message = { conversation: merged }; // patch the message to look like 1 single user text
        messageBuffers.delete(sender); // clear buffer
        handleMessage(msg).catch(err =>
          console.error("❌ Debounced message handling error:", err)
        );
      }, 30000)
    );
  });
  

  isStarting = false;
}

startSock();

async function handleMessage(msg) {
  const sender = msg.key.remoteJid;
  const messageId = msg.key.id;
  const timestamp = msg.messageTimestamp;
  debounceTimers.delete(sender);

  if (
    !msg.message ||
    (!msg.message.conversation &&
      !msg.message.extendedTextMessage &&
      !msg.message.audioMessage?.ptt &&
      !msg.message.imageMessage &&
      !msg.message.documentMessage)
  ) {
    console.log("⚠️ Ignored: Empty or unsupported message type");
    console.log("🔍 Message type keys:", Object.keys(msg.message));
    return;
  }

  let text;
  let isVoice = false;
  let messageType = "text";

  try {
    if (msg.message.audioMessage?.ptt) {
      isVoice = true;
      messageType = "voice";
      const buffer = await downloadMediaMessage(msg, "buffer");
      const filePath = `./voice-${Date.now()}.ogg`;
      fs.writeFileSync(filePath, buffer);
      text = await transcribeVoice(filePath);
      fs.unlinkSync(filePath);
    } else if (msg.message.imageMessage) {
      messageType = "image";
      text = "[image received]";
    } else if (msg.message.documentMessage) {
      messageType = "file";
      text = "[file received]";
    } else {
      text = msg.message.conversation || msg.message.extendedTextMessage?.text || "[unsupported message]";
    }

    text = text?.toString()
      .replace(/[“”„‟″❝❞]/g, '"')
      .replace(/[‘’‚‛′❛❜]/g, "'")
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
      .normalize("NFC")
      .trim();

    const webhookPayload = {
      sender: sender.replace('@s.whatsapp.net', '').replace('@c.us', ''),
      text,
      messageType,
      timestamp,
      messageId,
      direction: "inbound",
      raw: msg,
    };

    console.log("🧼 Cleaned Text:", text);
    console.log("🚀 Webhook Payload Sent to Make.com:", webhookPayload);

    webhookPayload.text = JSON.stringify(webhookPayload.text).slice(1, -1);

    const webhookRes = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    let replyText = "";
    let isVoiceReply = false;
    let shouldMarkAsRead = true;

    const rawRes = await webhookRes.text();
    console.log("📩 Raw Webhook Response:", rawRes);
    let json;
    let parseError = false;

    try {
      const safeRaw = rawRes
        .trim()
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u275D\u275E]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u275B\u275C]/g, "'")
        .replace(/[\u2013\u2014\u2212]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/\uFEFF/g, '')
        .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
        .replace(/\r?\n|\r/g, ' ')
        .replace(/";\s*,/g, '",')
        .replace(/("https?:\/\/[^\"]+?)";(?=\s*[},])/g, '$1"$2')
        .replace(/"([^\"]*?)";(\s*[},])/g, '"$1"$2')
        .replace(/[\u0000-\u001F\u007F-\u009F]+/g, '')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .normalize("NFC");

      json = JSON.parse(safeRaw);
    } catch (e) {
      parseError = true;
      console.warn("⚠️ Webhook JSON parse failed. Attempting regex fallback…");

      const match = rawRes.match(/"replyText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match) {
        json = {
          replyText: match[1].replace(/\\"/g, '"'),
          voice: /"voice"\s*:\s*true/.test(rawRes),
          markAsRead: /"markAsRead"\s*:\s*true/.test(rawRes)
        };
        console.log("✅ Fallback JSON recovery succeeded.");
        parseError = false;
      } else {
        console.warn("❌ Fallback regex parsing failed too.");
      }
    }

    if (!parseError && json) {
      replyText = json.replyText;
      isVoiceReply = json.voice;
      shouldMarkAsRead = json.markAsRead !== false;
    } else {
      replyText = "";
      shouldMarkAsRead = false;
    }

    if (shouldMarkAsRead) {
      try {
        await sock.readMessages([msg.key]);
        console.log("✅ Marked as read");
      } catch (e) {
        console.warn("⚠️ Failed to mark as read:", e);
      }
    }

    if (!replyText) return;

    const defaultReplies = {
      image: "📸 Thanks for the image! How can I help further?",
      file: "📎 Got the file! Let me know what's next.",
      voice: "🎙️ Thanks for your voice message!",
    };

    if (replyText.trim() === "Accepted") {
      replyText = defaultReplies[messageType] || "Ich komme gleich zu dir zurück. Ein Moment..";
    }

    const containsLink = typeof replyText === "string" && replyText.includes("http");
    const shouldSendVoice = isVoiceReply && (!containsLink || process.env.REPLY_MODE === "voice" || (process.env.REPLY_MODE === "voice-on-voice" && isVoice));

    let sent = false;

    if (shouldSendVoice) {
      const typingTime = Math.min(4000, Math.max(1000, replyText.length * 20));
      await sock.sendPresenceUpdate("composing", sender);
      await new Promise(resolve => setTimeout(resolve, typingTime));

      try {
        const audioPath = await textToSpeech(replyText);
        if (!audioPath) throw new Error("Audio generation returned null");

        const audioBuffer = fs.readFileSync(audioPath);
        console.log("📤 Voice reply triggered for:", sender);
        console.log("📁 Audio file size:", audioBuffer.length);

        await sock.sendMessage(sender, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });

        fs.unlinkSync(audioPath);
        sent = true;
        console.log("✅ Voice note sent");
      } catch (err) {
        console.warn("⚠️ Voice failed, fallback to text:", err.message || err);
      }
    }

    if (!sent) {
      const replyParts = replyText.split('\n\n').filter(p => p.trim());
      for (const part of replyParts) {
        const typingTime = Math.min(4000, Math.max(1000, part.length * 20));
        await sock.sendPresenceUpdate("composing", sender);
        await new Promise(resolve => setTimeout(resolve, typingTime));
        try {
          await sock.sendMessage(sender, { text: part.trim() });
          console.log("✅ Text part sent:", part.trim());
        } catch (err) {
          console.error("❌ Failed to send text part:", err);
        }
      }
    }

    await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        text: replyText,
        messageType: containsLink ? "text" : isVoiceReply ? "voice" : "text",
        timestamp: Date.now(),
        direction: "outbound",
      }),
    });
  } catch (err) {
    console.error("❌ Message handling error:", err);
  }
}
