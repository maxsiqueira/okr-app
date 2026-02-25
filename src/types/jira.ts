export interface JiraIssue {
    id: string;
    key: string;
    progress?: number; // Resolve os erros no StrategicDashboard, OkrAssessment e Reports
    subtasks?: JiraIssue[];
    fields: {
        summary: string;
        status: {
            name: string;
            statusCategory: { key: string; name: string; colorName: string; }
        };
        issuetype: { name: string; iconUrl: string; subtask: boolean; };
        assignee: {
            displayName: string;
            avatarUrls: { "48x48": string };
        } | null;
        parent?: {
            key: string;
            fields?: { summary: string }
        };
        progress?: number;
        customfield_10016?: number; // Story Points para o cálculo de 25%
        customfield_10014?: any;
        aggregatetimespent?: number;
        timespent?: number;
        timeoriginalestimate?: number;
        aggregatetimeoriginalestimate?: number;
        components?: { name: string }[];
        resolutiondate?: string;
        updated?: string;
        fixVersions?: { name: string }[];
        subtasks?: any[];
    };
}