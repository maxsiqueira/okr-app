const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

/**
 * Fetch Epic Details from Jira API (server-side, secure)
 * Uses system_config/jira credentials (admin only)
 * Implements Firestore caching for mobile performance
 */
exports.fetchEpicData = functions.https.onCall(async (data, context) => {
    // 1. Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { epicKey, forceRefresh = false } = data;

    if (!epicKey) {
        throw new functions.https.HttpsError('invalid-argument', 'epicKey is required');
    }

    console.log(`[fetchEpicData] User ${context.auth.uid} requesting epic: ${epicKey}, forceRefresh: ${forceRefresh}`);

    try {
        // 2. Check cache first (unless forceRefresh)
        if (!forceRefresh) {
            const cacheDoc = await admin.firestore()
                .collection('jira_cache')
                .doc(`epic-${epicKey}`)
                .get();

            if (cacheDoc.exists) {
                const cache = cacheDoc.data();
                const now = Date.now();

                // Check if cache is still valid (not expired)
                if (cache.expiresAt && cache.expiresAt.toMillis() > now) {
                    console.log(`[fetchEpicData] Cache HIT for epic-${epicKey}`);
                    return cache.data;
                } else {
                    console.log(`[fetchEpicData] Cache EXPIRED for epic-${epicKey}`);
                }
            } else {
                console.log(`[fetchEpicData] Cache MISS for epic-${epicKey}`);
            }
        }

        // 3. Fetch Jira credentials from system_config
        const configDoc = await admin.firestore()
            .collection('system_config')
            .doc('jira')
            .get();

        if (!configDoc.exists) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Jira system configuration not found. Admin must configure Jira first.'
            );
        }

        const config = configDoc.data();
        const { url, email, token } = config;

        if (!url || !email || !token) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Incomplete Jira configuration. Admin must configure URL, email, and token.'
            );
        }

        // Clean URL
        let jiraUrl = url.trim();
        if (!jiraUrl.startsWith('http')) {
            jiraUrl = `https://${jiraUrl}`;
        }
        jiraUrl = jiraUrl.replace(/\/$/, '');

        // 4. Create auth header
        const authHeader = Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${authHeader}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // 5. Fetch Epic details
        console.log(`[fetchEpicData] Fetching epic from Jira: ${epicKey}`);
        const epicResponse = await fetch(
            `${jiraUrl}/rest/api/3/issue/${epicKey}?fields=summary,status,issuetype,assignee,created,updated,timespent,timeoriginalestimate`,
            { headers }
        );

        if (!epicResponse.ok) {
            if (epicResponse.status === 404) {
                throw new functions.https.HttpsError('not-found', `Epic ${epicKey} not found in Jira`);
            }
            throw new functions.https.HttpsError('internal', `Jira API error: ${epicResponse.status}`);
        }

        const epicData = await epicResponse.json();

        // 6. Fetch children (tasks linked to this epic)
        const jql = `(parent = "${epicKey}" OR "Epic Link" = "${epicKey}") AND issuetype not in (Sub-task, Subtask, Subtarefa, "Sub-tarefa")`;
        const childrenUrl = `${jiraUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,issuetype,assignee,timeoriginalestimate,timeestimate,timespent,components,created,updated,resolutiondate,duedate,parent,customfield_10014,attachment&maxResults=1000`;

        console.log(`[fetchEpicData] Fetching children with JQL: ${jql}`);
        const childrenResponse = await fetch(childrenUrl, { headers });

        if (!childrenResponse.ok) {
            throw new functions.https.HttpsError('internal', `Failed to fetch children: ${childrenResponse.status}`);
        }

        const childrenData = await childrenResponse.json();
        const children = childrenData.issues || [];

        // 7. Fetch subtasks for each child
        let subtasksMap = {};
        if (children.length > 0) {
            const childKeys = children.map(c => c.key);
            const subtaskJql = `parent in ("${childKeys.join('","')}")`;
            const subtasksUrl = `${jiraUrl}/rest/api/3/search?jql=${encodeURIComponent(subtaskJql)}&fields=summary,status,issuetype,assignee,created,updated,parent,resolutiondate,duedate,timespent,timeoriginalestimate,timeestimate,fixVersions,components&maxResults=5000`;

            console.log(`[fetchEpicData] Fetching subtasks for ${childKeys.length} children`);
            const subtasksResponse = await fetch(subtasksUrl, { headers });

            if (subtasksResponse.ok) {
                const subtasksData = await subtasksResponse.json();
                const subtasks = subtasksData.issues || [];

                // Group subtasks by parent
                subtasks.forEach(sub => {
                    const parentKey = sub.fields.parent?.key;
                    if (parentKey) {
                        if (!subtasksMap[parentKey]) {
                            subtasksMap[parentKey] = [];
                        }
                        subtasksMap[parentKey].push(sub);
                    }
                });
            }
        }

        // 8. Build result structure
        const result = {
            epic: {
                id: epicData.id,
                key: epicData.key,
                fields: epicData.fields
            },
            children: children.map(child => {
                const subtasks = subtasksMap[child.key] || [];
                const doneSubtasks = subtasks.filter(s =>
                    s.fields.status?.statusCategory?.key === 'done'
                ).length;
                const progress = subtasks.length > 0
                    ? Math.round((doneSubtasks / subtasks.length) * 100)
                    : 0;

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

        // 9. Save to cache (30 min TTL for mobile)
        const cacheExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await admin.firestore()
            .collection('jira_cache')
            .doc(`epic-${epicKey}`)
            .set({
                key: `epic-${epicKey}`,
                type: 'epic_details',
                data: result,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(cacheExpiry),
                version: 1
            });

        console.log(`[fetchEpicData] Cache SET for epic-${epicKey}, expires at ${cacheExpiry.toISOString()}`);

        return result;

    } catch (error) {
        console.error(`[fetchEpicData] Error:`, error);

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        throw new functions.https.HttpsError('internal', `Internal error: ${error.message}`);
    }
});

