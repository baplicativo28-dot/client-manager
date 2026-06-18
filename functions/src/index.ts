import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// WhatsApp Bot via Baileys — QR Code + Auto-send
// ============================================================
// This uses @whiskeysockets/baileys (free, open-source) to connect
// to WhatsApp Web by scanning a QR code, then sends messages
// automatically with anti-ban intervals.
// ============================================================

let baileysModule: typeof import('@whiskeysockets/baileys') | null = null;
let activeConnections: Map<string, {
  sock: import('@whiskeysockets/baileys').WASocket;
  qrCode: string | null;
  connected: boolean;
}> = new Map();

async function getBaileys() {
  if (!baileysModule) {
    baileysModule = await import('@whiskeysockets/baileys');
  }
  return baileysModule;
}

/**
 * getQRCode — Generates a QR code for the user to scan with WhatsApp.
 * Creates a new Baileys connection if one doesn't exist.
 */
export const getQRCode = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const uid = request.auth.uid;

  // Check if already connected
  const existing = activeConnections.get(uid);
  if (existing?.connected) {
    return { status: 'connected', qrCode: null };
  }

  try {
    const baileys = await getBaileys();
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

    // Auth state stored in Firestore
    const authDir = `/tmp/wa-auth-${uid}`;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Client Manager', 'Chrome', '1.0'],
    });

    let qrCode: string | null = null;

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCode = qr;
        const conn = activeConnections.get(uid);
        if (conn) conn.qrCode = qr;

        // Store QR in Firestore for the frontend to poll
        await db.collection('whatsappSessions').doc(uid).set({
          qrCode: qr,
          status: 'waiting_scan',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
        if (shouldReconnect) {
          // Reconnect
          const conn = activeConnections.get(uid);
          if (conn) conn.connected = false;
        } else {
          activeConnections.delete(uid);
          await db.collection('whatsappSessions').doc(uid).set({
            status: 'disconnected',
            qrCode: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } else if (connection === 'open') {
        const conn = activeConnections.get(uid);
        if (conn) {
          conn.connected = true;
          conn.qrCode = null;
        }
        await db.collection('whatsappSessions').doc(uid).set({
          status: 'connected',
          qrCode: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    activeConnections.set(uid, { sock, qrCode, connected: false });

    // Wait a bit for QR code to be generated
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get QR from Firestore (in case the event already fired)
    const sessionDoc = await db.collection('whatsappSessions').doc(uid).get();
    const sessionData = sessionDoc.data();

    return {
      status: sessionData?.status || 'waiting',
      qrCode: sessionData?.qrCode || qrCode,
    };
  } catch (error: any) {
    console.error('Error creating WhatsApp connection:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao conectar ao WhatsApp: ' + error.message);
  }
});

/**
 * getConnectionStatus — Check if WhatsApp is connected
 */
export const getConnectionStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const uid = request.auth.uid;
  const sessionDoc = await db.collection('whatsappSessions').doc(uid).get();
  const data = sessionDoc.data();

  return {
    status: data?.status || 'disconnected',
    qrCode: data?.status === 'waiting_scan' ? data?.qrCode : null,
  };
});

/**
 * disconnectWhatsApp — Disconnect from WhatsApp
 */
export const disconnectWhatsApp = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const uid = request.auth.uid;
  const conn = activeConnections.get(uid);
  if (conn) {
    await conn.sock.logout();
    activeConnections.delete(uid);
  }

  await db.collection('whatsappSessions').doc(uid).set({
    status: 'disconnected',
    qrCode: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true };
});

/**
 * sendWhatsAppMessages — Send messages to multiple clients with anti-ban intervals
 * Uses the active WhatsApp connection
 */
export const sendWhatsAppMessages = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const uid = request.auth.uid;
  const { messages } = request.data as {
    messages: Array<{ clientId: string; celular: string; message: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Lista de mensagens vazia.');
  }

  const conn = activeConnections.get(uid);
  if (!conn?.connected) {
    throw new functions.https.HttpsError('failed-precondition', 'WhatsApp não está conectado. Escaneie o QR code primeiro.');
  }

  const results: Array<{ clientId: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    try {
      const jid = `${msg.celular.replace(/\D/g, '')}@s.whatsapp.net`;

      // Check if number is on WhatsApp
      const [result] = await conn.sock.onWhatsApp(jid);
      if (!result?.exists) {
        results.push({ clientId: msg.clientId, success: false, error: 'Número não está no WhatsApp' });
        continue;
      }

      await conn.sock.sendMessage(result.jid, { text: msg.message });
      results.push({ clientId: msg.clientId, success: true });

      // Anti-ban: random delay between 20-40 seconds
      if (i < messages.length - 1) {
        const delay = 20000 + Math.random() * 20000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      results.push({ clientId: msg.clientId, success: false, error: error.message });
    }
  }

  // Mark clients as reminded
  const successIds = results.filter((r) => r.success).map((r) => r.clientId);
  if (successIds.length > 0) {
    const batch = db.batch();
    successIds.forEach((clientId) => {
      const ref = db.collection('users').doc(uid).collection('clients').doc(clientId);
      batch.update(ref, { lembreteEnviado: true });
    });
    await batch.commit();
  }

  return { results, sent: successIds.length, total: messages.length };
});

/**
 * autoSendDailyReminders — Scheduled function that runs daily at 9am
 * Automatically sends reminders to all users who have WhatsApp connected
 */
export const autoSendDailyReminders = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    // Get all connected WhatsApp sessions
    const sessionsSnapshot = await db.collection('whatsappSessions')
      .where('status', '==', 'connected')
      .get();

    for (const sessionDoc of sessionsSnapshot.docs) {
      const uid = sessionDoc.id;
      const conn = activeConnections.get(uid);
      if (!conn?.connected) continue;

      try {
        // Get clients that need reminders
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        const hojeStr = hoje.toISOString().split('T')[0];
        const amanhaStr = amanha.toISOString().split('T')[0];

        const clientsSnapshot = await db.collection('users').doc(uid).collection('clients')
          .where('lembreteEnviado', '==', false)
          .where('desativado', '==', false)
          .get();

        const messages: Array<{ clientId: string; celular: string; message: string }> = [];

        clientsSnapshot.forEach((doc) => {
          const client = doc.data();
          const needsReminder =
            (client.trustRenewal && client.trustPaymentDate === hojeStr) ||
            client.dataVencimento === hojeStr ||
            client.dataVencimento === amanhaStr ||
            (client.dataVencimento < hojeStr && !client.trustRenewal);

          if (needsReminder && client.celular) {
            messages.push({
              clientId: doc.id,
              celular: client.celular,
              message: `Olá {nome}, lembrete de pagamento!`, // Simplified — should use template
            });
          }
        });

        // Send with intervals
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          try {
            const jid = `${msg.celular.replace(/\D/g, '')}@s.whatsapp.net`;
            const [result] = await conn.sock.onWhatsApp(jid);
            if (result?.exists) {
              await conn.sock.sendMessage(result.jid, { text: msg.message });
              await db.collection('users').doc(uid).collection('clients').doc(msg.clientId).update({
                lembreteEnviado: true,
              });
            }
          } catch {
            // Skip failed messages
          }

          // Anti-ban delay
          if (i < messages.length - 1) {
            const delay = 20000 + Math.random() * 20000;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        console.error(`Error sending reminders for user ${uid}:`, error);
      }
    }
  }
);

// ============================================================
// Legacy reminder queue functions (kept for compatibility)
// ============================================================

/**
 * enqueueReminders — Add reminders to the queue
 */
export const enqueueReminders = onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const { reminders } = request.data as { reminders: Array<{ clientId: string; clientName: string; celular: string; message: string }> };
  const uid = request.auth.uid;

  if (!reminders || !Array.isArray(reminders) || reminders.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Lista de lembretes vazia.');
  }

  const batch = db.batch();
  const queueRef = db.collection('reminderQueue');

  reminders.forEach((reminder) => {
    const docRef = queueRef.doc();
    batch.set(docRef, {
      uid,
      clientId: reminder.clientId,
      clientName: reminder.clientName,
      celular: reminder.celular,
      message: reminder.message,
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
    });
  });

  await batch.commit();
  return { queued: reminders.length };
});

/**
 * cleanupOldReminders — Runs daily to clean up old reminder queue items
 */
export const cleanupOldReminders = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    const snapshot = await db.collection('reminderQueue')
      .where('createdAt', '<', cutoff)
      .limit(500)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`Cleaned up ${snapshot.size} old reminders.`);
  }
);
