import { JiraIssue } from "@/types/jira"

// Debug Store
export let debugLogs: { timestamp: string, type: string, message: string, jql?: string, duration?: number, size?: number }[] = [];
const addDebugLog = (log: { type: string, message: string, jql?: string, duration?: number, size?: number }) => {
    if (localStorage.getItem("debug_mode") !== "true") return;
    debugLogs = [{ timestamp: new Date().toISOString(), ...log }, ...debugLogs].slice(0, 50);
    window.dispatchEvent(new CustomEvent('jira-debug-log'));
};

const MOCK_DELAY = 800

// Mock Data
const MOCK_EPICS: JiraIssue[] = [
    {
        id: "1001",
        key: "ION-1",
        fields: {
            summary: "Modernize Ion Infrastructure",
            status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "blue-gray" } },
            issuetype: { name: "Epic", iconUrl: "", subtask: false },
            assignee: { displayName: "Max Siqueira", avatarUrls: { "48x48": "" } },
            created: "2025-01-10T10:00:00.000+0000",
            updated: "2025-12-05T12:00:00.000+0000",
            labels: ["OKR2025"],
            components: [{ name: "Infrastructure" }]
        }
    },
    {
        id: "1002",
        key: "ION-2",
        fields: {
            summary: "AI Analyst Integration",
            status: { name: "To Do", statusCategory: { key: "new", name: "To Do", colorName: "blue-gray" } },
            issuetype: { name: "Epic", iconUrl: "", subtask: false },
            assignee: { displayName: "AI Bot", avatarUrls: { "48x48": "" } },
            created: "2025-11-20T10:00:00.000+0000",
            updated: "2025-12-01T12:00:00.000+0000",
            labels: ["OKR2025"],
            components: [{ name: "Architecture" }]
        } // Added missing closing brace here if needed, but replacement looks complete.
    }
]

// Helper for Proxy Fetching
const fetchWithProxy = async (targetUrl: string, method: string = 'GET', headers: any = {}, body: any = null) => {
    const start = performance.now();
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: targetUrl,
                method,
                headers,
                body
            })
        });
        const duration = Math.round(performance.now() - start);

        if (localStorage.getItem("debug_mode") === "true") {
            addDebugLog({
                type: response.ok ? 'API_SUCCESS' : 'API_ERROR',
                message: `${method} ${targetUrl.split('/rest/api/3/')[1] || targetUrl}`,
                jql: body?.jql,
                duration
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[JiraService] Proxy response not OK: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`Proxy error: ${response.status} ${errorText}`);
        }
        return response;
    } catch (error) {
        console.error("[JiraService] ❌ Proxy fetch failed details:", error);
        throw error;
    }
}

/**
 * Helper to fetch ALL issues from a JQL search by handling modern token-based pagination (nextPageToken)
 */
const fetchAllIssues = async (targetUrl: string, headers: any, jql: string, fields: string[]): Promise<any[]> => {
    let allIssues: any[] = []
    let nextPageToken: string | undefined = undefined
    let isLastPage = false
    const pageSize = 50 // Safe batch size

    const start = performance.now()
    console.log(`[JiraService] Starting modern paginated fetch for: ${jql}`)

    try {
        while (!isLastPage) {
            const body: any = {
                jql,
                maxResults: pageSize,
                fields
            }
            if (nextPageToken) body.nextPageToken = nextPageToken

            const res = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, body)

            if (!res.ok) {
                const errText = await res.text()
                console.error(`[JiraService] Search failed with status ${res.status}:`, errText)
                throw new Error(`Migration API search failed: ${res.status}`)
            }

            const data = await res.json()

            if (data.issues) {
                allIssues = [...allIssues, ...data.issues]
            }

            nextPageToken = data.nextPageToken
            isLastPage = !nextPageToken || data.issues.length === 0

            console.log(`[JiraService] Fetched ${allIssues.length} issues (Token: ${nextPageToken || 'DONE'})...`)
        }
    } catch (error) {
        console.error("[JiraService] fetchAllIssues error:", error)
        throw error
    }

    const duration = Math.round(performance.now() - start)
    addDebugLog({
        type: 'JQL_SEARCH',
        message: `Total ${allIssues.length} issues found`,
        jql,
        duration,
        size: allIssues.length
    })

    return allIssues
}

