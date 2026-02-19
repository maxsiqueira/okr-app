import { JiraIssue } from "@/types/jira"
import { callFetchEpicData, callFetchMultipleEpics, callFetchStrategicObjectives } from "./jira-firebase"

// Debug Store
export let debugLogs: { timestamp: string, type: string, message: string, jql?: string, duration?: number, size?: number }[] = [];

function addDebugLog(log: { type: string, message: string, jql?: string, duration?: number, size?: number }) {
    debugLogs.push({
        timestamp: new Date().toISOString(),
        ...log
    });
}

// Cache Layer
interface CacheEntry {
    data: any;
    timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const jiraCache: Record<string, CacheEntry> = {};

function getCachedData(key: string): any | null {
    const entry = jiraCache[key];
    if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
        console.log(`[Cache] HIT for ${key}`);
        return entry.data;
    }
    return null;
}

function setCacheData(key: string, data: any) {
    jiraCache[key] = { data, timestamp: Date.now() };
}

export const JiraService = {
    // Get specific list of Epics by Key (for OKR vs Extra split)
    getEpicsByKeys: async (keys: string[], version: string = "ALL", forceRefresh = false): Promise<JiraIssue[]> => {
        if (!keys || keys.length === 0) return []

        const cacheKey = `getEpicsByKeys-${keys.sort().join(',')}-${version}`;
        if (!forceRefresh) {
            const cached = getCachedData(cacheKey);
            if (cached) return cached;
        }

        // Use Firebase Callable Function
        try {
            console.log(`[JiraService] 🔥 Fetching ${keys.length} epics via Firebase Function`)

            const epics = await callFetchMultipleEpics(keys, forceRefresh)

            console.log(`[JiraService] ✅ Loaded ${epics.length} epics from Firebase Function`)

            setCacheData(cacheKey, epics)
            addDebugLog({
                type: 'success',
                message: `Loaded ${epics.length} epics via Firebase Function`,
                size: epics.length
            })

            return epics
        } catch (firebaseError: any) {
            console.error(`[JiraService] ⚠️ Firebase Function failed:`, firebaseError)
            addDebugLog({
                type: 'error',
                message: `Firebase Function failed: ${firebaseError.message}`
            })
            throw firebaseError // Propagate error
        }
    },

    // Get specific Epic details + Children
    getEpicDetails: async (epicKey: string, forceRefresh = false): Promise<{ epic: JiraIssue, children: JiraIssue[] } | null> => {
        const cacheKey = `getEpicDetails-${epicKey}`;
        if (!forceRefresh) {
            const cached = getCachedData(cacheKey);
            if (cached) return cached;
        }

        // Use Firebase Callable Function
        try {
            console.log(`[JiraService] 🔥 Fetching epic via Firebase Function: ${epicKey}`)

            const result = await callFetchEpicData(epicKey, forceRefresh)

            if (result.status === 'success') {
                console.log(`[JiraService] ✅ Epic data loaded successfully from Firebase Function`)

                const data = {
                    epic: result.epic,
                    children: result.children || []
                }

                setCacheData(cacheKey, data)
                addDebugLog({
                    type: 'success',
                    message: `Loaded epic ${epicKey} via Firebase Function`,
                    size: data.children.length
                })

                return data
            } else {
                console.error(`[JiraService] ❌ Validation failed. Status: ${result.status}`, result);
                throw new Error(result.message || `Failed to fetch epic (Status: ${result.status})`)
            }
        } catch (firebaseError: any) {
            console.error(`[JiraService] ❌ Firebase Function failed:`, firebaseError)
            addDebugLog({
                type: 'error',
                message: `Failed to load epic ${epicKey}: ${firebaseError.message}`
            })
            throw firebaseError // Propagate error to let UI show specific message (e.g. Auth failed)
        }
    },

    // Get Epics by Project Scan (Default Mode)
    getEpics: async (projectKey: string, version: string = "ALL", forceRefresh = false): Promise<JiraIssue[]> => {
        console.log(`[JiraService] 🔍 Scanning project ${projectKey} for epics...`)

        try {
            const rawObjectives = await callFetchStrategicObjectives(projectKey, forceRefresh)

            // Map to JiraIssue format expected by UI
            const epics: JiraIssue[] = rawObjectives.map((obj: any) => ({
                id: obj.id,
                key: obj.key,
                fields: {
                    summary: obj.fields.summary,
                    status: obj.fields.status,
                    description: obj.fields.description,
                    created: obj.fields.created,
                    updated: obj.fields.updated,
                    fixVersions: obj.fields.fixVersions || [],
                    // Add other fields as needed
                    issuetype: { name: 'Epic', iconUrl: '', self: '', id: '', subtask: false, avatarId: 0, hierarchyLevel: 1 },
                    priority: { name: 'Medium', iconUrl: '', self: '', id: '' },
                    assignee: null,
                    components: [],
                    labels: []
                }
            }))

            // Filter by version if needed
            if (version !== 'ALL') {
                return epics.filter(e => e.fields.fixVersions?.some((v: any) => v.name === version))
            }

            return epics
        } catch (error) {
            console.error('[JiraService] getEpics failed:', error)
            throw error // Propagate error
        }
    },

    // Stub: getBulkEpicDetails - not needed (getEpicDetails is used instead)
    // Stub: getBulkEpicDetails - now used by ExtraEpicAnalysis
    // Stub: getBulkEpicDetails - now used by ExtraEpicAnalysis
    getBulkEpicDetails: async (epicKeys: string[]): Promise<{ epic: JiraIssue, children: JiraIssue[] }[]> => {
        // EMERGENCY FIX: Throttle this too, even if less used
        const results: PromiseSettledResult<any>[] = [];
        for (const key of epicKeys) {
            results.push(await Promise.allSettled([JiraService.getEpicDetails(key)]).then(r => r[0]));
            // Small delay
            await new Promise(r => setTimeout(r, 500));
        }

        return results
            .filter(r => r.status === 'fulfilled')
            .map(r => (r as PromiseFulfilledResult<any>).value)
            .filter(r => r !== null)
    },

    // Stub: getOkrMetrics - not needed with firebase functions
    getOkrMetrics: async (_forcedProjectKey?: string, _forceRefresh = false): Promise<any> => {
        console.warn('[JiraService] getOkrMetrics() is deprecated')
        return {
            cycleTime: [],
            aiAdoption: [],
            epicStats: { total: 0, done: 0, percent: 0 },
            investmentMix: [],
            typeStats: {},
            analystStats: []
        }
    },

    // Stub: syncJiraData - not needed with firebase functions
    syncJiraData: async (): Promise<boolean> => {
        console.warn('[JiraService] syncJiraData() is deprecated with Firebase Functions')
        return true
    },
};
