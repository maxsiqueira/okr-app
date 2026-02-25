const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

admin.initializeApp();

// --- Funções de Sistema (E-mail e Usuários) ---

exports.createUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
    const { email, password, displayName, role } = data;
    try {
        const userRecord = await admin.auth().createUser({ email, password, displayName });
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid, email, displayName, role: role || 'user', createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) { throw new functions.https.HttpsError('internal', error.message); }
});

exports.sendEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login necessário');
    const nodemailer = require("nodemailer");
    try {
        const configDoc = await admin.firestore().collection('config').doc('smtp').get();
        if (!configDoc.exists) throw new Error("Configuração SMTP não encontrada");
        const smtp = configDoc.data();
        const transporter = nodemailer.createTransport({
            host: smtp.host, port: parseInt(smtp.port),
            auth: { user: smtp.user, pass: smtp.password }
        });
        await transporter.sendMail({
            from: `"${smtp.fromName || 'Ion Dashboard'}" <${smtp.fromEmail || smtp.user}>`,
            to: data.to, subject: data.subject, html: data.html
        });
        return { success: true };
    } catch (error) { throw new functions.https.HttpsError('internal', error.message); }
});

// ==================== JIRA PROXY (FIX 410 + STORY POINTS) ====================

exports.fetchEpicData = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
    const { epicKey } = request.data || {};
    const configDoc = await admin.firestore().collection('system_config').doc('jira').get();
    const { url, email, token } = configDoc.data();
    const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

    try {
        const epicRes = await fetch(`${url}/rest/api/3/issue/${epicKey}`, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } });
        const epicData = await epicRes.json();

        // JQL Fix para erro 410
        const jql = `parent = "${epicKey}" OR "Epic Link" = "${epicKey}"`;
        const searchRes = await fetch(`${url}/rest/api/3/search/jql`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jql, maxResults: 100,
                fields: ["summary", "status", "issuetype", "customfield_10016", "progress", "parent"]
            })
        });

        const searchData = await searchRes.json();
        const children = (searchData.issues || []).map(child => ({
            ...child,
            progress: child.fields.status?.statusCategory?.key === 'done' ? 100 : (child.fields.progress || 0)
        }));

        return { status: 'success', epic: { key: epicData.key, fields: epicData.fields }, children };
    } catch (error) { throw new HttpsError('internal', error.message); }
});