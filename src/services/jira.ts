import { JiraIssue } from "@/types/jira"

const MOCK_DELAY = 800

// Mock Data
const MOCK_EPICS: JiraIssue[] = [
    {
        id: "1001",
        key: "ION-1",
        fields: {
            summary: "Modernize Ion Infrastructure",
            status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "blue-gray" } },
            issuetype: { name: "Epic", iconUrl: "" },
            assignee: { displayName: "Max Siqueira", avatarUrls: { "48x48": "" } },
            created: "2025-01-10T10:00:00.000+0000",
            updated: "2025-12-05T12:00:00.000+0000",
        }
    },
    {
        id: "1002",
        key: "ION-2",
        fields: {
            summary: "AI Analyst Integration",
            status: { name: "To Do", statusCategory: { key: "new", name: "To Do", colorName: "blue-gray" } },
            issuetype: { name: "Epic", iconUrl: "" },
            assignee: { displayName: "AI Bot", avatarUrls: { "48x48": "" } },
            created: "2025-11-20T10:00:00.000+0000",
            updated: "2025-12-01T12:00:00.000+0000",
        }
    }
]

// Helper for Proxy Fetching
const fetchWithProxy = async (targetUrl: string, method: string = 'GET', headers: any = {}, body: any = null) => {
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

export const JiraService = {
    // Get ALL Epics with their calculated progress based on child issues in the project
    getEpics: async (projectKey: string): Promise<JiraIssue[]> => {
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
                // We'll limit to 1000 for now. Pagination might be needed for huge projects.
                // 1. Fetch EVERYTHING in the project (Epics + Tasks)
                const jql = `project = ${projectKey} AND (issuetype = Epic OR "Epic Link" is not EMPTY OR parent is not EMPTY)`

                // USE POST /search/jql as explicitly requested by 410 error
                const searchRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql,
                    maxResults: 1000,
                    fields: ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "issuelinks", "components"]
                })

                if (!searchRes.ok) throw new Error(`Failed to search issues: ${searchRes.status}`)
                const searchData = await searchRes.json()
                const issues = searchData.issues

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
                return epics.map((epic: any) => {
                    const children = childrenMap[epic.key] || []
                    const doneCount = children.filter(c => c.fields.status.statusCategory.key === "done").length
                    const totalCount = children.length
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
                        },
                        // We attach the calculated progress as a virtual field or we utilize it immediately
                        progress: progress
                    } as JiraIssue & { progress?: number } // Extending type locally if needed or just trusting it passes through
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
                const mocked = MOCK_EPICS.map(e => ({ ...e, progress: 45 }))
                resolve(mocked)
            }, MOCK_DELAY)
        })
    },

    // Get specific list of Epics by Key (for OKR vs Extra split)
    getEpicsByKeys: async (keys: string[]): Promise<JiraIssue[]> => {
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
                const jql = `key in (${keys.map(k => k.trim()).join(",")})`

                // USE POST /search/jql
                const searchRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql,
                    maxResults: 100,
                    fields: ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "issuelinks", "components"]
                })

                if (!searchRes.ok) return [] // or throw
                const searchData = await searchRes.json()
                const issues = searchData.issues

                // Calculate progress for each Epic
                // Note: To calculate progress accurately, we ideally need the *children* of *these* epics.
                // For now, we will do a second query for children OR return 0 progress to avoid n+1 queries if performance is key.
                // Let's try to fetch children in one go if possible? 
                // "parent in (A, B, C)"

                const childrenJql = `parent in (${keys.map(k => k.trim()).join(",")})`
                const childrenRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql: childrenJql,
                    maxResults: 1000,
                    fields: ["status", "parent"]
                })

                let childrenMap: Record<string, any[]> = {}
                if (childrenRes.ok) {
                    const childrenData = await childrenRes.json()
                    childrenData.issues.forEach((child: any) => {
                        const parentKey = child.fields.parent?.key
                        if (parentKey) {
                            if (!childrenMap[parentKey]) childrenMap[parentKey] = []
                            childrenMap[parentKey].push(child)
                        }
                    })
                }

                return issues.map((epic: any) => {
                    const children = childrenMap[epic.key] || []
                    const doneCount = children.filter((c: any) => c.fields.status.statusCategory.key === "done").length
                    const totalCount = children.length
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
                        },
                        progress
                    }
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

                // Fetch Children (using parent search)
                const jql = `parent = ${epicKey} OR "Epic Link" = ${epicKey}`
                const searchRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql,
                    fields: ["summary", "status", "issuetype", "assignee", "timeoriginalestimate", "timespent", "components", "created", "updated", "resolutiondate", "duedate"]
                })
                let children: JiraIssue[] = []

                if (searchRes.ok) {
                    const searchData = await searchRes.json()
                    const rawChildren = searchData.issues

                    // 2. Fetch Sub-tasks (Grandchildren)
                    const childKeys = rawChildren.map((i: any) => i.key);
                    let subtasksMap: Record<string, JiraIssue[]> = {};

                    if (childKeys.length > 0) {
                        const subtaskJql = `parent in (${childKeys.join(",")})`
                        const subRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                            jql: subtaskJql,
                            maxResults: 1000,
                            fields: ["summary", "status", "issuetype", "assignee", "created", "updated", "parent", "resolutiondate", "duedate", "timespent", "timeoriginalestimate", "fixVersions"]
                        })
                        if (subRes.ok) {
                            const subData = await subRes.json();
                            subData.issues.forEach((sub: any) => {
                                const parentKey = sub.fields.parent?.key;
                                if (parentKey) {
                                    if (!subtasksMap[parentKey]) subtasksMap[parentKey] = [];
                                    subtasksMap[parentKey].push({
                                        id: sub.id,
                                        key: sub.key,
                                        fields: {
                                            summary: sub.fields.summary,
                                            status: sub.fields.status,
                                            issuetype: sub.fields.issuetype,
                                            assignee: sub.fields.assignee,
                                            created: sub.fields.created,
                                            updated: sub.fields.updated,
                                            resolutiondate: sub.fields.resolutiondate,
                                            duedate: sub.fields.duedate,
                                            timespent: sub.fields.timespent,
                                            timeoriginalestimate: sub.fields.timeoriginalestimate,
                                            fixVersions: sub.fields.fixVersions
                                        }
                                    } as JiraIssue);
                                }
                            })
                        }
                    }

                    children = rawChildren.map((issue: any) => ({
                        id: issue.id,
                        key: issue.key,
                        fields: {
                            summary: issue.fields.summary,
                            status: issue.fields.status,
                            issuetype: issue.fields.issuetype,
                            assignee: issue.fields.assignee,
                            timeoriginalestimate: issue.fields.timeoriginalestimate,
                            timespent: issue.fields.timespent,
                            components: issue.fields.components,
                            created: issue.fields.created,
                            updated: issue.fields.updated,
                            resolutiondate: issue.fields.resolutiondate,
                            duedate: issue.fields.duedate
                        },
                        subtasks: subtasksMap[issue.key] || []
                    }))
                }

                const epic: JiraIssue = {
                    id: epicData.id,
                    key: epicData.key,
                    fields: {
                        summary: epicData.fields.summary,
                        status: epicData.fields.status,
                        issuetype: epicData.fields.issuetype,
                        assignee: epicData.fields.assignee,
                        created: epicData.fields.created,
                        updated: epicData.fields.updated,
                        timespent: epicData.fields.timespent,
                        timeoriginalestimate: epicData.fields.timeoriginalestimate
                    }
                }

                // Calculate progress for consistency
                const doneCount = children.filter(c => c.fields.status.statusCategory.key === "done").length
                const total = children.length
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
                        issuetype: { name: "Epic", iconUrl: "" },
                        assignee: { displayName: "DevOps Team", avatarUrls: { "48x48": "" } },
                        created: "2025-10-01T10:00:00.000+0000",
                        updated: "2025-12-05T14:30:00.000+0000",
                    }
                };
                (epic as any).progress = 85 // Mocked high progress

                const children: JiraIssue[] = [
                    { id: "e1", key: "Devops-634", fields: { summary: "Setup VPC Peering", status: { name: "Done", statusCategory: { key: "done", name: "Done", colorName: "green" } }, issuetype: { name: "Task", iconUrl: "" }, assignee: null, created: "", updated: "" } },
                    { id: "e2", key: "Devops-635", fields: { summary: "Configure Node Groups", status: { name: "Done", statusCategory: { key: "done", name: "Done", colorName: "green" } }, issuetype: { name: "Task", iconUrl: "" }, assignee: null, created: "", updated: "" } },
                    { id: "e3", key: "Devops-636", fields: { summary: "Migrate CI/CD Pipelines", status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "blue" } }, issuetype: { name: "Task", iconUrl: "" }, assignee: null, created: "", updated: "" } },
                ]
                resolve({ epic, children })
            }, MOCK_DELAY)
        })
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

    getOkrMetrics: async (): Promise<{ cycleTime: any[], aiAdoption: any[] }> => {
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

                // 1. Velocity (Cycle Time Proxy)
                // 1. Velocity (Cycle Time Proxy)
                const velocityRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                    jql: "resolved >= -180d",
                    maxResults: 1000,
                    fields: ["created", "resolutiondate"]
                })
                if (velocityRes.ok) {
                    const data = await velocityRes.json()
                    const issues = data.issues

                    const months: Record<string, number> = {}
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date()
                        d.setMonth(d.getMonth() - i)
                        const key = d.toLocaleString('default', { month: 'short' })
                        months[key] = 0
                    }

                    issues.forEach((i: any) => {
                        const d = new Date(i.fields.resolutiondate)
                        const key = d.toLocaleString('default', { month: 'short' })
                        if (months[key] !== undefined) months[key]++
                    })

                    const cycleTime = Object.keys(months).map(k => ({ month: k, days: months[k] }))

                    // 2. AI Adoption
                    // 2. AI Adoption
                    const aiRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                        jql: 'labels = "ai-assisted"',
                        maxResults: 1
                    })
                    const manualRes = await fetchWithProxy(`${targetUrl}/rest/api/3/search/jql`, 'POST', headers, {
                        jql: 'labels != "ai-assisted" OR labels is EMPTY',
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

                    return { cycleTime, aiAdoption }
                }
            } catch (e) {
                console.error("[JiraService] Metrics fetch failed", e)
            }
        }

        // Mock Fallback
        return {
            cycleTime: [
                { month: 'Jan', days: 12 }, { month: 'Feb', days: 10 }, { month: 'Mar', days: 8 },
                { month: 'Apr', days: 5 }, { month: 'May', days: 4 }, { month: 'Jun', days: 3 },
            ],
            aiAdoption: [
                { name: 'Manual', value: 40 }, { name: 'AI Assisted', value: 60 },
            ]
        }
    },

    // Kept for backward compatibility but unused internally now
    calculateEpicProgress: (issues: JiraIssue[]) => {
        const total = issues.length
        if (total === 0) return 0
        const done = issues.filter(i => i.fields.status.statusCategory.key === "done").length
        return Math.round((done / total) * 100)
    }
}
