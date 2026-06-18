const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'client-manager-key';
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth_info');

// --- State ---
let sock = null;
let status = 'disconnected'; // disconnected | connecting | qr | connected
let currentQR = null;

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const key = req.headers['apikey'] || req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// --- Start WhatsApp Session ---
async function startSession() {
  status = 'connecting';
  currentQR = null;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Client Manager', 'Chrome', '120.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      status = 'qr';
      currentQR = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

      status = 'disconnected';
      currentQR = null;
      sock = null;

      if (shouldReconnect) {
        console.log('Reconnecting...');
        setTimeout(() => startSession(), 5000);
      } else {
        console.log('Session logged out.');
      }
    }

    if (connection === 'open') {
      status = 'connected';
      currentQR = null;
      console.log('WhatsApp connected!');
    }
  });
}

// --- Routes ---
app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/status', authMiddleware, (req, res) => {
  res.json({ status, qr: currentQR });
});

app.post('/session/start', authMiddleware, async (req, res) => {
  if (status === 'connected') {
    return res.json({ status: 'connected', qr: null });
  }
  if (status === 'connecting' || status === 'qr') {
    return res.json({ status, qr: currentQR });
  }
  try {
    await startSession();
    // Give it 1s to generate QR
    await new Promise((r) => setTimeout(r, 1000));
    res.json({ status, qr: currentQR });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/session/disconnect', authMiddleware, async (req, res) => {
  try {
    if (sock) await sock.logout();
    sock = null;
    status = 'disconnected';
    currentQR = null;
    res.json({ ok: true });
  } catch (err) {
    sock = null;
    status = 'disconnected';
    currentQR = null;
    res.json({ ok: true });
  }
});

app.post('/message/sendText/:instance', authMiddleware, async (req, res) => {
  if (status !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp not connected' });
  }
  const { number, text } = req.body;
  if (!number || !text) return res.status(400).json({ error: 'number and text required' });

  // Format number: remove non-digits, add @s.whatsapp.net
  const cleaned = number.replace(/\D/g, '');
  const jid = cleaned.includes('@') ? cleaned : `${cleaned}@s.whatsapp.net`;

  try {
    await sock.sendMessage(jid, { text });
    res.json({ ok: true, jid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Auto-start if auth exists ---
(async () => {
  const fs = require('fs');
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('Auth found, auto-connecting...');
    await startSession();
  }
})();

app.listen(PORT, () => {
  console.log(`WhatsApp server running on port ${PORT}`);
});
