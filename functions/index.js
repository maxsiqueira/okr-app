const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

console.log("-----------------------------------------");
console.log("   LOADING FUNCTIONS INDEX.JS - VERSION 3");
console.log("-----------------------------------------");

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.post("/", async (req, res) => {
    try {
        const { url, method, headers, body } = req.body;

        if (!url) {
            return res.status(400).json({ error: "Missing target URL" });
        }

        const fetchOptions = {
            method: method || "GET",
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetchWithRetry(url, fetchOptions);
        const data = await response.text();

        res.status(response.status);

        // Pass relevant headers back
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

exports.createUser = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to create users.');
    }

    const { email, password, displayName, role, allowedPanels } = data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role: role || 'user',
            allowedPanels: allowedPanels || [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, uid: userRecord.uid };
    } catch (error) {
        console.error("Error creating user:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.sendEmail = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send emails.');
    }

    const { to, subject, text, html } = data;
    const nodemailer = require("nodemailer");

    try {
        // Fetch SMTP config from Firestore
        const configDoc = await admin.firestore().collection('config').doc('smtp').get();

        if (!configDoc.exists) {
            throw new Error("SMTP configuration not found in Firestore.");
        }

        const smtpConfig = configDoc.data();

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: parseInt(smtpConfig.port),
            secure: smtpConfig.port === '465', // true for 465, false for other ports
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.password,
            },
        });

        const mailOptions = {
            from: `"${smtpConfig.fromName || 'Ion Dashboard'}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
            to,
            subject,
            text,
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.messageId);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to update passwords.');
    }

    const { targetUid, newPassword } = data;

    try {
        // 1. Check if the caller is an admin
        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can update user passwords.');
        }

        // 2. Update the password
        await admin.auth().updateUser(targetUid, {
            password: newPassword
        });

        return { success: true };
    } catch (error) {
        console.error("Error updating user password:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ==================== JIRA PROXY FUNCTIONS ====================
// Secure, server-side Jira API proxy with Firestore caching

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

/**
 * Fetch Epic Details from Jira API (server-side, secure)
 * Uses system_config/jira credentials (admin only)
 * Implements Firestore caching for mobile performance
 */
exports.fetchEpicData = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
    // STARTUP LOG - VERSION 8 (Timeout Fix)
    logger.info(`[fetchEpicData] STARTING - VERSION 8 (Timeout Fix)`);

    // Extract data and auth from V2 request object
    const data = request.data;
    const auth = request.auth;

    // DEBUG: Log received data structure IMMEDIATELY
    logger.info(`[fetchEpicData] Received DATA content:`, data);
    logger.info(`[fetchEpicData] Received AUTH:`, auth);

    // --- HELPER: ROBUST FETCH WITH RETRY ---
    const fetchWithRetry = async (url, options, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, options);
                return res;
            } catch (err) {
                const isNetworkError = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('network');
                if (isNetworkError && i < retries - 1) {
                    const backoff = (i + 1) * 2000;
                    logger.warn(`[fetchWithRetry] Network error (${err.code}). Retrying in ${backoff}ms... URL: ${url}`);
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }
                throw err;
            }
        }
    };
    // ---------------------------------------

    const { epicKey, forceRefresh = false } = data || {};

    if (!epicKey) {
        logger.error('[fetchEpicData] VERSION 6: Missing epicKey. Data was:', data);
        throw new HttpsError('invalid-argument', 'epicKey is required');
    }

    const userId = auth?.uid || 'anonymous';
    logger.info(`[fetchEpicData] User ${userId} requesting epic: ${epicKey}, forceRefresh: ${forceRefresh}`);

    try {
        // Check cache first (unless forceRefresh)
        if (!forceRefresh) {
            try {
                const cacheDoc = await admin.firestore().collection('jira_cache').doc(`epic-${epicKey}`).get();

                if (cacheDoc.exists) {
                    const cache = cacheDoc.data();
                    const now = Date.now();

                    // Check expiry (24 hours default)
                    if (cache.expiresAt && cache.expiresAt.toMillis() > now) {
                        // VALIDATE CACHE CONTENT: Must have new fields (aggregatetimespent, fixVersions)
                        // If missing, consider cache invalid/stale for our new needs
                        const hasNewFields = cache.data.epic.fields.aggregatetimespent !== undefined ||
                            cache.data.children?.[0]?.fields?.fixVersions !== undefined;

                        if (hasNewFields) {
                            logger.info(`[fetchEpicData] Cache HIT for epic-${epicKey}`);
                            return { ...cache.data, status: 'success' };
                        } else {
                            logger.info(`[fetchEpicData] Cache HIT but STALE (Missing new fields) for epic-${epicKey} -> Refetching`);
                        }
                    } else {
                        logger.info(`[fetchEpicData] Cache EXPIRED for epic-${epicKey}`);
                    }
                } else {
                    logger.info(`[fetchEpicData] Cache MISS for epic-${epicKey}`);
                }
            } catch (cacheError) {
                logger.warn(`[fetchEpicData] Cache error (ignoring): ${cacheError.message}`);
            }
        }

        // Fetch Jira credentials (User Personal Settings OR System Global)
        let config = {};
        let configSource = 'NONE';

        if (userId && userId !== 'anonymous') {
            try {
                logger.info(`[fetchEpicData] Checking personal settings for user ${userId}...`);
                const userDoc = await admin.firestore().collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.jiraUrl && userData.jiraEmail && userData.jiraToken) {
                        config = {
                            url: userData.jiraUrl,
                            email: userData.jiraEmail,
                            token: userData.jiraToken
                        };
                        configSource = 'USER_PROFILE';
                    }
                }
            } catch (err) {
                logger.warn(`[fetchEpicData] Failed to read user profile: ${err.message}`);
            }
        }

        if (configSource === 'NONE') {
            logger.info(`[fetchEpicData] Loading global Jira config from system_config...`);
            const configDoc = await admin.firestore().collection('system_config').doc('jira').get();

            if (configDoc.exists) {
                config = configDoc.data();
                configSource = 'SYSTEM_GLOBAL';
            } else {
                logger.error(`[fetchEpicData] ERROR: system_config/jira not found`);
                throw new HttpsError('failed-precondition', 'Jira configuration not found. Please configure Jira in Settings.');
            }
        }

        const { url, email, token } = config;

        // Log config status (masked)
        logger.info(`[fetchEpicData] Config loaded from ${configSource}. URL: ${url}, Email: ${email}, Token: ${token ? '******' : 'MISSING'}`);

        if (!url || !email || !token) {
            logger.error(`[fetchEpicData] ERROR: Incomplete config`);
            throw new HttpsError('failed-precondition', 'Incomplete Jira configuration.');
        }

        // Clean URL
        let jiraUrl = url.trim();
        if (!jiraUrl.startsWith('http')) jiraUrl = `https://${jiraUrl}`;
        jiraUrl = jiraUrl.replace(/\/$/, '');

        logger.info(`[fetchEpicData] Cleaned Jira URL: ${jiraUrl}`);

        // Create auth header
        // Create auth headers (Basic & Bearer)
        const authHeaderBasic = Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64');
        const headersBasic = {
            'Authorization': `Basic ${authHeaderBasic}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        const headersBearer = {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // Start with Basic Auth by default
        let headers = headersBasic;
        let useBearer = false;

        // Fetch Epic details (Try v3 first, fallback to v2)
        let epicResponse;
        let apiVersion = 3;

        const fieldsParams = "summary,status,issuetype,assignee,created,updated,timespent,timeoriginalestimate,aggregatetimespent,aggregatetimeoriginalestimate,aggregatetimeestimate";
        const epicUrlV3 = `${jiraUrl}/rest/api/3/issue/${epicKey}?fields=${fieldsParams}`;
        const epicUrlV2 = `${jiraUrl}/rest/api/2/issue/${epicKey}?fields=${fieldsParams}`;

        logger.info(`[fetchEpicData] Attempting v3 fetch: ${epicUrlV3}`);
        epicResponse = await fetchWithRetry(epicUrlV3, { headers });

        // AUTH RETRY: If 401, try Bearer Token (PAT)
        if (epicResponse.status === 401) {
            logger.warn(`[fetchEpicData] v3 returned 401 (Unauthorized) with Basic Auth. Retrying with Bearer Token...`);
            epicResponse = await fetchWithRetry(epicUrlV3, { headers: headersBearer });
            if (epicResponse.status !== 401) {
                logger.info(`[fetchEpicData] Bearer Token authentication SUCCESS.`);
                headers = headersBearer;
                useBearer = true;
            }
        }

        // VERSION FALLBACK: If 404 or 410 (Gone), try v2
        if (epicResponse.status === 404 || epicResponse.status === 410) {
            logger.warn(`[fetchEpicData] v3 returned ${epicResponse.status} for ${epicKey}. Fallback to v2...`);
            epicResponse = await fetchWithRetry(epicUrlV2, { headers });

            // If v2 gave 401 and we haven't tried Bearer yet, try it now
            if (epicResponse.status === 401 && !useBearer) {
                logger.warn(`[fetchEpicData] v2 returned 401. Retrying with Bearer Token...`);
                epicResponse = await fetchWithRetry(epicUrlV2, { headers: headersBearer });
                if (epicResponse.status !== 401) {
                    headers = headersBearer;
                    logger.info(`[fetchEpicData] Bearer Token authentication SUCCESS (on v2).`);
                }
            }

            if (epicResponse.ok) {
                apiVersion = 2;
                logger.info(`[fetchEpicData] v2 fetch SUCCESS`);
            }
        }

        logger.info(`[fetchEpicData] Epic response status: ${epicResponse.status}`);

        if (!epicResponse.ok) {
            const errorText = await epicResponse.text();
            logger.error(`[fetchEpicData] Jira API error: ${epicResponse.status} - ${errorText}`);

            if (epicResponse.status === 401) {
                logger.error(`[fetchEpicData] Authentication failed (401). Body: ${errorText}`);
                throw new HttpsError('unauthenticated', `Jira Auth Failed (401): ${errorText || 'Check your credentials.'}`);
            }

            if (epicResponse.status === 404) {
                // --- DEEP DIAGNOSTICS START ---
                logger.warn(`[fetchEpicData] v3 & v2 failed. Running diagnostics...`);

                let diagnosticMsg = `Epic ${epicKey} not found.`;

                try {
                    // 1. Check Credentials (Who am I?)
                    const myselfUrl = `${jiraUrl}/rest/api/3/myself`;
                    const myselfRes = await fetchWithRetry(myselfUrl, { headers });

                    if (myselfRes.ok) {
                        const myselfData = await myselfRes.json();
                        diagnosticMsg += ` Auth OK (User: ${myselfData.displayName || myselfData.emailAddress}).`;

                        // 2. Check Project Access
                        const projectKey = epicKey.split('-')[0];
                        const projectUrl = `${jiraUrl}/rest/api/3/project/${projectKey}`;
                        const projectRes = await fetchWithRetry(projectUrl, { headers });

                        if (projectRes.ok) {
                            diagnosticMsg += ` Project '${projectKey}' is Accessible.`;
                            diagnosticMsg += ` CONCLUSION: The Issue Key '${epicKey}' likely does not exist or you lack 'Browse Issues' permission for it.`;
                        } else if (projectRes.status === 404 || projectRes.status === 403) {
                            diagnosticMsg += ` Project '${projectKey}' NOT FOUND or ACCESS DENIED. Check permissions.`;
                        }
                    } else {
                        diagnosticMsg += ` Auth Check failed (${myselfRes.status}). Credentials might be invalid.`;
                    }
                } catch (diagErr) {
                    diagnosticMsg += ` Diagnostics failed: ${diagErr.message}`;
                }

                // Throw the enhanced error
                throw new HttpsError('not-found', diagnosticMsg);
                // --- DEEP DIAGNOSTICS END ---
            }
            if (epicResponse.status === 401) {
                throw new HttpsError('unauthenticated', `Jira API unauthorized. Check credentials.`);
            }
            throw new HttpsError('internal', `Jira API error: ${epicResponse.status} - ${errorText}`);
        }

        const epicData = await epicResponse.json();
        logger.info(`[fetchEpicData] Epic loaded: ${epicData.key} (via API v${apiVersion})`);

        // Fetch children (Converted to POST per CHANGE-2046)
        // Fetch children (Converted to POST per CHANGE-2046)
        const jql = `(parent = "${epicKey}" OR "Epic Link" = "${epicKey}") AND issuetype not in (Sub-task, Subtask, Subtarefa, "Sub-tarefa")`;

        // Use the same API version that worked for the text epic
        const searchPath = apiVersion === 2 ? 'search' : 'search/jql';
        const searchUrl = `${jiraUrl}/rest/api/${apiVersion}/${searchPath}`;

        // If v2, use standard search endpoint (search/jql might not exist on old v2)
        // If v3, use search/jql if that's what was working, or standard search. 
        // Note: The previous code was using `/rest/api/3/search/jql`.
        // Let's force /rest/api/2/search for v2, and keep /rest/api/3/search/jql for v3 just in case,
        // (Though standard /search works for both usually, unless 'jql' specific endpoint is needed for strict jql validation).

        // Simpler approach:
        // v3 -> /rest/api/3/search/jql
        // v2 -> /rest/api/2/search

        let finalSearchUrl;
        if (apiVersion === 2) {
            finalSearchUrl = `${jiraUrl}/rest/api/2/search`;
        } else {
            // Standard search endpoint for v3 is /search, not /search/jql
            // ERROR 410 (Step 780): "The requested API was removed. Migrate to /rest/api/3/search/jql."
            // So we MUST use /search/jql for v3.
            finalSearchUrl = `${jiraUrl}/rest/api/3/search/jql`;
        }

        // Initialize children iteration
        let children = [];
        let startAtChildren = 0;
        let totalChildrenFound = 0;
        let pageRetryCount = 0;

        logger.info(`[fetchEpicData] Fetching children with JQL (POST) via v${apiVersion}: ${jql}. Endpoint: ${finalSearchUrl}`);

        while (true) {
            const childrenBody = {
                jql: jql,
                fields: ["summary", "status", "issuetype", "assignee", "timeoriginalestimate", "timeestimate", "timespent", "components", "created", "updated", "resolutiondate", "duedate", "parent", "customfield_10014", "attachment", "fixVersions", "priority", "aggregatetimespent", "aggregatetimeoriginalestimate", "aggregatetimeestimate", "issuelinks"],
                maxResults: 100, // Reduced from 1000 to be safe
                startAt: startAtChildren
            };

            const childrenResponse = await fetchWithRetry(finalSearchUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(childrenBody)
            });

            if (!childrenResponse.ok) {
                const errorText = await childrenResponse.text();

                // FALLBACK FOR CHILDREN: If v3 fails with 400/404/410 on first page, try v2
                // We check startAtChildren === 0 to avoid switching mid-pagination.
                // 400 (Bad Request) added because v3 search endpoints can be extremely strict with payloads.
                if (startAtChildren === 0 && (childrenResponse.status === 404 || childrenResponse.status === 410 || childrenResponse.status === 400)) {
                    // SMART RECOVERY: If error says "Migrate to ...", use that URL
                    // Note: errorText is already awaited above
                    if (childrenResponse.status === 410 && errorText.includes('Migrate to')) {
                        logger.warn(`[fetchEpicData] API v${apiVersion} is GONE (410). Message implies migration. Switching to v3 JQL endpoint...`);
                        apiVersion = 3;
                        finalSearchUrl = `${jiraUrl}/rest/api/3/search/jql`;
                        continue;
                    }

                    if (apiVersion === 3) {
                        logger.warn(`[fetchEpicData] Children fetch v3 failed (${childrenResponse.status}) at URL ${finalSearchUrl}. Fallback to v2...`);
                        apiVersion = 2;
                        finalSearchUrl = `${jiraUrl}/rest/api/2/search`;
                        continue; // Retry immediately with v2 URL
                    } else {
                        logger.error(`[fetchEpicData] Children fetch v2 ALSO failed (${childrenResponse.status}). Cannot fallback further.`);
                        // Do not continue, let it fall through to error handling
                    }
                }

                // RETRY ON RATE LIMIT (429)
                if (childrenResponse.status === 429) {
                    pageRetryCount++;
                    const maxRetries = 4;
                    if (pageRetryCount <= maxRetries) {
                        const backoff = Math.min(2000 * Math.pow(2, pageRetryCount - 1), 10000);
                        logger.warn(`[fetchEpicData] Rate limited (429) at startAt ${startAtChildren}. Retrying in ${backoff}ms (Attempt ${pageRetryCount}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoff));
                        continue; // Retry same page
                    }
                    logger.error(`[fetchEpicData] Rate limited (429) - Max retries exhausted.`);
                }

                logger.error(`[fetchEpicData] Children fetch failed at startAt ${startAtChildren}: ${childrenResponse.status} - ${errorText}`);
                if (children.length === 0) {
                    // If first page fails, throw error. If subsequent pages fail, logging and breaking is safer to return partial data.
                    throw new HttpsError('internal', `Failed to fetch children (${childrenResponse.status}): ${errorText}`);
                }
                break;
            }

            // Success - Reset retry count
            pageRetryCount = 0;

            const childrenData = await childrenResponse.json();
            const pageIssues = childrenData.issues || [];
            children = children.concat(pageIssues);
            totalChildrenFound = childrenData.total || 0;

            logger.info(`[fetchEpicData] Children Page: startAt=${startAtChildren}, count=${pageIssues.length}, total=${totalChildrenFound}`);

            if (children.length >= totalChildrenFound || pageIssues.length === 0) break;
            startAtChildren += pageIssues.length;
        }

        logger.info(`[fetchEpicData] Found ${children.length} total children`);

        // Fetch subtasks (with pagination support)
        let subtasksMap = {};
        if (children.length > 0) {
            const childKeys = children.map(c => c.key);
            const subtaskJql = `parent in ("${childKeys.join('","')}")`;
            let startAt = 0;
            let totalFound = 0;
            let subtasks = [];

            logger.info(`[fetchEpicData] Fetching subtasks for ${childKeys.length} children. JQL: ${subtaskJql}`);

            while (true) {
                const subtasksBody = {
                    jql: subtaskJql,
                    fields: ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "resolutiondate", "duedate", "timespent", "timeoriginalestimate", "timeestimate", "fixVersions", "components", "priority", "aggregatetimespent"],
                    maxResults: 100, // Explicitly small to test pagination or use 1000
                    startAt: startAt
                };

                const subtasksResponse = await fetchWithRetry(finalSearchUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(subtasksBody)
                });

                if (!subtasksResponse.ok) {
                    logger.error(`[fetchEpicData] Failed to fetch subtasks at startAt ${startAt}: ${subtasksResponse.status}`);
                    break;
                }

                const subtasksData = await subtasksResponse.json();
                const pageIssues = subtasksData.issues || [];
                subtasks = subtasks.concat(pageIssues);
                totalFound = subtasksData.total || 0;

                logger.info(`[fetchEpicData] Subtask Page: startAt=${startAt}, count=${pageIssues.length}, total=${totalFound}`);

                if (subtasks.length >= totalFound || pageIssues.length === 0) break;
                startAt += pageIssues.length;
            }

            logger.info(`[fetchEpicData] Total subtasks collected: ${subtasks.length}`);

            subtasks.forEach(sub => {
                const parentKey = sub.fields.parent?.key;
                if (parentKey) {
                    if (!subtasksMap[parentKey]) subtasksMap[parentKey] = [];
                    subtasksMap[parentKey].push(sub);
                }
            });
        }

        // Build result
        const result = {
            status: 'success',
            epic: {
                id: epicData.id,
                key: epicData.key,
                fields: epicData.fields
            },
            children: children.map(child => {
                const subtasks = subtasksMap[child.key] || [];
                const doneSubtasks = subtasks.filter(s => s.fields.status?.statusCategory?.key === 'done').length;
                const progress = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0;

                return {
                    id: child.id,
                    key: child.key,
                    fields: {
                        ...child.fields,
                        subtasks: subtasks.map(st => ({
                            id: st.id,
                            key: st.key,
                            fields: st.fields
                        })),
                        progress
                    }
                };
            })
        };

        // Save to cache (30 min TTL)
        try {
            const cacheExpiry = new Date(Date.now() + 30 * 60 * 1000);
            const totalSubtasksFound = Object.values(subtasksMap).reduce((acc, subs) => acc + subs.length, 0);
            logger.info(`[fetchEpicData] Saving to cache: ${children.length} children, ${totalSubtasksFound} total subtasks`);

            await admin.firestore().collection('jira_cache').doc(`epic-${epicKey}`).set({
                key: `epic-${epicKey}`,
                type: 'epic_details',
                data: result,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(cacheExpiry),
                version: 3 // BUMPED AGAIN to force refresh after pagination fix
            });
            logger.info(`[fetchEpicData] Cache SET for epic-${epicKey} (v3)`);
        } catch (cacheError) {
            logger.warn(`[fetchEpicData] Cache SET error: ${cacheError.message}`);
        }

        return result;

    } catch (error) {
        logger.error(`[fetchEpicData] FATAL ERROR:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Internal error: ${error.message}`);
    }
});

