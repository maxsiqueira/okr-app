import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { UserSettings, DEFAULT_SETTINGS } from '@/types/settings'

export class SettingsService {
    private static readonly COLLECTION = 'user_settings'

    /**
     * Load user settings from Firestore
     * If no settings exist, migrate from localStorage
     */
    static async loadSettings(): Promise<UserSettings | null> {
        const userId = auth.currentUser?.uid
        if (!userId) return null

        try {
            const docRef = doc(db, this.COLLECTION, userId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                console.log('[Settings] Loaded from Firestore')
                return docSnap.data() as UserSettings
            }

            // No settings in Firestore, try migration from localStorage
            console.log('[Settings] No Firestore settings found, attempting migration')
            return await this.migrateFromLocalStorage(userId)
        } catch (error) {
            console.error('[Settings] Error loading settings:', error)
            return null
        }
    }

    /**
     * Save user settings to Firestore
     */
    static async saveSettings(settings: Partial<UserSettings>): Promise<void> {
        const userId = auth.currentUser?.uid
        if (!userId) throw new Error('User not authenticated')

        try {
            const docRef = doc(db, this.COLLECTION, userId)
            await setDoc(docRef, {
                ...settings,
                userId,
                updatedAt: new Date()
            }, { merge: true })

            console.log('[Settings] Saved to Firestore')
        } catch (error) {
            console.error('[Settings] Error saving settings:', error)
            throw error
        }
    }

    /**
     * One-time migration from localStorage to Firestore
     * Called automatically when no Firestore settings exist
     */
    private static async migrateFromLocalStorage(userId: string): Promise<UserSettings> {
        const settings: UserSettings = {
            userId,
            ...DEFAULT_SETTINGS,
            jira: {
                url: localStorage.getItem('jira_url') || '',
                email: localStorage.getItem('jira_email') || '',
                token: localStorage.getItem('jira_token') || ''
            },
            ui: {
                customLogoUrl: localStorage.getItem('custom_logo_url') || undefined,
                refreshInterval: parseInt(localStorage.getItem('refresh_interval') || '30000'),
                theme: 'system'
            },
            ai: {
                geminiApiKey: localStorage.getItem('gemini_api_key') || undefined
            },
            epicAnalysis: {
                defaultEpicKey: localStorage.getItem('default_epic_key') || undefined,
                extraEpics: localStorage.getItem('extra_epics')?.split(',').filter(k => k.trim()) || []
            },
            dashboard: {
                projectKey: localStorage.getItem('jira_project_key') || 'ION',
                selectedVersion: 'ALL', // Default
                selectedPeriod: 'ALL'   // Default
            },
            createdAt: new Date(),
            updatedAt: new Date()
        }

        // Save migrated settings to Firestore
        await this.saveSettings(settings)

        console.log('[Settings] Migrated from localStorage to Firestore')
        return settings
    }

    /**
     * Update specific settings section
     */
    static async updateJiraSettings(jira: Partial<UserSettings['jira']>): Promise<void> {
        const current = await this.loadSettings()
        await this.saveSettings({
            jira: { ...current?.jira, ...jira } as UserSettings['jira']
        })
    }

    static async updateUISettings(ui: Partial<UserSettings['ui']>): Promise<void> {
        const current = await this.loadSettings()
        await this.saveSettings({
            ui: { ...current?.ui, ...ui } as UserSettings['ui']
        })
    }

    static async updateAISettings(ai: Partial<UserSettings['ai']>): Promise<void> {
        const current = await this.loadSettings()
        await this.saveSettings({
            ai: { ...current?.ai, ...ai } as UserSettings['ai']
        })
    }

    static async updateEpicAnalysisSettings(epicAnalysis: Partial<UserSettings['epicAnalysis']>): Promise<void> {
        const current = await this.loadSettings()
        await this.saveSettings({
            epicAnalysis: { ...current?.epicAnalysis, ...epicAnalysis } as UserSettings['epicAnalysis']
        })
    }

    static async updateDashboardSettings(dashboard: Partial<UserSettings['dashboard']>): Promise<void> {
        const current = await this.loadSettings()
        await this.saveSettings({
            dashboard: { ...current?.dashboard, ...dashboard } as UserSettings['dashboard']
        })
    }
}
