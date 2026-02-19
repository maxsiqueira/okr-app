import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { AlertCircle, CheckCircle2, Settings } from 'lucide-react'

export function JiraSystemConfig() {
    const { user } = useAuth()
    const [config, setConfig] = useState({
        url: '',
        email: '',
        token: '',
        defaultEpicKey: '',
        okr_epic_keys: [] as string[],
        extra_epic_keys: [] as string[]
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        try {
            const docRef = doc(db, 'system_config', 'jira')
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                const data = docSnap.data()
                setConfig({
                    url: data.url || '',
                    email: data.email || '',
                    token: data.token || '',
                    defaultEpicKey: data.defaultEpicKey || '',
                    okr_epic_keys: data.okr_epic_keys || [],
                    extra_epic_keys: data.extra_epic_keys || []
                })
            }
        } catch (error) {
            console.error('[JiraSystemConfig] Failed to load:', error)
            setMessage({
                type: 'error',
                text: 'Failed to load system configuration. Check console for details.'
            })
        }
        setLoading(false)
    }

    const handleSave = async () => {
        // Basic validation
        if (!config.url || !config.email || !config.token) {
            setMessage({
                type: 'error',
                text: 'All fields are required (URL, Email, Token)'
            })
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            const docRef = doc(db, 'system_config', 'jira')
            await setDoc(docRef, {
                url: config.url.trim(),
                email: config.email.trim(),
                token: config.token.trim(),
                defaultEpicKey: config.defaultEpicKey.trim(),
                okr_epic_keys: config.okr_epic_keys,
                extra_epic_keys: config.extra_epic_keys,
                updatedAt: serverTimestamp(),
                updatedBy: user?.uid
            })

            setMessage({
                type: 'success',
                text: '✅ System configuration saved! All users will now use these Jira credentials.'
            })

            // Clear jira_cache to force refresh with new credentials
            console.log('[JiraSystemConfig] Configuration saved. Cache will be refreshed on next request.')

        } catch (error) {
            console.error('[JiraSystemConfig] Failed to save:', error)
            setMessage({
                type: 'error',
                text: `Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
        }

        setSaving(false)
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-orange-500/20">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-orange-500" />
                    <CardTitle>Jira System Configuration</CardTitle>
                </div>
                <CardDescription>
                    <div className="flex items-start gap-2 mt-2 p-3 bg-orange-500/10 rounded-md border border-orange-500/20">
                        <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div className="text-sm">
                            <strong className="text-orange-500">Admin Only:</strong> These credentials are used by all users to access Jira.
                            Users will NOT see these credentials - they are securely stored and accessed only by backend functions.
                        </div>
                    </div>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="jira-url">Jira URL</Label>
                    <Input
                        id="jira-url"
                        type="text"
                        placeholder="https://yourcompany.atlassian.net"
                        value={config.url}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Your Atlassian/Jira Cloud URL
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="jira-email">Jira Email / Username</Label>
                    <Input
                        id="jira-email"
                        type="text"
                        placeholder="admin@company.com or username"
                        value={config.email}
                        onChange={(e) => setConfig({ ...config, email: e.target.value })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Email (Cloud) or Username (c).
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="jira-token">Jira API Token / Password</Label>
                    <Input
                        id="jira-token"
                        type="password"
                        placeholder="••••••••••••••••••••"
                        value={config.token}
                        onChange={(e) => setConfig({ ...config, token: e.target.value })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Cloud: <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Generate API Token</a>.
                        Server: Use your Password or PAT.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="default-epic-key">Default Epic Key (Optional)</Label>
                    <Input
                        id="default-epic-key"
                        type="text"
                        placeholder="Ex: ION-123, DEVOPS-456"
                        value={config.defaultEpicKey}
                        onChange={(e) => setConfig({ ...config, defaultEpicKey: e.target.value })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Epic key used by default for users who haven't configured their own
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="okr-epic-keys">OKR Epic Keys (comma-separated)</Label>
                    <Input
                        id="okr-epic-keys"
                        type="text"
                        placeholder="ION-1, ION-2, ION-3"
                        value={config.okr_epic_keys.join(', ')}
                        onChange={(e) => setConfig({
                            ...config,
                            okr_epic_keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Strategic OKR epics to display in Strategic Dashboard for all users
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="extra-epic-keys">Extra Epic Keys (comma-separated)</Label>
                    <Input
                        id="extra-epic-keys"
                        type="text"
                        placeholder="ION-5, ION-6"
                        value={config.extra_epic_keys.join(', ')}
                        onChange={(e) => setConfig({
                            ...config,
                            extra_epic_keys: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        })}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Additional epics for tracking (non-OKR work) - displayed in Extra Epics section
                    </p>
                </div>

                {message && (
                    <div className={`flex items-start gap-2 p-3 rounded-md border ${message.type === 'success'
                        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                        }`}>
                        {message.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 mt-0.5" />
                        ) : (
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                        )}
                        <p className="text-sm">{message.text}</p>
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save System Configuration'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
