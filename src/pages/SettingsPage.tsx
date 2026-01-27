import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JiraService } from "@/services/jira"
import { Loader2, RefreshCw, Terminal, CheckCircle2, AlertCircle, ShieldCheck, Database, Zap, Cpu } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsPage() {
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastSynced, setLastSynced] = useState<string>("Never")

    // Credential State
    const [jiraUrl, setJiraUrl] = useState("")
    const [jiraEmail, setJiraEmail] = useState("")
    const [jiraToken, setJiraToken] = useState("")
    const [proxyUrl, setProxyUrl] = useState("")
    const [okrEpics, setOkrEpics] = useState("")
    const [extraEpics, setExtraEpics] = useState("")
    const [defaultEpicKey, setDefaultEpicKey] = useState("")
    const [debugMode, setDebugMode] = useState(false)
    const [geminiKey, setGeminiKey] = useState("")

    // Status State
    const [jiraConnected, setJiraConnected] = useState<boolean | null>(null)
    const [logs, setLogs] = useState<any[]>([])

    useEffect(() => {
        setJiraUrl(localStorage.getItem("jira_url") || "")
        setJiraEmail(localStorage.getItem("jira_email") || "")
        setJiraToken(localStorage.getItem("jira_token") || "")
        setProxyUrl(localStorage.getItem("proxy_url") || "/api/proxy")
        setOkrEpics(localStorage.getItem("okr_epics") || "")
        setExtraEpics(localStorage.getItem("extra_epics") || "")
        setDefaultEpicKey(localStorage.getItem("default_epic_key") || "")
        setGeminiKey(localStorage.getItem("gemini_api_key") || "")
        setDebugMode(localStorage.getItem("debug_mode") === "true")
        setLastSynced(localStorage.getItem("last_synced_time") || "Never")

        const wasConnected = localStorage.getItem("jira_connected") === "true"
        if (wasConnected) setJiraConnected(true)

        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            const currentProxy = localStorage.getItem("proxy_url") || "/api/proxy";
            // If proxy is an external URL, try to fetch logs from it, otherwise use local /api/logs
            const logEndpoint = currentProxy.startsWith('http')
                ? `${currentProxy.replace(/\/$/, "")}/api/logs`
                : '/api/logs';

            const res = await fetch(logEndpoint, {
                headers: { 'bypass-tunnel-reminder': 'true' }
            })
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
        localStorage.setItem("proxy_url", proxyUrl)
        localStorage.setItem("okr_epics", okrEpics)
        localStorage.setItem("extra_epics", extraEpics)
        localStorage.setItem("default_epic_key", defaultEpicKey)
        localStorage.setItem("debug_mode", debugMode ? "true" : "false")

        // Reset connection status on save
        setJiraConnected(null)
        localStorage.removeItem("jira_connected")

        alert("Configurações do Jira salvas!")
    }

    const handleSaveAiCreds = () => {
        localStorage.setItem("gemini_api_key", geminiKey)
        alert("Chave API Gemini salva com sucesso!")
    }

    const handleSync = async () => {
        setIsSyncing(true)
        setJiraConnected(null)
        try {
            // 1. Validar se o PROXY está vivo (Silencioso para bypass)
            const currentProxy = localStorage.getItem("proxy_url") || "/api/proxy";
            if (currentProxy.startsWith('http')) {
                const healthEndpoint = `${currentProxy.replace(/\/$/, "")}/health`;
                try {
                    await fetch(healthEndpoint, {
                        headers: { 'bypass-tunnel-reminder': 'true' }
                    });
                } catch (e) {
                    console.warn("Proxy Health Check failed, attempting direct sync anyway...");
                }
            }

            // 2. Prosseguir com o Sync do Jira
            await JiraService.syncJiraData()
            const now = new Date().toLocaleString()
            setLastSynced(now)
            localStorage.setItem("last_synced_time", now)
            setJiraConnected(true)
            localStorage.setItem("jira_connected", "true")
            fetchLogs()
        } catch (error: any) {
            setJiraConnected(false)
            localStorage.setItem("jira_connected", "false")
            console.error("Sync Error:", error)
        }
        setIsSyncing(false)
    }

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-1">
                <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    System Configuration
                </h2>
                <p className="text-slate-500 font-medium">Configure as integrações principais do ecossistema Ion Dashboard.</p>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">

                {/* Jira Connection - Left Side */}
                <div className="lg:col-span-12 space-y-8">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-900 pb-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Database className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-xl">Integracão Jira Cloud</CardTitle>
                                    </div>
                                    <CardDescription>Configure os endpoints e tokens de acesso para sincronismo em tempo real.</CardDescription>
                                </div>
                                <div className="flex items-center gap-3">
                                    {!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1') && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-full text-[9px] font-bold border border-amber-100 dark:border-amber-900">
                                            ⚠️ CLOUD MODE: NEEDS BACKEND PROXY
                                        </div>
                                    )}
                                    {jiraConnected === true && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-900">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> ONLINE
                                        </div>
                                    )}
                                    {jiraConnected === false && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-full text-xs font-bold border border-red-100 dark:border-red-900">
                                            <AlertCircle className="h-3.5 w-3.5" /> OFFLINE
                                        </div>
                                    )}
                                    <Button onClick={handleSync} disabled={isSyncing} variant={jiraConnected === true ? "outline" : "default"} className="gap-2 shadow-sm font-bold uppercase text-[10px] tracking-widest px-6 h-9">
                                        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                        {isSyncing ? "Validando..." : "Testar Conexão"}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Servidor (URL)</Label>
                                    <Input
                                        placeholder="seu-dominio.atlassian.net"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                        value={jiraUrl}
                                        onChange={(e) => setJiraUrl(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">E-mail de Usuário</Label>
                                    <Input
                                        placeholder="admin@ionsistemas.com.br"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                        value={jiraEmail}
                                        onChange={(e) => setJiraEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">API Token (Atlassian)</Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••••••••••"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 font-mono"
                                        value={jiraToken}
                                        onChange={(e) => setJiraToken(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={`text-[10px] uppercase font-bold tracking-wider ${(!proxyUrl.startsWith('http') && !window.location.hostname.includes('localhost')) ? 'text-red-500' : 'text-slate-400'}`}>
                                        Endereço do Proxy (CORS Bridge)
                                        {(!proxyUrl.startsWith('http') && !window.location.hostname.includes('localhost')) && " - USE A URL DO TUNNEL!"}
                                    </Label>
                                    <Input
                                        placeholder="https://seu-tunnel.trycloudflare.com"
                                        className={`h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500 font-mono ${(!proxyUrl.startsWith('http') && !window.location.hostname.includes('localhost')) ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                                        value={proxyUrl}
                                        onChange={(e) => setProxyUrl(e.target.value)}
                                    />
                                    {(!proxyUrl.startsWith('http') && !window.location.hostname.includes('localhost')) && (
                                        <p className="text-[10px] text-red-500 font-bold mt-1">
                                            No Cloud, você deve colar a URL completa do seu túnel (Ngrok/Cloudflare).
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 border-t border-slate-50 dark:border-slate-900 pt-8">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Epics dos OKRs (CSV)</Label>
                                    <Input
                                        placeholder="DEVOPS-633, DEVOPS-970"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                        value={okrEpics}
                                        onChange={(e) => setOkrEpics(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Extra Epics (Apoio)</Label>
                                    <Input
                                        placeholder="CORP-10, CORP-22"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                        value={extraEpics}
                                        onChange={(e) => setExtraEpics(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Key para Análise Direta</Label>
                                    <Input
                                        placeholder="DEVOPS-633"
                                        className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                        value={defaultEpicKey}
                                        onChange={(e) => setDefaultEpicKey(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100 dark:border-slate-900">
                                <div className="flex items-center gap-3">
                                    <input
                                        id="debugMode"
                                        type="checkbox"
                                        className="h-5 w-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                        checked={debugMode}
                                        onChange={(e) => setDebugMode(e.target.checked)}
                                    />
                                    <Label htmlFor="debugMode" className="cursor-pointer">
                                        <span className="block font-bold text-slate-700 dark:text-slate-200">Modo Debug Avançado</span>
                                        <span className="text-xs text-slate-400 font-medium">Ativa logs detalhados de JQL e performance de resposta.</span>
                                    </Label>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded">
                                        Last Sync: {lastSynced}
                                    </span>
                                    <Button onClick={handleSaveCreds} className="bg-slate-900 hover:bg-black dark:bg-white dark:text-black dark:hover:bg-slate-200 px-8 h-10 font-bold uppercase text-[11px] tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
                                        <ShieldCheck className="mr-2 h-4 w-4" /> Save Configuration
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* AI & Cloud Sync - Bottom Section */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8">

                    <Card className="border-indigo-100/60 dark:border-indigo-950/60 shadow-xl shadow-indigo-100/20 dark:shadow-none bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/10 backdrop-blur-xl">
                        <CardHeader className="border-b border-indigo-100/30 dark:border-indigo-950/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                        <Cpu className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">AI Core & Cloud Hub</CardTitle>
                                        <CardDescription>Gerencie a inteligência estratégica e sincronismo Cloud.</CardDescription>
                                    </div>
                                </div>
                                {geminiKey && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-tighter animate-pulse border border-indigo-200 dark:border-indigo-800">
                                        <Zap className="h-3 w-3 fill-current" /> Connected
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end mb-2">
                                    <Label className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Gemini API Key (Google AI Studio)</Label>
                                    <span className="text-[9px] text-slate-400 px-2 py-0.5 border rounded uppercase font-medium">Model: Gemini 1.5 Flash</span>
                                </div>
                                <div className="flex space-x-2">
                                    <Input
                                        type="password"
                                        placeholder="AIzaSy..."
                                        className="h-11 bg-white/50 border-indigo-100 focus-visible:ring-indigo-500 font-mono text-sm"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                    />
                                    <Button onClick={handleSaveAiCreds} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 font-bold shadow-indigo-200/50 shadow-md">
                                        Connect
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/60 dark:bg-black/20 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Status de IA</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${geminiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                                        <span className={`text-sm font-bold ${geminiKey ? 'text-slate-800 dark:text-slate-200' : 'text-amber-600'}`}>
                                            {geminiKey ? 'Motor Ativo' : 'Simulação'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/60 dark:bg-black/20 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Firestore Cloud</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 italic">Connected</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-900/5 dark:bg-indigo-400/5 p-4 rounded-xl border border-indigo-100/30 dark:border-indigo-400/10 backdrop-blur-sm">
                                <div className="flex gap-3">
                                    <Zap className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h5 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Gravação em Nuvem</h5>
                                        <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                                            A conexão com o projeto <strong>gen-lang-client...</strong> está ativa. Todas as análises geradas serão persistidas em <strong>historico_ia</strong> e <strong>historico_gemini</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-800 bg-slate-950 text-slate-50 shadow-2xl relative overflow-hidden">
                        {/* Scanline effect */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-1 bg-[length:100%_2px,3px_100%]" />

                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-900/50 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                                    <Terminal className="h-4 w-4 text-emerald-500" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-mono uppercase tracking-widest text-emerald-500">System.Console</CardTitle>
                                    <CardDescription className="text-[10px] text-slate-500">Live proxy logs output</CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={fetchLogs} className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-slate-800">
                                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="h-[270px] w-full p-4 overflow-auto font-mono text-[10px] leading-relaxed custom-scrollbar">
                                {logs.length === 0 ? (
                                    <div className="text-slate-700 italic animate-pulse"># Listening for nexus events...</div>
                                ) : (
                                    logs.map((log, i) => (
                                        <div key={i} className="mb-2 group">
                                            <div className="flex gap-2 items-center opacity-70 group-hover:opacity-100 transition-opacity">
                                                <span className="text-slate-600">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                                                <span className={`px-1 rounded-[2px] font-bold text-[9px] ${log.type === 'ERROR' ? 'bg-red-500/20 text-red-500' :
                                                    log.type === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'
                                                    }`}>{log.type}</span>
                                            </div>
                                            <div className="text-slate-300 mt-0.5 ml-2 border-l border-slate-800 pl-3 py-0.5">{log.message}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="bg-slate-900/50 px-4 py-1.5 border-t border-slate-900 flex items-center justify-between">
                                <span className="text-[9px] text-slate-500 font-mono">STATUS: MONITORING ACTIVE</span>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}

