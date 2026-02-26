export interface JiraIssue {
  id: string;
  key: string;
  progress?: number;
  subtasks?: JiraIssue[];
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: { key: string; name: string; colorName: string; }
    };
    issuetype: { name: string; iconUrl: string; subtask: boolean; };
    assignee?: { displayName: string; avatarUrls: { "48x48": string } } | null;
    parent?: { key: string; fields?: { summary: string } };
    progress?: number;
    customfield_10016?: number; // Story Points
    customfield_10014?: any;    // Epic Link Key
    aggregatetimespent?: number;
    timespent?: number;
    resolutiondate?: string;
    updated?: string;
    fixVersions?: { name: string }[];
    timeoriginalestimate?: number;
    aggregatetimeoriginalestimate?: number;
    subtasks?: JiraIssue[];
    components?: { name: string }[];
  } | any; // Use any as a safety valve for partial objects
}