export const JiraService = {
    // Get ALL Epics with their calculated progress based on child issues in the project
    getEpics: async (projectKey: string, version: string = "ALL"): Promise<JiraIssue[]> => {
        console.log(`[JiraService] getEpics for ${projectKey} (Version: ${version})`)
        // Check for credentials
        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")

        if (url && email && token) {
            // Normalize URL
            let targetUrl = url.trim();
            if (!targetUrl.startsWith('http')) {
                targetUrl = `https://${targetUrl}`;
            }
            targetUrl = targetUrl.replace(/\/$/, "");

            try {
                console.log("[JiraService] Attempting REAL fetch (Batch) for", projectKey)

                const headers = {
                    "Authorization": `Basic ${btoa(`${email.trim()}:${token.trim()}`)}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }

                // 1. Fetch EVERYTHING in the project (Epics + Tasks)
                const jql = `project = "${projectKey}" AND (issuetype = Epic OR "Epic Link" is not EMPTY OR parent is not EMPTY)`

                // USE POST /search/jql (New mandatory endpoint)
                const fields = ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "issuelinks", "components", "fixVersions", "labels"]
                const issues = await fetchAllIssues(targetUrl, headers, jql, fields)

                // 2. Separate Epics and Children
                const epics: any[] = []
                const childrenMap: Record<string, any[]> = {} // Map EpicKey -> Array of Issues

                issues.forEach((issue: any) => {
                    if (issue.fields.issuetype.name === "Epic") {
                        epics.push(issue)
                    } else {
                        // Try to find who this belongs to
                        let parentKey = null;

                        // Check 'Epic Link' custom field (classic) - field name varies, but often we can check if a field *value* looks like a key
                        // but safer to look for customfield_X or rely on 'parent'
                        if (issue.fields.parent) {
                            parentKey = issue.fields.parent.key
                        }
                        // Note: If you have Classic projects, 'Epic Link' might be in a custom field (e.g. customfield_10014).
                        // Since we can't easily guess the ID, we'll rely on 'parent' which works for Next-Gen and often Classic (in v3 API).
                        // EXTENSION: Check known custom fields if parent is missing?

                        if (parentKey) {
                            if (!childrenMap[parentKey]) childrenMap[parentKey] = []
                            childrenMap[parentKey].push(issue)
                        }
                    }
                })

                console.log(`[JiraService] Found ${epics.length} epics and ${issues.length - epics.length} potential children.`)

                // 3. Map to our format and calculate progress
                const getRelatedIssues = (parentKey: string): any[] => {
                    const direct = childrenMap[parentKey] || []
                    let total = [...direct]
                    direct.forEach(d => {
                        total = [...total, ...getRelatedIssues(d.key)]
                    })
                    return total
                }

                return epics.map((epic: any) => {
                    const directChildren = childrenMap[epic.key] || []

                    const activeDirect = directChildren.filter(issue => {
                        const isNotCancelled = !issue.fields.status.name.toLowerCase().includes("cancel")
                        const isMajor = !issue.fields.issuetype.subtask
                        const matchesVersion = version === "ALL" || (issue.fields.fixVersions && issue.fields.fixVersions.some((v: any) => v.name === version))
                        return isNotCancelled && isMajor && matchesVersion
                    })

                    const doneCount = activeDirect.filter(i => i.fields.status.statusCategory.key === "done").length
                    const totalCount = directChildren.filter(issue => {
                        const isMajor = !issue.fields.issuetype.subtask
                        const matchesVersion = version === "ALL" || (issue.fields.fixVersions && issue.fields.fixVersions.some((v: any) => v.name === version))
                        return isMajor && matchesVersion
                    }).length
                    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

                    return {
                        id: epic.id,
                        key: epic.key,
                        fields: {
                            summary: epic.fields.summary,
                            status: epic.fields.status,
                            issuetype: epic.fields.issuetype,
                            assignee: epic.fields.assignee,
                            created: epic.fields.created,
                            updated: epic.fields.updated,
                            components: epic.fields.components,
                            labels: epic.fields.labels
                        },
                        progress
                    }
                })

            } catch (error) {
                console.error("[JiraService] Real fetch failed:", error)
                // Fallthrough to mock
            }
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`[Mock] Fetched Epics for ${projectKey}`)
                // Add mock progress
                const mocked = MOCK_EPICS.map(e => ({ ...e, progress: 0 }))
                resolve(mocked)
            }, MOCK_DELAY)
        })
    },

    // Get specific list of Epics by Key (for OKR vs Extra split)
    getEpicsByKeys: async (keys: string[], version: string = "ALL"): Promise<JiraIssue[]> => {
        if (!keys || keys.length === 0) return []

        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")

        if (url && email && token) {
            let targetUrl = url.trim();
            if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
            targetUrl = targetUrl.replace(/\/$/, "");

            try {
                const headers = {
                    "Authorization": `Basic ${btoa(`${email.trim()}:${token.trim()}`)}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }

                // JQL: key in (A, B, C)
                const jql = `key in ("${keys.map(k => k.trim()).join('","')}")`

                // USE fetchAllIssues for robust pagination
                const fields = ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "issuelinks", "components", "fixVersions", "timespent", "timeoriginalestimate"]
                const issues = await fetchAllIssues(targetUrl, headers, jql, fields)

                // Calculate progress for each Epic
                const childrenJql = `parent in ("${keys.map(k => k.trim()).join('","')}")`
                const childrenIssues = await fetchAllIssues(targetUrl, headers, childrenJql, ["status", "parent", "fixVersions", "issuetype", "timespent", "timeoriginalestimate"])

                let childrenMap: Record<string, any[]> = {}
                if (childrenIssues) {
                    childrenIssues.forEach((child: any) => {
                        const parentKey = child.fields.parent?.key
                        if (parentKey) {
                            if (!childrenMap[parentKey]) childrenMap[parentKey] = []
                            childrenMap[parentKey].push(child)
                        }
                    })
                }

                // Calculate subtasks map for all children (Grandchildren)
                const childKeys = childrenIssues.map((c: any) => c.key)
                let subtasksMap: Record<string, any[]> = {}
                if (childKeys.length > 0) {
                    const batchSize = 50
                    for (let i = 0; i < childKeys.length; i += batchSize) {
                        const batch = childKeys.slice(i, i + batchSize)
                        const subtaskJql = `parent in ("${batch.join('","')}")`
                        const subtasks = await fetchAllIssues(targetUrl, headers, subtaskJql, ["status", "parent", "fixVersions", "timespent", "timeoriginalestimate"])
                        subtasks.forEach(s => {
                            const pk = s.fields.parent?.key
                            if (pk) {
                                if (!subtasksMap[pk]) subtasksMap[pk] = []
                                subtasksMap[pk].push(s)
                            }
                        })
                    }
                }

                return issues.map((epic: any) => {
                    const children = childrenMap[epic.key] || []

                    // 1. Calculate Progress
                    // If we have children, we count them ALL (regardless of being subtasks or stories)
                    // This solves the issue where a Story's progress depends on its Subtasks.
                    const activeChildren = children.filter((issue: any) => {
                        const isNotCancelled = !issue.fields.status.name.toLowerCase().includes("cancel")
                        const matchesVersion = version === "ALL" || (issue.fields.fixVersions && issue.fields.fixVersions.some((v: any) => v.name === version))
                        return isNotCancelled && matchesVersion
                    })

                    const doneCount = activeChildren.filter((i: any) => i.fields.status.statusCategory.key === "done").length
                    const totalCount = activeChildren.length
                    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

                    // 2. Calculate Hours (Time Spent)
                    // Sum of: Epic itself + all children + all subtasks of children
                    let totalSeconds = epic.fields.timespent || 0
                    children.forEach(c => {
                        totalSeconds += (c.fields.timespent || 0)
                        const subs = subtasksMap[c.key] || []
                        subs.forEach(s => {
                            totalSeconds += (s.fields.timespent || 0)
                        })
                    })
                    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10 // Round to 1 decimal

                    return {
                        id: epic.id,
                        key: epic.key,
                        fields: {
                            summary: epic.fields.summary,
                            status: epic.fields.status,
                            issuetype: epic.fields.issuetype,
                            assignee: epic.fields.assignee,
                            created: epic.fields.created,
                            updated: epic.fields.updated,
                            fixVersions: epic.fields.fixVersions,
                            timespent: totalSeconds // Store aggregated seconds
                        },
                        progress,
                        totalHours // Return calculated hours directly
                    } as any
                })

            } catch (e) {
                console.error("Failed to fetch specific epics", e)
                return []
            }
        }
        return []
    },

    // Get specific Epic details + Children
    getEpicDetails: async (epicKey: string): Promise<{ epic: JiraIssue, children: JiraIssue[] } | null> => {
        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")

        if (url && email && token) {
            let targetUrl = url.trim();
            if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
            targetUrl = targetUrl.replace(/\/$/, "");

            try {
                console.log("[JiraService] Attempting REAL fetch (Details) for", epicKey)

                // Aggressively clean credentials
                const cleanEmail = email.trim().replace(/[\r\n\t]/g, '')
                const cleanToken = token.trim().replace(/[\r\n\t]/g, '')

                const headers = {
                    "Authorization": `Basic ${btoa(`${cleanEmail}:${cleanToken}`)}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }

                // Fetch Epic with time tracking fields
                const epicRes = await fetchWithProxy(`${targetUrl}/rest/api/3/issue/${epicKey}?fields=summary,status,issuetype,assignee,created,updated,timespent,timeoriginalestimate`, 'GET', headers)
                if (!epicRes.ok) throw new Error(`Failed to fetch epic: ${epicRes.status}`)
                const epicData = await epicRes.json()

                // Fetch Children (using parent search) - EXCLUDE SUBTASKS to avoid double counting
                // Subtasks will be fetched specifically in step 2 via their parents
                const jql = `(parent = "${epicKey}" OR "Epic Link" = "${epicKey}") AND issuetype not in (Sub-task, Subtask, Subtarefa, "Sub-tarefa")`
                const rawChildren = await fetchAllIssues(targetUrl, headers, jql, [
                    "summary", "status", "issuetype", "assignee", "timeoriginalestimate", "timeestimate", "timespent", "components", "created", "updated", "resolutiondate", "duedate", "parent", "customfield_10014", "attachment"
                ])

                let children: JiraIssue[] = []

                if (rawChildren && rawChildren.length > 0) {
                    // 2. Fetch Sub-tasks (Grandchildren) - PAGINATED
                    const childKeys = rawChildren.map((i: any) => i.key);
                    let subtasksMap: Record<string, JiraIssue[]> = {};

                    if (childKeys.length > 0) {
                        const subtaskJql = `parent in ("${childKeys.join('","')}")`
                        const subtaskIssues = await fetchAllIssues(targetUrl, headers, subtaskJql, [
                            "summary", "status", "issuetype", "assignee", "created", "updated", "parent", "resolutiondate", "duedate", "timespent", "timeoriginalestimate", "timeestimate", "fixVersions", "components"
                        ])

                        if (subtaskIssues && subtaskIssues.length > 0) {
                            subtaskIssues.forEach((sub: any) => {
                                const parentKey = sub.fields.parent?.key;
                                if (parentKey) {
                                    if (!subtasksMap[parentKey]) subtasksMap[parentKey] = [];
                                    subtasksMap[parentKey].push({
                                        id: sub.id,
                                        key: sub.key,
                                        fields: {
                                            summary: sub.fields.summary,
                                            status: sub.fields.status,
                                            issuetype: { ...sub.fields.issuetype, subtask: true },
                                            assignee: sub.fields.assignee,
                                            created: sub.fields.created,
                                            updated: sub.fields.updated,
                                            resolutiondate: sub.fields.resolutiondate,
                                            duedate: sub.fields.duedate,
                                            timespent: sub.fields.timespent,
                                            timeoriginalestimate: sub.fields.timeoriginalestimate,
                                            timeestimate: sub.fields.timeestimate,
                                            fixVersions: sub.fields.fixVersions,
                                            components: sub.fields.components
                                        }
                                    } as JiraIssue);
                                }
                            })
                        }
                    }

                    children = rawChildren.map((issue: any) => {
                        const subtasks = subtasksMap[issue.key] || []
                        const doneSubtasks = subtasks.filter(s => s.fields.status.statusCategory.key === "done").length
                        const childProgress = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0

                        return {
                            id: issue.id,
                            key: issue.key,
                            fields: {
                                summary: issue.fields.summary,
                                status: issue.fields.status,
                                issuetype: issue.fields.issuetype,
                                assignee: issue.fields.assignee,
                                timeoriginalestimate: issue.fields.timeoriginalestimate,
                                timeestimate: issue.fields.timeestimate,
                                timespent: issue.fields.timespent,
                                components: issue.fields.components,
                                created: issue.fields.created,
                                updated: issue.fields.updated,
                                resolutiondate: issue.fields.resolutiondate,
                                duedate: issue.fields.duedate
                            },
                            subtasks,
                            progress: childProgress
                        }
                    })
                }

                const epic: JiraIssue = {
                    id: epicData.id,
                    key: epicData.key,
                    fields: {
                        summary: epicData.fields.summary,
                        status: epicData.fields.status,
                        issuetype: { ...epicData.fields.issuetype, subtask: false },
                        assignee: epicData.fields.assignee,
                        created: epicData.fields.created,
                        updated: epicData.fields.updated,
                        timespent: epicData.fields.timespent,
                        timeoriginalestimate: epicData.fields.timeoriginalestimate
                    }
                }

                // Calculate progress for consistency
                const activeChildren = children.filter(c => !c.fields.status.name.toLowerCase().includes("cancel"))
                const doneCount = activeChildren.filter(c => c.fields.status.statusCategory.key === "done").length
                const total = activeChildren.length
                const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

                // Assign to epic
                (epic as any).progress = progress

                return { epic, children }

            } catch (error: any) {
                console.error(`[JiraService] Real fetch failed for ${epicKey}:`, error)
                const errorMsg = error.message || "Failed to fetch details"
                if (errorMsg.includes("404")) {
                    throw new Error(`Epic ${epicKey} not found. Please verify the epic key exists and you have permission to view it.`)
                } else if (errorMsg.includes("401")) {
                    throw new Error(`Authentication failed. Please check your Jira credentials in Settings.`)
                }
                throw new Error(`Failed to load ${epicKey}: ${errorMsg}`)
            }
        }

        // Mock Fallback
        return new Promise((resolve) => {
            setTimeout(() => {
                if (epicKey !== "Devops-633") {
                    resolve(null)
                    return
                }
                const epic: JiraIssue = {
                    id: "9999", key: "Devops-633",
                    fields: {
                        summary: "Migration to Kubernetes Cluster v1.29",
                        status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "blue" } },
                        issuetype: { name: "Epic", iconUrl: "", subtask: false },
                        assignee: { displayName: "DevOps Team", avatarUrls: { "48x48": "" } },
                        created: "2025-10-01T10:00:00.000+0000",
                        updated: "2025-12-05T14:30:00.000+0000",
                    }
                };
                (epic as any).progress = 85 // Mocked high progress

                const children: JiraIssue[] = [
                    { id: "e1", key: "Devops-634", fields: { summary: "Setup VPC Peering", status: { name: "Done", statusCategory: { key: "done", name: "Done", colorName: "green" } }, issuetype: { name: "Task", iconUrl: "", subtask: false }, assignee: null, created: "", updated: "" } },
                    { id: "e2", key: "Devops-635", fields: { summary: "Configure Node Groups", status: { name: "Done", statusCategory: { key: "done", name: "Done", colorName: "green" } }, issuetype: { name: "Task", iconUrl: "", subtask: false }, assignee: null, created: "", updated: "" } },
                    { id: "e3", key: "Devops-636", fields: { summary: "Migrate CI/CD Pipelines", status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "blue" } }, issuetype: { name: "Task", iconUrl: "", subtask: false }, assignee: null, created: "", updated: "" } },
                ]
                resolve({ epic, children })
            }, MOCK_DELAY)
        })
    },

    // Optimized bulk fetcher to avoid N+1 requests and browser freezing
    getBulkEpicDetails: async (epicKeys: string[]): Promise<{ epic: JiraIssue, children: JiraIssue[] }[]> => {
        if (!epicKeys || epicKeys.length === 0) return []

        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")

        if (!url || !email || !token) return []

        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
        targetUrl = targetUrl.replace(/\/$/, "");

        try {
            const headers = {
                "Authorization": `Basic ${btoa(`${email.trim()}:${token.trim()}`)}`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }

            // 1. Fetch all Epics in one go
            const epicJql = `key in ("${epicKeys.join('","')}")`
            const epics = await fetchAllIssues(targetUrl, headers, epicJql, ["summary", "status", "issuetype", "assignee", "created", "updated", "timespent", "timeoriginalestimate"])

            // 2. Fetch all Direct Children (Stories/Tasks) in one go
            const childrenJql = `parent in ("${epicKeys.join('","')}")`
            const allChildrenRaw = await fetchAllIssues(targetUrl, headers, childrenJql, [
                "summary", "status", "issuetype", "assignee", "timeoriginalestimate", "timeestimate", "timespent", "components", "created", "updated", "resolutiondate", "duedate", "parent", "attachment"
            ])

            // 3. Fetch all Subtasks (Grandchildren) in one go
            const childKeys = allChildrenRaw.map(c => c.key)
            let subtasksMap: Record<string, any[]> = {}
            if (childKeys.length > 0) {
                // Batch JQL to avoid too long strings
                const batchSize = 100
                for (let i = 0; i < childKeys.length; i += batchSize) {
                    const batch = childKeys.slice(i, i + batchSize)
                    const subtaskJql = `parent in ("${batch.join('","')}")`
                    const subs = await fetchAllIssues(targetUrl, headers, subtaskJql, [
                        "summary", "status", "issuetype", "assignee", "created", "updated", "parent", "resolutiondate", "duedate", "timespent"
                    ])
                    subs.forEach(s => {
                        const pk = s.fields.parent?.key
                        if (pk) {
                            if (!subtasksMap[pk]) subtasksMap[pk] = []
                            subtasksMap[pk].push(s)
                        }
                    })
                }
            }

            // 4. Map everything together
            const results = epics.map(epicData => {
                const epicKey = epicData.key
                const childrenRaw = allChildrenRaw.filter(c => c.fields.parent?.key === epicKey)

                const children = childrenRaw.map(issue => {
                    const subtasks = (subtasksMap[issue.key] || []).map(sub => ({
                        id: sub.id,
                        key: sub.key,
                        fields: { ...sub.fields, issuetype: { ...sub.fields.issuetype, subtask: true } }
                    }))

                    const doneSubtasks = subtasks.filter(s => s.fields.status.statusCategory.key === "done").length
                    const progress = subtasks.length > 0 ? Math.round((doneSubtasks / subtasks.length) * 100) : 0

                    return {
                        id: issue.id,
                        key: issue.key,
                        fields: issue.fields,
                        subtasks,
                        progress
                    }
                })

                return {
                    epic: {
                        id: epicData.id,
                        key: epicData.key,
                        fields: epicData.fields,
                        progress: children.length > 0 ? Math.round((children.filter(c => c.fields.status.statusCategory.key === "done").length / children.length) * 100) : 0
                    },
                    children
                }
            })

            return results as any

        } catch (error) {
            console.error("[JiraService] getBulkEpicDetails failed:", error)
            return []
        }
    },

    syncJiraData: async (): Promise<boolean> => {
        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")

        if (!url || !email || !token) throw new Error("Missing credentials")

        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
        const cleanedEmail = email.trim();
        const cleanedToken = token.trim();

        console.log(`[JiraService] 🔐 Credential Check: Email len=${cleanedEmail.length}, Token len=${cleanedToken.length}`);

        if (cleanedToken.length > 50) {
            console.warn("[JiraService] ⚠️ WARNING: Token is suspiciously long (>50 chars). Standard Jira API tokens are usually ~24 chars.");
        }

        const headers = {
            "Authorization": `Basic ${btoa(`${cleanedEmail}:${cleanedToken}`)}`,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

        try {
            const res = await fetchWithProxy(`${targetUrl}/rest/api/3/myself`, 'GET', headers)
            if (res.status === 401) throw new Error("401 Unauthorized")
            if (res.status === 404) throw new Error("404 Not Found")
            if (!res.ok) throw new Error(`Connection Failed: ${res.status}`)
            return true
        } catch (error) {
            console.error("Sync failed", error)
            throw error
        }
    },

    getOkrMetrics: async (): Promise<{ cycleTime: any[], aiAdoption: any[], epicStats: { total: number, done: number, percent: number } }> => {
        const url = localStorage.getItem("jira_url")
        const email = localStorage.getItem("jira_email")
        const token = localStorage.getItem("jira_token")
        const okrIds = (localStorage.getItem("okr_epics") || "").split(",").map(s => s.trim()).filter(Boolean)

        if (url && email && token) {
            let targetUrl = url.trim();
            if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
            targetUrl = targetUrl.replace(/\/$/, "");

            try {
                const headers = {
                    "Authorization": `Basic ${btoa(`${email.trim()}:${token.trim()}`)}`,
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }

                // 1. Throughput (All finished items in 2025)
                const velocityRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql: 'resolved >= "2025-01-01" AND resolved <= "2025-12-31"',
                    maxResults: 1000,
                    fields: ["created", "resolutiondate"]
                })

                let cycleTime: any[] = []
                if (velocityRes.ok) {
                    const data = await velocityRes.json()
                    const issues = data.issues

                    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
                    const months: Record<string, number> = {}
                    monthNames.forEach(m => months[m] = 0)

                    issues.forEach((i: any) => {
                        const dStr = i.fields.resolutiondate || i.fields.updated
                        if (dStr) {
                            const d = new Date(dStr)
                            if (d.getFullYear() === 2025) {
                                const key = monthNames[d.getMonth()]
                                if (months[key] !== undefined) months[key]++
                            }
                        }
                    })

                    cycleTime = monthNames.map(name => ({ month: name, days: months[name] }))
                }

                // 2. AI Adoption (2025 focus)
                const aiRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql: 'labels = "ai-assisted" AND resolved >= "2025-01-01"',
                    maxResults: 1
                })
                const manualRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql: '(labels != "ai-assisted" OR labels is EMPTY) AND resolved >= "2025-01-01"',
                    maxResults: 1
                })

                let aiCount = 0
                let manualCount = 0

                if (aiRes.ok) aiCount = (await aiRes.json()).total
                if (manualRes.ok) manualCount = (await manualRes.json()).total

                const aiAdoption = [
                    { name: 'Manual', value: manualCount },
                    { name: 'AI Assisted', value: aiCount }
                ]

                // 3. Epic Conclusion (OKR specific)
                let epicStats = { total: 0, done: 0, percent: 0 }
                if (okrIds.length > 0) {
                    const epicsJql = `key in ("${okrIds.join('","')}")`
                    const epicsRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                        jql: epicsJql,
                        fields: ["status"]
                    })
                    if (epicsRes.ok) {
                        const data = await epicsRes.json()
                        const epics = data.issues || []
                        epicStats.total = epics.length
                        epicStats.done = epics.filter((e: any) => e.fields.status.statusCategory.key === "done").length
                        epicStats.percent = epicStats.total > 0 ? Math.round((epicStats.done / epicStats.total) * 100) : 0
                    }
                }

                return { cycleTime, aiAdoption, epicStats }

            } catch (e) {
                console.error("[JiraService] Metrics fetch failed", e)
            }
        }
        return { cycleTime: [], aiAdoption: [], epicStats: { total: 0, done: 0, percent: 0 } }
    },

    // Kept for backward compatibility but unused internally now
    calculateEpicProgress: (issues: JiraIssue[]) => {
        const total = issues.length
        if (total === 0) return 0
        const done = issues.filter(i => i.fields.status.statusCategory.key === "done").length
        return Math.round((done / total) * 100)
    }
}
