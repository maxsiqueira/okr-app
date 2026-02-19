import { Timestamp } from "firebase/firestore"

export interface JiraSettings {
    url: string
    email: string
    token: string
}

export interface UISettings {
    customLogoUrl?: string
    refreshInterval: number
    theme?: 'light' | 'dark' | 'system'
}

export interface AISettings {
    geminiApiKey?: string
}

export interface EpicAnalysisSettings {
    defaultEpicKey?: string
    extraEpics?: string[]
}

export interface DashboardSettings {
    projectKey?: string
    selectedVersion?: string
    selectedPeriod?: string
}

export interface UserSettings {
    userId: string

    jira: JiraSettings
    ui: UISettings
    ai: AISettings
    epicAnalysis: EpicAnalysisSettings
    dashboard: DashboardSettings

    createdAt?: Date | Timestamp
    updatedAt?: Date | Timestamp
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'userId' | 'createdAt' | 'updatedAt'> = {
    jira: {
        url: '',
        email: '',
        token: ''
    },
    ui: {
        refreshInterval: 30000,
        theme: 'system'
    },
    ai: {},
    epicAnalysis: {
        extraEpics: []
    },
    dashboard: {
        projectKey: 'ION',
        selectedVersion: 'ALL',
        selectedPeriod: 'ALL'
    }
}
