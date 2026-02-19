import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JiraService } from "@/services/jira-client"
import { Loader2, RefreshCw, Terminal, CheckCircle2, AlertCircle, ShieldCheck, Database, Zap, Cpu, LayoutTemplate, Mail, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserManagementPanel } from "@/components/settings/UserManagementPanel"
import { AccountSecurityPanel } from "@/components/settings/AccountSecurityPanel"
import { JiraSystemConfig } from "@/components/settings/JiraSystemConfig"
import { useAuth } from "@/contexts/AuthContext"
import { useSettings } from "@/contexts/SettingsContext"
import { db, functions } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"

export function SettingsPage() {
    const { user } = useAuth();
    const { updateJiraSettings, updateEpicAnalysisSettings } = useSettings();
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
    const [autoRefresh, setAutoRefresh] = useState("0")
    const [logoUrlInput, setLogoUrlInput] = useState("")
    const [loginLogoInput, setLoginLogoInput] = useState("")
    const [enableAi, setEnableAi] = useState(true)

    // Status State
    const [jiraConnected, setJiraConnected] = useState<boolean | null>(null)
    const [logs, setLogs] = useState<any[]>([])

    // SMTP State
    const [smtpHost, setSmtpHost] = useState("")
    const [smtpPort, setSmtpPort] = useState("")
    const [smtpUser, setSmtpUser] = useState("")
    const [smtpPassword, setSmtpPassword] = useState("")
    const [smtpFromEmail, setSmtpFromEmail] = useState("")
    const [smtpFromName, setSmtpFromName] = useState("")
    const [isSavingSmtp, setIsSavingSmtp] = useState(false)
    const [isTestingSmtp, setIsTestingSmtp] = useState(false)

    useEffect(() => {
        // Migration Strategy: 
        // 1. Prefer Cloud Data (user object)
        // 2. Fallback to LocalStorage (legacy)

        if (user) {
            setJiraUrl(user.jiraUrl || localStorage.getItem("jira_url") || "")
            setJiraEmail(user.jiraEmail || localStorage.getItem("jira_email") || "")
            setJiraToken(user.jiraToken || localStorage.getItem("jira_token") || "")
            setProxyUrl(user.proxyUrl || localStorage.getItem("proxy_url") || "/api/proxy")
            setOkrEpics(user.okrEpics || localStorage.getItem("okr_epics") || "")
            setExtraEpics(user.extraEpics || localStorage.getItem("extra_epics") || "")
            setDefaultEpicKey(user.defaultEpicKey || localStorage.getItem("default_epic_key") || "")
            setGeminiKey(user.geminiApiKey || localStorage.getItem("gemini_api_key") || "")
            setDebugMode(user.debugMode !== undefined ? user.debugMode : (localStorage.getItem("debug_mode") === "true"))
            setAutoRefresh(user.autoRefresh || localStorage.getItem("ion_auto_refresh_minutes") || "0")
            setLogoUrlInput(user.customLogo || localStorage.getItem("ion_custom_logo") || "")
        } else {
            // Fallback if user context not ready (shouldn't happen due to protection)
            setJiraUrl(localStorage.getItem("jira_url") || "")
            setJiraEmail(localStorage.getItem("jira_email") || "")
            setJiraToken(localStorage.getItem("jira_token") || "")
            setProxyUrl(localStorage.getItem("proxy_url") || "/api/proxy")
            setOkrEpics(localStorage.getItem("okr_epics") || "")
            setExtraEpics(localStorage.getItem("extra_epics") || "")
            setDefaultEpicKey(localStorage.getItem("default_epic_key") || "")
            setGeminiKey(localStorage.getItem("gemini_api_key") || "")
            setDebugMode(localStorage.getItem("debug_mode") === "true")
            setAutoRefresh(localStorage.getItem("ion_auto_refresh_minutes") || "0")
            setLogoUrlInput(localStorage.getItem("ion_custom_logo") || "")
        }

        setLastSynced(localStorage.getItem("last_synced_time") || "Never")
        setLoginLogoInput(localStorage.getItem("ion_login_logo") || "")
        setEnableAi(localStorage.getItem("ion_enable_ai") !== "false")

        const wasConnected = localStorage.getItem("jira_connected") === "true"
        if (wasConnected) setJiraConnected(true)

        fetchLogs()
        fetchSmtpConfig()
    }, [user])

    const fetchSmtpConfig = async () => {
        try {
            const docRef = doc(db, "config", "smtp");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSmtpHost(data.host || "");
                setSmtpPort(data.port || "");
                setSmtpUser(data.user || "");
                setSmtpPassword(data.password || "");
                setSmtpFromEmail(data.fromEmail || "");
                setSmtpFromName(data.fromName || "");
            }
        } catch (e) {
            console.error("Error fetching SMTP config:", e);
        }
    };

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

    const handleSaveCreds = async () => {
        // 1. Save Local
        localStorage.setItem("jira_url", jiraUrl)
        localStorage.setItem("jira_email", jiraEmail)
        localStorage.setItem("jira_token", jiraToken)
        localStorage.setItem("proxy_url", proxyUrl)
        localStorage.setItem("okr_epics", okrEpics)
        localStorage.setItem("extra_epics", extraEpics)
        localStorage.setItem("default_epic_key", defaultEpicKey)
        localStorage.setItem("debug_mode", debugMode ? "true" : "false")

        // 2. Save Cloud (Firestore - both collections for compatibility)
        if (user?.uid) {
            try {
                // Save to users collection (existing)
                await setDoc(doc(db, "users", user.uid), {
                    jiraUrl,
                    jiraEmail,
                    jiraToken,
                    proxyUrl,
                    okrEpics,
                    extraEpics,
                    defaultEpicKey,
                    debugMode
                }, { merge: true });

                // ALSO save to user_settings collection (new)
                await updateJiraSettings({
                    url: jiraUrl,
                    email: jiraEmail,
                    token: jiraToken
                }).catch(err => console.error("Failed to sync to user_settings", err));

                await updateEpicAnalysisSettings({
                    defaultEpicKey,
                    extraEpics: extraEpics.split(',').map(k => k.trim()).filter(k => k)
                }).catch(err => console.error("Failed to sync epic settings", err));

                console.log("Settings synced to cloud.");
            } catch (e) {
                console.error("Failed to sync settings to cloud", e);
            }
        }

        // Reset connection status on save
        setJiraConnected(null)
        localStorage.removeItem("jira_connected")

        alert("Configurações do Jira salvas (Local & Cloud)!")
    }

    const handleSaveAiCreds = async () => {
        localStorage.setItem("gemini_api_key", geminiKey)

        if (user?.uid) {
            try {
                await setDoc(doc(db, "users", user.uid), {
                    geminiApiKey: geminiKey
                }, { merge: true });
            } catch (e) {
                console.error("Failed to sync API Key to cloud", e);
            }
        }

        alert("Chave API Gemini salva com sucesso (Local & Cloud)!")
    }

    const handleSaveUI = async () => {
        localStorage.setItem("ion_auto_refresh_minutes", autoRefresh)
        localStorage.setItem("ion_custom_logo", logoUrlInput)
        localStorage.setItem("ion_login_logo", loginLogoInput)
        localStorage.setItem("ion_enable_ai", enableAi ? "true" : "false")

        if (user?.uid) {
            try {
                await setDoc(doc(db, "users", user.uid), {
                    autoRefresh,
                    customLogo: logoUrlInput,
                    // Login logo and global AI toggle might be considered "Device specific" or "Global"?
                    // For now let's persist what makes sense for the user profile
                }, { merge: true });
            } catch (e) {
                console.error("Failed to sync UI settings to cloud", e);
            }
        }

        window.dispatchEvent(new Event('ion-logo-change'))
        window.dispatchEvent(new Event('ion-config-change'))
        alert("Configurações de Interface salvas!")
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'system' | 'login') => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64String = reader.result as string
            if (target === 'system') {
                setLogoUrlInput(base64String)
                localStorage.setItem("ion_custom_logo", base64String)
            } else {
                setLoginLogoInput(base64String)
                localStorage.setItem("ion_login_logo", base64String)
            }
            window.dispatchEvent(new Event('ion-logo-change'))
        }
        reader.readAsDataURL(file)
    }

    const handleSync = async () => {
        setIsSyncing(true)
        setJiraConnected(null)
        try {
            // 1. SAVE CREDENTIALS FIRST so backend has latest data
            await handleSaveCreds()

            // 2. Derive Project Key to test
            let projectKey = 'ION';
            if (defaultEpicKey && defaultEpicKey.includes('-')) {
                projectKey = defaultEpicKey.split('-')[0];
            } else if (okrEpics && okrEpics.length > 0) {
                const firstKey = okrEpics.split(',')[0].trim();
                if (firstKey.includes('-')) {
                    projectKey = firstKey.split('-')[0];
                }
            }

            console.log(`[Settings] Testing connection with Project Key: ${projectKey}`);

            // 3. Real Backend Fetch (Force Refresh)
            await JiraService.getEpics(projectKey, "ALL", true)

            const now = new Date().toLocaleString()
            setLastSynced(now)
            localStorage.setItem("last_synced_time", now)
            setJiraConnected(true)
            localStorage.setItem("jira_connected", "true")
            fetchLogs()
            alert("Conexão com Jira estabelecida com sucesso!")

        } catch (error: any) {
            setJiraConnected(false)
            localStorage.setItem("jira_connected", "false")
            console.error("Sync Error:", error)
            alert(`Falha na conexão: ${error.message}`)
        }
        setIsSyncing(false)
    }

    const handleSaveSmtp = async () => {
        setIsSavingSmtp(true);
        try {
            await setDoc(doc(db, "config", "smtp"), {
                host: smtpHost,
                port: smtpPort,
                user: smtpUser,
                password: smtpPassword,
                fromEmail: smtpFromEmail,
                fromName: smtpFromName,
                updatedAt: new Date()
            });
            alert("Configurações SMTP salvas com sucesso!");
        } catch (error) {
            console.error("Error saving SMTP config:", error);
            alert("Erro ao salvar configurações SMTP.");
        }
        setIsSavingSmtp(false);
    };

    const handleTestSmtp = async () => {
        if (!user?.email) {
            alert("E-mail do usuário não encontrado.");
            return;
        }
        setIsTestingSmtp(true);
        try {
            const sendEmail = httpsCallable(functions, 'sendEmail');
            await sendEmail({
                to: user.email,
                subject: "Teste de Configuração SMTP - Ion Dashboard",
                text: "Se você recebeu este e-mail, a configuração do seu servidor SMTP está funcionando corretamente.",
                html: "<h1>Teste de Configuração SMTP</h1><p>Se você recebeu este e-mail, a configuração do seu servidor SMTP está funcionando corretamente.</p>"
            });
            alert(`E-mail de teste enviado com sucesso para ${user.email}!`);
        } catch (error: any) {
            console.error("Error testing SMTP:", error);
            alert(`Erro ao testar SMTP: ${error.message}`);
        }
        setIsTestingSmtp(false);
    };

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-1">
                <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    System Configuration
                </h2>
                <p className="text-slate-500 font-medium">Configure as integrações principais do ecossistema Ion Dashboard.</p>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">

                {/* Admin User Management Panel */}
                {user?.role === 'admin' && (
                    <div className="lg:col-span-12">
                        <UserManagementPanel />
                    </div>
                )}

                {/* Admin Jira System Configuration */}
                {user?.role === 'admin' && (
                    <div className="lg:col-span-12">
                        <JiraSystemConfig />
                    </div>
                )}

                {/* UI Preferences */}
                <div className="lg:col-span-12">
                    <Card className="border-cyan-100/60 dark:border-cyan-950/60 shadow-xl shadow-cyan-100/20 dark:shadow-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
                        <CardHeader className="border-b border-cyan-100/30 dark:border-cyan-950/30 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                                    <LayoutTemplate className="h-5 w-5 text-cyan-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Configurações de Interface</CardTitle>
                                    <CardDescription>Personalize a aparência e comportamento do dashboard.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Logo URL (Imagem)</Label>
                                    <Input
                                        placeholder="https://exemplo.com/logo.png"
                                        value={logoUrlInput}
                                        onChange={e => setLogoUrlInput(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ou Carregar Localmente</Label>
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group relative">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => handleFileChange(e, 'system')}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200 transition-colors">
                                            <Cpu className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Clique para selecionar</p>
                                            <p className="text-[10px] text-slate-400">JPG, PNG ou SVG</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400">Deixe em branco para usar o logo padrão Ion.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Logo de Abertura (Login)</Label>
                                    <Input
                                        placeholder="https://exemplo.com/splash.png"
                                        value={loginLogoInput}
                                        onChange={e => setLoginLogoInput(e.target.value)}
                                        className="h-11 bg-slate-50 border-slate-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ou Carregar Localmente</Label>
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group relative">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => handleFileChange(e, 'login')}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                                            <LayoutTemplate className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">Logo de Login</p>
                                            <p className="text-[10px] text-slate-400">Clique para selecionar</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Atualização Automática (Minutos)</Label>
                                <select
                                    className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-800"
                                    value={autoRefresh}
                                    onChange={e => setAutoRefresh(e.target.value)}
                                >
                                    <option value="0">Desativado</option>
                                    <option value="5">A cada 5 minutos</option>
                                    <option value="10">A cada 10 minutos</option>
                                    <option value="15">A cada 15 minutos</option>
                                    <option value="30">A cada 30 minutos</option>
                                    <option value="60">A cada 1 hora</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Configurações de IA</Label>
                                <div className="flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-900/20">
                                    <input
                                        id="enableAi"
                                        type="checkbox"
                                        className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                        checked={enableAi}
                                        onChange={(e) => setEnableAi(e.target.checked)}
                                    />
                                    <Label htmlFor="enableAi" className="cursor-pointer">
                                        <span className="block font-bold text-slate-700 dark:text-slate-200 text-xs">Ativar Inteligência Artificial</span>
                                        <span className="text-[10px] text-slate-500 font-medium leading-tight">Exibe o painel de insights estratégicos nas telas do sistema.</span>
                                    </Label>
                                </div>
                            </div>
                            <div className="md:col-span-2 flex justify-end">
                                <Button onClick={handleSaveUI} className="bg-cyan-600 hover:bg-cyan-700 font-bold">
                                    Salvar Interface
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Account Security */}
                <div className="lg:col-span-12">
                    <AccountSecurityPanel />
                </div>

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
                                    {geminiKey && (
                                        <Button
                                            onClick={async () => {
                                                localStorage.removeItem("gemini_api_key");
                                                setGeminiKey("");

                                                if (user?.uid) {
                                                    await setDoc(doc(db, "users", user.uid), {
                                                        geminiApiKey: ""
                                                    }, { merge: true });
                                                }

                                                alert("Chave API desconectada.");
                                            }}
                                            variant="outline"
                                            className="h-11 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold"
                                        >
                                            Desconectar
                                        </Button>
                                    )}
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

                    <Card className="border-emerald-100/60 dark:border-emerald-950/60 shadow-xl shadow-emerald-100/20 dark:shadow-none bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-950 dark:to-emerald-950/10 backdrop-blur-xl">
                        <CardHeader className="border-b border-emerald-100/30 dark:border-emerald-950/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                        <Mail className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">Configuração SMTP (Firebase)</CardTitle>
                                        <CardDescription>Configure o servidor para envio de relatórios e notificações.</CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleTestSmtp}
                                        disabled={isTestingSmtp || !smtpHost}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                    >
                                        {isTestingSmtp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                        Testar
                                    </Button>
                                    <Button
                                        onClick={handleSaveSmtp}
                                        disabled={isSavingSmtp}
                                        size="sm"
                                        className="h-8 bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        {isSavingSmtp ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">Servidor SMTP</Label>
                                    <Input
                                        placeholder="smtp.exemplo.com"
                                        value={smtpHost}
                                        onChange={e => setSmtpHost(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">Porta</Label>
                                    <Input
                                        placeholder="587 ou 465"
                                        value={smtpPort}
                                        onChange={e => setSmtpPort(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">Usuário</Label>
                                    <Input
                                        placeholder="usuario@dominio.com"
                                        value={smtpUser}
                                        onChange={e => setSmtpUser(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">Senha</Label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        value={smtpPassword}
                                        onChange={e => setSmtpPassword(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">E-mail de Remetente</Label>
                                    <Input
                                        placeholder="relatorios@dominio.com"
                                        value={smtpFromEmail}
                                        onChange={e => setSmtpFromEmail(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-400">Nome do Remetente</Label>
                                    <Input
                                        placeholder="Ion Reports"
                                        value={smtpFromName}
                                        onChange={e => setSmtpFromName(e.target.value)}
                                        className="h-9 bg-white/50 border-emerald-100/50"
                                    />
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
