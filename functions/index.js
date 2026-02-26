const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");

console.log("-----------------------------------------");
console.log("   LOADING FUNCTIONS INDEX.JS - RESTORED");
console.log("-----------------------------------------");

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- ROBUST FETCH WITH RETRY HELPER ---
const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            return res;
        } catch (err) {
            const isNetworkError = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('network');
            if (isNetworkError && i < retries - 1) {
                const backoff = (i + 1) * 2000;
                console.warn(`[fetchWithRetry] Network error (${err.code}). Retrying in ${backoff}ms... URL: ${url}`);
                await new Promise(r => setTimeout(r, backoff));
                continue;
            }
            throw err;
        }
    }
};

// --- PROXY ENDPOINT ---
app.post("/", async (req, res) => {
    try {
        const { url, method, headers, body } = req.body;
        if (!url) return res.status(400).json({ error: "Missing target URL" });

        const fetchOptions = {
            method: method || "GET",
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetchWithRetry(url, fetchOptions);
        const data = await response.text();
        res.status(response.status);

        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.send(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

exports.proxy = functions.https.onRequest(app);

// --- USER MANAGEMENT ---
exports.createUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    const { email, password, displayName, role, allowedPanels } = data;
    try {
        const userRecord = await admin.auth().createUser({ email, password, displayName });
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid, email, displayName, role: role || 'user',
            allowedPanels: allowedPanels || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, uid: userRecord.uid };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    const { targetUid, newPassword } = data;
    try {
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admins only');
        }
        await admin.auth().updateUser(targetUid, { password: newPassword });
        return { success: true };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- EMAIL SERVICE ---
exports.sendEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
    const { to, subject, text, html } = data;
    try {
        const configDoc = await admin.firestore().collection('config').doc('smtp').get();
        if (!configDoc.exists) throw new Error("SMTP config missing");
        const smtpConfig = configDoc.data();
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host, port: parseInt(smtpConfig.port),
            secure: smtpConfig.port === '465',
            auth: { user: smtpConfig.user, pass: smtpConfig.password },
        });
        const info = await transporter.sendMail({
            from: `"${smtpConfig.fromName || 'Ion Dashboard'}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
            to, subject, text, html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==================== JIRA SERVICES ====================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

exports.fetchEpicData = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
    const { epicKey, forceRefresh = false } = request.data || {};
    if (!epicKey) throw new HttpsError('invalid-argument', 'epicKey is required');

    const auth = request.auth;
    const userId = auth?.uid || 'anonymous';

    // EMULATOR MOCKS
    if (process.env.FUNCTIONS_EMULATOR === 'true' && epicKey === 'DEVOPS-633') {
        try {
            const mockData = require('./raw_epic_data_fixed.json');
            if (mockData && mockData.result) return mockData.result;
        } catch (e) { logger.warn("Mock file not found"); }
    }

    try {
        // Cache Check
        if (!forceRefresh) {
            const cacheDoc = await admin.firestore().collection('jira_cache').doc(`epic-${epicKey}`).get();
            if (cacheDoc.exists) {
                const cache = cacheDoc.data();
                if (cache.expiresAt && cache.expiresAt.toMillis() > Date.now()) {
                    return { ...cache.data, status: 'success' };
                }
            }
        }

        // Config Load
        let config = {};
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (userDoc.exists && userDoc.data().jiraToken) {
            config = userDoc.data();
        } else {
            const sysDoc = await admin.firestore().collection('system_config').doc('jira').get();
            if (sysDoc.exists) config = sysDoc.data();
            else throw new HttpsError('failed-precondition', 'Jira not configured');
        }

        // Robust mapping: users collection uses jiraToken, system_config uses token
        const url = config.url || config.jiraUrl;
        const email = config.email || config.jiraEmail;
        const token = config.token || config.jiraToken;

        if (!url || !email || !token) {
            throw new HttpsError('failed-precondition', 'Jira configuration is incomplete (missing URL, Email, or Token)');
        }

        let jiraUrl = url.trim().replace(/\/$/, '');
        if (!jiraUrl.startsWith('http')) jiraUrl = `https://${jiraUrl}`;

        const authHeaderBasic = Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64');
        const headersBasic = { 'Authorization': `Basic ${authHeaderBasic}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };
        const headersBearer = { 'Authorization': `Bearer ${token.trim()}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

        let headers = headersBasic;
        let useBearer = false;

        // Fetch Epic
        const fields = "summary,status,issuetype,assignee,created,updated,timespent,timeoriginalestimate,aggregatetimespent,aggregatetimeoriginalestimate,aggregatetimeestimate";
        const epicUrl = `${jiraUrl}/rest/api/3/issue/${epicKey}?fields=${fields}`;
        let epicRes = await fetchWithRetry(epicUrl, { headers });

        if (epicRes.status === 401) {
            epicRes = await fetchWithRetry(epicUrl, { headers: headersBearer });
            if (epicRes.ok) { headers = headersBearer; useBearer = true; }
        }

        if (!epicRes.ok) throw new HttpsError('internal', `Jira Error ${epicRes.status}`);
        const epicData = await epicRes.json();

        // Fetch Children
        const jql = `(parent = "${epicKey}" OR "Epic Link" = "${epicKey}") AND issuetype not in (Sub-task, Subtask, Subtarefa, "Sub-tarefa")`;
        let children = [];
        let startAt = 0;
        let finalSearchUrl = `${jiraUrl}/rest/api/3/search/jql`;

        while (true) {
            const body = {
                jql, startAt, maxResults: 100,
                fields: ["summary", "status", "issuetype", "assignee", "timeoriginalestimate", "timeestimate", "timespent", "components", "created", "updated", "resolutiondate", "duedate", "parent", "customfield_10014", "customfield_10016", "attachment", "fixVersions", "priority", "aggregatetimespent", "aggregatetimeoriginalestimate", "aggregatetimeestimate", "issuelinks"]
            };
            let searchRes = await fetchWithRetry(finalSearchUrl, { method: 'POST', headers, body: JSON.stringify(body) });

            if (searchRes.status === 410 || searchRes.status === 404) {
                finalSearchUrl = `${jiraUrl}/rest/api/2/search`;
                searchRes = await fetchWithRetry(finalSearchUrl, { method: 'POST', headers, body: JSON.stringify(body) });
            }

            if (!searchRes.ok) break;
            const data = await searchRes.json();
            const issues = data.issues || [];
            children = children.concat(issues);
            if (children.length >= data.total || issues.length === 0) break;
            startAt += issues.length;
        }

        // Fetch Subtasks
        let subtasksMap = {};
        if (children.length > 0) {
            const childKeys = children.map(c => c.key);
            const subJql = `parent in ("${childKeys.join('","')}")`;
            let subStartAt = 0;
            while (true) {
                const subBody = { jql: subJql, startAt: subStartAt, maxResults: 100, fields: ["summary", "status", "issuetype", "parent", "timespent", "aggregatetimespent"] };
                const subRes = await fetchWithRetry(finalSearchUrl, { method: 'POST', headers, body: JSON.stringify(subBody) });
                if (!subRes.ok) break;
                const subData = await subRes.json();
                const subIssues = subData.issues || [];
                subIssues.forEach(s => {
                    const pk = s.fields.parent?.key;
                    if (pk) { if (!subtasksMap[pk]) subtasksMap[pk] = []; subtasksMap[pk].push(s); }
                });
                if (subIssues.length === 0) break;
                subStartAt += subIssues.length;
            }
        }

        const result = {
            status: 'success',
            epic: { id: epicData.id, key: epicData.key, fields: epicData.fields },
            children: children.map(child => {
                const subs = subtasksMap[child.key] || [];
                const doneSubs = subs.filter(s => s.fields.status?.statusCategory?.key === 'done').length;
                let progress = 0;
                if (child.fields.status?.statusCategory?.key === 'done') progress = 100;
                else if (subs.length > 0) progress = Math.round((doneSubs / subs.length) * 100);
                return {
                    id: child.id, key: child.key,
                    fields: {
                        ...child.fields,
                        subtasks: subs.map(st => ({ id: st.id, key: st.key, fields: st.fields })),
                        progress
                    }
                };
            })
        };

        // Cache Save
        const expiry = new Date(Date.now() + 30 * 60 * 1000);
        await admin.firestore().collection('jira_cache').doc(`epic-${epicKey}`).set({
            key: `epic-${epicKey}`, type: 'epic_details', data: result,
            expiresAt: admin.firestore.Timestamp.fromDate(expiry), version: 10 // Bumped
        });

        return result;
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

exports.fetchStrategicObjectives = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
    const { projectKey = 'ION', forceRefresh = false } = request.data || {};
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');

    // EMULATOR
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
        return { objectives: [{ key: 'DEVOPS-633', fields: { summary: 'Mock Epic', status: { name: 'Em Progresso', statusCategory: { key: 'indeterminate' } } } }] };
    }

    try {
        const cacheKey = `strategic-objectives-${projectKey}`;
        if (!forceRefresh) {
            const cacheDoc = await admin.firestore().collection('jira_cache').doc(cacheKey).get();
            if (cacheDoc.exists) {
                const cache = cacheDoc.data();
                if (cache.expiresAt && cache.expiresAt.toMillis() > Date.now()) return cache.data;
            }
        }

        const sysDoc = await admin.firestore().collection('system_config').doc('jira').get();
        const { url, email, token } = sysDoc.data();
        if (!url || !email || !token) {
            throw new HttpsError('failed-precondition', 'Global Jira configuration is incomplete');
        }

        let jiraUrl = url.trim().replace(/\/$/, '');
        if (!jiraUrl.startsWith('http')) jiraUrl = `https://${jiraUrl}`;

        const authHeader = Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64');
        const headers = { 'Authorization': `Basic ${authHeader}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

        const jql = `project = ${projectKey.replace(/[^a-zA-Z0-9-_]/g, '')} AND issuetype = Epic AND status != Done ORDER BY created DESC`;
        const searchUrl = `${jiraUrl}/rest/api/3/search/jql`;
        const res = await fetchWithRetry(searchUrl, {
            method: 'POST', headers,
            body: JSON.stringify({ jql, fields: ["summary", "status", "description", "created", "updated", "fixVersions"], maxResults: 100 })
        });

        if (!res.ok) throw new HttpsError('internal', `Jira Error ${res.status}`);
        const data = await res.json();
        const result = { objectives: data.issues || [] };

        const expiry = new Date(Date.now() + 30 * 60 * 1000);
        await admin.firestore().collection('jira_cache').doc(cacheKey).set({
            key: cacheKey, type: 'objectives', data: result,
            expiresAt: admin.firestore.Timestamp.fromDate(expiry)
        });

        return result;
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});