import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JiraService } from "@/services/jira"
import { Loader2, RefreshCw, Terminal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsPage() {
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastSynced, setLastSynced] = useState<string>("Never")

    // Credential State
    const [jiraUrl, setJiraUrl] = useState("")
    const [jiraEmail, setJiraEmail] = useState("")
    const [jiraToken, setJiraToken] = useState("")
    const [okrEpics, setOkrEpics] = useState("")
    const [extraEpics, setExtraEpics] = useState("")
    const [defaultEpicKey, setDefaultEpicKey] = useState("")
    const [debugMode, setDebugMode] = useState(false)

    // AI Creds
    const [geminiKey, setGeminiKey] = useState("")

    // System Logs
    const [logs, setLogs] = useState<any[]>([])

    useEffect(() => {
        // Load creds
        setJiraUrl(localStorage.getItem("jira_url") || "")
        setJiraEmail(localStorage.getItem("jira_email") || "")
        setJiraToken(localStorage.getItem("jira_token") || "")
        setOkrEpics(localStorage.getItem("okr_epics") || "")
        setExtraEpics(localStorage.getItem("extra_epics") || "")
        setDefaultEpicKey(localStorage.getItem("default_epic_key") || "")
        setGeminiKey(localStorage.getItem("gemini_api_key") || "")
        setDebugMode(localStorage.getItem("debug_mode") === "true")

        // Initial log fetch
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/logs')
            if (res.ok) {
                const data = await res.json()
                setLogs(data)
            }
        } catch (e) {
            console.error("Failed to fetch system logs")
        }
    }

    const handleSaveCreds = () => {
        localStorage.setItem("jira_url", jiraUrl)
        localStorage.setItem("jira_email", jiraEmail)
        localStorage.setItem("jira_token", jiraToken)
        localStorage.setItem("okr_epics", okrEpics)
        localStorage.setItem("extra_epics", extraEpics)
        localStorage.setItem("default_epic_key", defaultEpicKey)
        localStorage.setItem("debug_mode", debugMode ? "true" : "false")
        alert("Credentials saved!")
    }

    const handleSaveAiCreds = () => {
        localStorage.setItem("gemini_api_key", geminiKey)
        alert("AI API Key saved!")
    }

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            await JiraService.syncJiraData()
            setLastSynced(new Date().toLocaleString())
            alert("Success! Connected to Jira.")
            fetchLogs() // Refresh logs after sync
        } catch (error: any) {
            alert(`Sync Failed: ${error.message || error}`)
            fetchLogs() // Refresh logs to show error
        }
        setIsSyncing(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Jira Integration</CardTitle>
                        <CardDescription>
                            Configure your connection to Jira Cloud.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="url" className="text-right">
                                    Jira URL
                                </Label>
                                <Input
                                    id="url"
                                    placeholder="https://your-domain.atlassian.net"
                                    className="col-span-3"
                                    value={jiraUrl}
                                    onChange={(e) => setJiraUrl(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    placeholder="user@example.com"
                                    className="col-span-3"
                                    value={jiraEmail}
                                    onChange={(e) => setJiraEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="token" className="text-right">
                                    API Token
                                </Label>
                                <Input
                                    id="token"
                                    type="password"
                                    placeholder="Atlassian API Token"
                                    className="col-span-3"
                                    onChange={(e) => setJiraToken(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="okrEpics" className="text-right">
                                    OKR Epics (IDs)
                                </Label>
                                <Input
                                    id="okrEpics"
                                    placeholder="DEVOPS-633, DEVOPS-634"
                                    className="col-span-3"
                                    value={okrEpics}
                                    onChange={(e) => setOkrEpics(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="extraEpics" className="text-right">
                                    Extra Epics (IDs)
                                </Label>
                                <Input
                                    id="extraEpics"
                                    placeholder="DEVOPS-1, DEVOPS-2"
                                    className="col-span-3"
                                    value={extraEpics}
                                    onChange={(e) => setExtraEpics(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="defaultEpic" className="text-right">
                                    Default Epic (Analysis)
                                </Label>
                                <Input
                                    id="defaultEpic"
                                    placeholder="DEVOPS-633"
                                    className="col-span-3"
                                    value={defaultEpicKey}
                                    onChange={(e) => setDefaultEpicKey(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="debugMode" className="text-right">
                                    Debug Mode
                                </Label>
                                <div className="col-span-3 flex items-center space-x-2">
                                    <input
                                        id="debugMode"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                        checked={debugMode}
                                        onChange={(e) => setDebugMode(e.target.checked)}
                                    />
                                    <span className="text-sm text-muted-foreground">Ativar log de JQL e Performance</span>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleSaveCreds} variant="secondary">Save Credentials</Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <label className="text-base font-medium">Jira Cloud Sync</label>
                                <p className="text-sm text-muted-foreground">
                                    Last synced: {lastSynced}
                                </p>
                            </div>
                            <Button onClick={handleSync} disabled={isSyncing}>
                                {isSyncing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    "Sync with Jira"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* System Logs */}
                <Card className="border-slate-800 bg-slate-950 text-slate-50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Terminal size={18} /> System Logs</CardTitle>
                            <CardDescription className="text-slate-400">
                                Real-time connection and error logs from the backend proxy.
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchLogs}><RefreshCw size={16} /></Button>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full rounded-md border border-slate-800 bg-slate-900 p-4 overflow-auto font-mono text-xs">
                            {logs.length === 0 ? (
                                <div className="text-slate-500 italic">No logs available yet...</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className="mb-2 border-b border-slate-800/50 pb-2 last:border-0">
                                        <div className="flex gap-2 text-slate-500 mb-1">
                                            <span>[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                                            <span className={`font-bold ${log.type === 'ERROR' ? 'text-red-500' :
                                                log.type === 'SUCCESS' ? 'text-green-500' : 'text-blue-400'
                                                }`}>{log.type}</span>
                                        </div>
                                        <div className="text-slate-300 break-all">{log.message}</div>
                                        {log.details && (
                                            <pre className="mt-1 bg-black/30 p-2 rounded text-slate-400 overflow-x-auto">
                                                {log.details}
                                            </pre>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Analyst</CardTitle>
                        <CardDescription>
                            Manage Google Gemini 3 Pro integration settings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="apikey">Gemini API Key</Label>
                            <div className="flex space-x-2">
                                <Input
                                    id="apikey"
                                    type="password"
                                    placeholder="Enter your Gemini API Key..."
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                />
                                <Button onClick={handleSaveAiCreds}>Save Key</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Leave empty to use Simulation Mode (Heuristics).
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
