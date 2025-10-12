require("dotenv").config();
const express = require("express");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());

const init = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const sock = makeWASocket({ auth: state });

  sock.ev.on("creds.update", saveCreds);

  app.post("/send", async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).send("Missing 'to' or 'message'");
    }

    try {
      await sock.sendMessage(to, { text: message });
      console.log("✅ Message sent to", to);
      res.status(200).send("Message sent");
    } catch (err) {
      console.error("❌ Failed to send:", err);
      res.status(500).send("Error");
    }
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log("✅ Outbound API running on port", process.env.PORT || 3000);
  });
};

init();
