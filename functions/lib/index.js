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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldReminders = exports.markReminderOpened = exports.getPendingReminders = exports.processReminderQueue = exports.enqueueReminders = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v2"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
admin.initializeApp();
const db = admin.firestore();
/**
 * enqueueReminders — Called from the frontend to add reminders to the queue.
 */
exports.enqueueReminders = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    const { reminders } = request.data;
    const uid = request.auth.uid;
    if (!reminders || !Array.isArray(reminders) || reminders.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de lembretes vazia.');
    }
    const batch = db.batch();
    const queueRef = db.collection('reminderQueue');
    reminders.forEach((reminder) => {
        const docRef = queueRef.doc();
        const item = {
            uid,
            clientId: reminder.clientId,
            clientName: reminder.clientName,
            celular: reminder.celular,
            message: reminder.message,
            status: 'pending',
            createdAt: admin.firestore.Timestamp.now(),
        };
        batch.set(docRef, item);
    });
    await batch.commit();
    return { queued: reminders.length };
});
/**
 * processReminderQueue — Triggered by Firestore document creation.
 * Generates the WhatsApp URL and marks as sent.
 */
exports.processReminderQueue = (0, firestore_1.onDocumentCreated)('reminderQueue/{docId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    if (data.status !== 'pending')
        return;
    const celular = data.celular.replace(/\D/g, '');
    const url = `https://wa.me/${celular}?text=${encodeURIComponent(data.message)}`;
    await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.Timestamp.now(),
        whatsappUrl: url,
    });
});
/**
 * getPendingReminders — Called from the frontend to get sent reminders
 * so the frontend can open them with intervals.
 */
exports.getPendingReminders = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    const uid = request.auth.uid;
    const snapshot = await db.collection('reminderQueue')
        .where('uid', '==', uid)
        .where('status', '==', 'sent')
        .orderBy('sentAt', 'asc')
        .limit(50)
        .get();
    const reminders = [];
    snapshot.forEach((doc) => {
        const d = doc.data();
        reminders.push({
            id: doc.id,
            clientId: d.clientId,
            clientName: d.clientName,
            whatsappUrl: d.whatsappUrl,
        });
    });
    return { reminders };
});
/**
 * markReminderOpened — Called from the frontend after opening a WhatsApp link.
 */
exports.markReminderOpened = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    const { reminderId, clientId } = request.data;
    const uid = request.auth.uid;
    const doc = await db.collection('reminderQueue').doc(reminderId).get();
    if (!doc.exists || doc.data()?.uid !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Acesso negado.');
    }
    await doc.ref.delete();
    await db.collection('users').doc(uid).collection('clients').doc(clientId).update({
        lembreteEnviado: true,
    });
    return { success: true };
});
/**
 * cleanupOldReminders — Runs daily to clean up old reminder queue items
 */
exports.cleanupOldReminders = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *',
    timeZone: 'America/Sao_Paulo',
}, async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const snapshot = await db.collection('reminderQueue')
        .where('createdAt', '<', cutoff)
        .limit(500)
        .get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} old reminders.`);
});
