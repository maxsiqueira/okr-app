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
        }
        assignee: {
            displayName: string
            avatarUrls: {
                "48x48": string
            }
        } | null
        timeoriginalestimate?: number // Seconds
        timespent?: number // Seconds
        components?: { name: string }[]
        fixVersions?: { name: string, released: boolean, releaseDate?: string }[]
        created: string
        updated: string
        resolutiondate?: string | null
        duedate?: string | null
        // Custom fields for Epic Link or Parent
        parent?: {
            key: string
        }
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
