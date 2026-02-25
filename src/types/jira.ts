export interface JiraIssue {
    id: string
    key: string
    fields: {
        summary: string
        status: {
            name: string
            statusCategory: {
                key: string // "new" | "indeterminate" | "done"
                name: string // "To Do" | "In Progress" | "Done"
                colorName: string
            }
        }
        issuetype: {
            name: string // "Epic" | "Story" | "Task" | "Bug"
            iconUrl: string
            subtask: boolean
        }
        assignee: {
            displayName: string
            avatarUrls: {
                "48x48": string
            }
        } | null
        timeoriginalestimate?: number // Seconds
        timeestimate?: number // Seconds
        timespent?: number // Seconds
        aggregatetimespent?: number
        aggregatetimeoriginalestimate?: number
        aggregatetimeestimate?: number
        components?: { name: string }[]
        labels?: string[]
        fixVersions?: { name: string, released: boolean, releaseDate?: string }[]
        subtasks?: any[] // Jira returns simple subtasks in fields
        created: string
        updated: string
        resolutiondate?: string | null
        duedate?: string | null
        // Custom fields for Epic Link or Parent
        parent?: {
            key: string
        }
        customfield_10014?: string // Epic Link (Standard ID)
        attachment?: {
            id: string
            filename: string
            content: string
            thumbnail?: string
            mimeType: string
            size: number
            size_formatted?: string
        }[]
    }
    progress?: number // Calculated progress (0-100)
    subtasks?: JiraIssue[] // Children logic
}

export interface JiraEpic extends JiraIssue {
    // Specific fields for epics if needed
    stats?: {
        done: number
        inProgress: number
        toDo: number
        total: number
    }
}

export interface JiraProject {
    id: string
    key: string
    name: string
    avatarUrls: {
        "48x48": string
    }
}