/**
 * Fetch Strategic Objectives from Jira (for OKR panel)
 */
exports.fetchStrategicObjectives = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { forceRefresh = false, projectKey = 'ION' } = data;

    console.log(`[fetchStrategicObjectives] User ${context.auth.uid}, project: ${projectKey}, forceRefresh: ${forceRefresh}`);

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
                    console.log(`[fetchStrategicObjectives] Cache HIT`);
                    return cache.data;
                }
            }
        }

        // Fetch config
        const configDoc = await admin.firestore()
            .collection('system_config')
            .doc('jira')
            .get();

        if (!configDoc.exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Jira not configured');
        }

        const config = configDoc.data();
        let jiraUrl = config.url.trim();
        if (!jiraUrl.startsWith('http')) jiraUrl = `https://${jiraUrl}`;
        jiraUrl = jiraUrl.replace(/\/$/, '');

        const authHeader = Buffer.from(`${config.email.trim()}:${config.token.trim()}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${authHeader}`,
            'Accept': 'application/json'
        };

        // Fetch objectives (customize JQL as needed)
        // Ensure projectKey is sanitized to alphanumeric + dash/underscore to prevent injection
        const sanitizedProject = projectKey.replace(/[^a-zA-Z0-9-_]/g, '');
        const jql = `project = ${sanitizedProject} AND issuetype = Epic AND status != Done ORDER BY created DESC`;
        const url = `${jiraUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,description,created,updated,fixVersions&maxResults=100`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new functions.https.HttpsError('internal', `Jira API error: ${response.status}`);
        }

        const data = await response.json();
        const result = { objectives: data.issues || [] };

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

        console.log(`[fetchStrategicObjectives] Cache SET`);

        return result;

    } catch (error) {
        console.error(`[fetchStrategicObjectives] Error:`, error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', `Internal error: ${error.message}`);
    }
});
