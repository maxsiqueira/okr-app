import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserSettings } from '@/types/settings'
import { SettingsService } from '@/services/settings'
import { useAuth } from './AuthContext'

interface SettingsContextType {
    settings: UserSettings | null
    loading: boolean
    updateSettings: (updates: Partial<UserSettings>) => Promise<void>
    updateJiraSettings: (jira: Partial<UserSettings['jira']>) => Promise<void>
    updateUISettings: (ui: Partial<UserSettings['ui']>) => Promise<void>
    updateAISettings: (ai: Partial<UserSettings['ai']>) => Promise<void>
    updateEpicAnalysisSettings: (epicAnalysis: Partial<UserSettings['epicAnalysis']>) => Promise<void>
    updateDashboardSettings: (dashboard: Partial<UserSettings['dashboard']>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [settings, setSettings] = useState<UserSettings | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user) {
            loadUserSettings()
        } else {
            setSettings(null)
            setLoading(false)
        }
    }, [user])

    const loadUserSettings = async () => {
        setLoading(true)
        try {
            const data = await SettingsService.loadSettings()

            // FALLBACK: If user has no Jira config, load from system_config (admin)
            if (data && (!data?.jira?.url || !data?.jira?.email || !data?.jira?.token)) {
                console.log('[SettingsContext] User Jira config empty, loading from system_config...')

                try {
                    const { db } = await import('@/lib/firebase')
                    const { doc, getDoc } = await import('firebase/firestore')

                    const systemConfigRef = doc(db, 'system_config', 'jira')
                    const systemConfigSnap = await getDoc(systemConfigRef)

                    if (systemConfigSnap.exists()) {
                        const systemConfig = systemConfigSnap.data()
                        console.log('[SettingsContext] ✅ Loaded Jira config from system_config (admin)')

                        // Merge system config into user settings
                        data.jira = {
                            url: systemConfig.url || data.jira.url || '',
                            email: systemConfig.email || data.jira.email || '',
                            token: systemConfig.token || data.jira.token || ''
                        }

                        // Also load default epic key if user doesn't have one
                        if (systemConfig.defaultEpicKey && data.epicAnalysis && !data.epicAnalysis.defaultEpicKey) {
                            console.log('[SettingsContext] ✅ Using defaultEpicKey from system_config:', systemConfig.defaultEpicKey)
                            data.epicAnalysis.defaultEpicKey = systemConfig.defaultEpicKey
                        }
                    } else {
                        console.warn('[SettingsContext] ⚠️ System config not found. Admin needs to configure via Settings.')
                    }
                } catch (error) {
                    console.error('[SettingsContext] Failed to load system_config:', error)
                }
            }

            setSettings(data)
        } catch (error) {
            console.error('[SettingsContext] Failed to load settings:', error)
        }
        setLoading(false)
    }

    // Auto-sync Firestore → localStorage for backward compatibility
    // This ensures JiraService and other code reading from localStorage works on new devices
    useEffect(() => {
        if (settings && !loading) {
            // Jira credentials
            if (settings?.jira?.url) {
                localStorage.setItem('jira_url', settings.jira.url)
            }
            if (settings?.jira?.email) {
                localStorage.setItem('jira_email', settings.jira.email)
            }
            if (settings?.jira?.token) {
                localStorage.setItem('jira_token', settings.jira.token)
            }

            // Epic Analysis settings
            if (settings?.epicAnalysis?.defaultEpicKey) {
                localStorage.setItem('default_epic_key', settings.epicAnalysis.defaultEpicKey)
            }
            if (settings?.epicAnalysis?.extraEpics && settings.epicAnalysis.extraEpics.length > 0) {
                localStorage.setItem('extra_epics', settings.epicAnalysis.extraEpics.join(','))
            }

            // UI settings
            if (settings?.ui?.customLogoUrl) {
                localStorage.setItem('ion_custom_logo', settings.ui.customLogoUrl)
            }
            if (settings?.ui?.refreshInterval) {
                localStorage.setItem('refresh_interval', settings.ui.refreshInterval.toString())
            }

            // AI settings
            if (settings?.ai?.geminiApiKey) {
                localStorage.setItem('gemini_api_key', settings.ai.geminiApiKey)
            }

            // Dashboard settings
            if (settings?.dashboard?.projectKey) {
                localStorage.setItem('jira_project_key', settings.dashboard.projectKey)
            }

            console.log('[SettingsContext] Auto-synced Firestore → localStorage')
        }
    }, [settings, loading])

    const updateSettings = async (updates: Partial<UserSettings>) => {
        try {
            await SettingsService.saveSettings(updates)
            setSettings(prev => prev ? { ...prev, ...updates } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update settings:', error)
            throw error
        }
    }

    const updateJiraSettings = async (jira: Partial<UserSettings['jira']>) => {
        try {
            await SettingsService.updateJiraSettings(jira)
            setSettings(prev => prev ? { ...prev, jira: { ...prev.jira, ...jira } } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update Jira settings:', error)
            throw error
        }
    }

    const updateUISettings = async (ui: Partial<UserSettings['ui']>) => {
        try {
            await SettingsService.updateUISettings(ui)
            setSettings(prev => prev ? { ...prev, ui: { ...prev.ui, ...ui } } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update UI settings:', error)
            throw error
        }
    }

    const updateAISettings = async (ai: Partial<UserSettings['ai']>) => {
        try {
            await SettingsService.updateAISettings(ai)
            setSettings(prev => prev ? { ...prev, ai: { ...prev.ai, ...ai } } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update AI settings:', error)
            throw error
        }
    }

    const updateEpicAnalysisSettings = async (epicAnalysis: Partial<UserSettings['epicAnalysis']>) => {
        try {
            await SettingsService.updateEpicAnalysisSettings(epicAnalysis)
            setSettings(prev => prev ? { ...prev, epicAnalysis: { ...prev.epicAnalysis, ...epicAnalysis } } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update Epic Analysis settings:', error)
            throw error
        }
    }

    const updateDashboardSettings = async (dashboard: Partial<UserSettings['dashboard']>) => {
        try {
            await SettingsService.updateDashboardSettings(dashboard)
            setSettings(prev => prev ? { ...prev, dashboard: { ...prev.dashboard, ...dashboard } } : null)
        } catch (error) {
            console.error('[SettingsContext] Failed to update Dashboard settings:', error)
            throw error
        }
    }

    return (
        <SettingsContext.Provider value={{
            settings,
            loading,
            updateSettings,
            updateJiraSettings,
            updateUISettings,
            updateAISettings,
            updateEpicAnalysisSettings,
            updateDashboardSettings
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