/**
 * Fetch Strategic Objectives from Jira (for OKR panel)
 */
exports.fetchStrategicObjectives = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
    // Extract data and auth from V2 request object
    const data = request.data;
    const auth = request.auth;

    if (!auth) {
        throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { forceRefresh = false, projectKey = 'ION' } = data;

    // Use logger instead of console.log for v2
    logger.info(`[fetchStrategicObjectives] User ${auth.uid}, project: ${projectKey}, forceRefresh: ${forceRefresh}`);

    try {
        // Check cache with project key
        const cacheKey = `strategic-objectives-${projectKey}`;
        if (!forceRefresh) {
            const cacheDoc = await admin.firestore()
                .collection('jira_cache')
                .doc(cacheKey)
                .get();

            if (cacheDoc.exists) {
                const cache = cacheDoc.data();
                if (cache.expiresAt && cache.expiresAt.toMillis() > Date.now()) {
                    logger.info(`[fetchStrategicObjectives] Cache HIT`);
                    return cache.data;
                }
            }
        }

        // Fetch Jira credentials (User Personal Settings OR System Global)
        let config = {};
        let configSource = 'NONE';
        const userId = auth.uid;

        if (userId) {
            try {
                logger.info(`[fetchStrategicObjectives] Checking personal settings for user ${userId}...`);
                const userDoc = await admin.firestore().collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.jiraUrl && userData.jiraEmail && userData.jiraToken) {
                        config = {
                            url: userData.jiraUrl,
                            email: userData.jiraEmail,
                            token: userData.jiraToken
                        };
                        configSource = 'USER_PROFILE';
                    }
                }
            } catch (err) {
                logger.warn(`[fetchStrategicObjectives] Failed to read user profile: ${err.message}`);
            }
        }

        if (configSource === 'NONE') {
            const configDoc = await admin.firestore().collection('system_config').doc('jira').get();
            if (configDoc.exists) {
                config = configDoc.data();
                configSource = 'SYSTEM_GLOBAL';
            } else {
                throw new HttpsError('failed-precondition', 'Jira not configured');
            }
        }

        let jiraUrl = config.url.trim();
        if (!jiraUrl.startsWith('http')) jiraUrl = `https://${jiraUrl}`;
        jiraUrl = jiraUrl.replace(/\/$/, '');

        // Create auth headers (Basic & Bearer)
        const authHeaderBasic = Buffer.from(`${config.email.trim()}:${config.token.trim()}`).toString('base64');
        const headersBasic = {
            'Authorization': `Basic ${authHeaderBasic}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        const headersBearer = {
            'Authorization': `Bearer ${config.token.trim()}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        let headers = headersBasic;
        let useBearer = false;


        // Fetch objectives (customize JQL as needed)
        // Ensure projectKey is sanitized to alphanumeric + dash/underscore to prevent injection
        const sanitizedProject = projectKey.replace(/[^a-zA-Z0-9-_]/g, '');
        const jql = `project = ${sanitizedProject} AND issuetype = Epic AND status != Done ORDER BY created DESC`;

        // Use POST search to avoid 410/404 on GET or length issues
        // Strategy: Try v3, if 404, try v2
        // Use POST search to avoid 410/404 on GET or length issues
        // Strategy: Try v3 (search/jql), if 404/410/400, try v2
        // Update per Step 780: Migrate to /rest/api/3/search/jql
        let searchUrl = `${jiraUrl}/rest/api/3/search/jql`;
        let apiVersion = 3;

        const body = {
            jql: jql,
            fields: ["summary", "status", "description", "created", "updated", "fixVersions"],
            maxResults: 100
        };

        logger.info(`[fetchStrategicObjectives] Searching via v3: ${searchUrl}`);
        let response = await fetchWithRetry(searchUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        // AUTH RETRY: If 401, try Bearer Token (PAT)
        if (response.status === 401) {
            logger.warn(`[fetchStrategicObjectives] v3 returned 401 (Unauthorized) with Basic Auth. Retrying with Bearer Token...`);
            response = await fetchWithRetry(searchUrl, {
                method: 'POST',
                headers: headersBearer,
                body: JSON.stringify(body)
            });
            if (response.status !== 401) {
                logger.info(`[fetchStrategicObjectives] Bearer Token authentication SUCCESS.`);
                headers = headersBearer;
                useBearer = true;
            }
        }

        if (response.status === 404 || response.status === 400 || response.status === 405 || response.status === 410) {
            logger.warn(`[fetchStrategicObjectives] v3 failed (${response.status}) at ${searchUrl}. Fallback to v2...`);
            searchUrl = `${jiraUrl}/rest/api/2/search`;
            apiVersion = 2;

            response = await fetchWithRetry(searchUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            // If v2 gave 401 and we haven't tried Bearer yet, try it now
            if (response.status === 401 && !useBearer) {
                logger.warn(`[fetchStrategicObjectives] v2 returned 401. Retrying with Bearer Token...`);
                response = await fetchWithRetry(searchUrl, {
                    method: 'POST',
                    headers: headersBearer,
                    body: JSON.stringify(body)
                });
                if (response.status !== 401) {
                    headers = headersBearer; // Update for future calls if needed
                    logger.info(`[fetchStrategicObjectives] Bearer Token authentication SUCCESS (on v2).`);
                }
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`[fetchStrategicObjectives] Jira API error: ${response.status} - ${errorText}`);

            if (response.status === 401) {
                throw new HttpsError('unauthenticated', `Jira Auth Failed (401): ${errorText || 'Check your credentials.'}`);
            }

            throw new HttpsError('internal', `Jira search failed: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        const result = { objectives: responseData.issues || [] };

        // Cache for 30 min
        const cacheExpiry = new Date(Date.now() + 30 * 60 * 1000);
        await admin.firestore()
            .collection('jira_cache')
            .doc(cacheKey)
            .set({
                key: cacheKey,
                type: 'objectives',
                data: result,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(cacheExpiry),
                version: 1,
                projectKey: sanitizedProject
            });

        logger.info(`[fetchStrategicObjectives] Cache SET`);

        return result;

    } catch (error) {
        logger.error(`[fetchStrategicObjectives] Error:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Internal error: ${error.message}`);
    }
});
