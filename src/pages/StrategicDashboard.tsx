import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { JiraService } from "@/services/jira-client"
import { JiraIssue } from "@/types/jira"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Rocket, Target, Zap, LayoutDashboard, AlertTriangle } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, query, onSnapshot, doc } from "firebase/firestore"
import { useTranslation } from "react-i18next"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { AiInsightsSection } from "@/components/analytics/AiInsightsSection"
import { useSettings } from "@/contexts/SettingsContext"
import { useAuth } from "@/contexts/AuthContext"

const TubularBar = (props: any) => {
    const { fill, x, y, width, height, index } = props;
    if (height <= 0) return null;

    const topHeight = width * 0.25;
    const gradientId = `barGradient-${index}`;

    const darken = (color: string, percent: number) => {
        if (!color.startsWith('#')) return color;
        const num = parseInt(color.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const r = Math.max(0, (num >> 16) - amt);
        const g = Math.max(0, ((num >> 8) & 0x00ff) - amt);
        const b = Math.max(0, (num & 0x0000ff) - amt);
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    };

    return (
        <g>
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={darken(fill, 40)} />
                    <stop offset="25%" stopColor={fill} />
                    <stop offset="45%" stopColor={darken(fill, -25)} /> {/* Highlight */}
                    <stop offset="65%" stopColor={fill} />
                    <stop offset="100%" stopColor={darken(fill, 50)} />
                </linearGradient>
            </defs>

            {/* Cylinder Body */}
            <path
                d={`M ${x},${y + topHeight / 2} 
                   L ${x},${y + height - topHeight / 2} 
                   A ${width / 2},${topHeight / 2} 0 0 0 ${x + width},${y + height - topHeight / 2} 
                   L ${x + width},${y + topHeight / 2} 
                   A ${width / 2},${topHeight / 2} 0 0 1 ${x},${y + topHeight / 2} Z`}
                fill={`url(#${gradientId})`}
            />

            {/* Cylinder Top Cap */}
            <ellipse
                cx={x + width / 2}
                cy={y + topHeight / 2}
                rx={width / 2}
                ry={topHeight / 2}
                fill={fill}
                stroke={darken(fill, 10)}
                strokeWidth={0.5}
            />
        </g>
    );
};

export function StrategicDashboard() {
    const { t } = useTranslation()
    const [okrEpics, setOkrEpics] = useState<JiraIssue[]>([])
    const [extraEpics, setExtraEpics] = useState<JiraIssue[]>([])
    const [allEpics, setAllEpics] = useState<JiraIssue[]>([]) // Fallback or Combined
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [projectKey, setProjectKey] = useState("")
    const [selectedVersion, setSelectedVersion] = useState("ALL")
    const [allVersions, setAllVersions] = useState<string[]>([])
    const [quarterlyData, setQuarterlyData] = useState<{ quarter: string, count: number, color: string }[]>([])
    const [displayYear, setDisplayYear] = useState(new Date().getFullYear())
    const [strategicObjectives, setStrategicObjectives] = useState<any[]>([])
    const [manualOkrs, setManualOkrs] = useState<any[]>([])
    const [systemConfig, setSystemConfig] = useState<any>(null)

    const { settings, updateDashboardSettings } = useSettings()
    const { user } = useAuth()

    useEffect(() => {
        // Priority: Settings (Firestore) > LocalStorage > Default
        const savedProjectKey = settings?.dashboard?.projectKey || localStorage.getItem("jira_project_key") || "ION"
        const savedVersion = settings?.dashboard?.selectedVersion || "ALL"

        setProjectKey(savedProjectKey)
        setSelectedVersion(savedVersion)

        // Listen to system config changes
        const unsubscribeConfig = onSnapshot(doc(db, "system_config", "jira"), (snapshot) => {
            if (snapshot.exists()) {
                setSystemConfig(snapshot.data())
            }
        })

        const unsubscribeObjectives = loadManualContext()
        return () => {
            if (typeof unsubscribeObjectives === 'function') unsubscribeObjectives()
            unsubscribeConfig()
        }
    }, [])

    // Reload data when systemConfig or selectedVersion changes
    useEffect(() => {
        // Only load if we have a project key (initialized)
        if (projectKey) {
            loadData(projectKey, selectedVersion)
        }
    }, [systemConfig, selectedVersion, projectKey, user])

    const loadManualContext = () => {
        // Legacy manual OKRs could stay in localStorage for now if needed, 
        // but Strategic Objectives MUST come from Firestore
        const unsubscribe = onSnapshot(query(collection(db, "strategic_objectives")), (snapshot) => {
            const objs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setStrategicObjectives(objs)
        })

        const savedOkrs = localStorage.getItem("manual_okrs")
        if (savedOkrs) setManualOkrs(JSON.parse(savedOkrs))

        return unsubscribe
    }

    const loadData = async (project: string, version: string = "ALL") => {
        setLoading(true)
        setError(null)
        try {
            // Helper to safe parse keys from various sources (string, array, null)
            const parseKeys = (val: any): string[] => {
                if (!val) return []
                if (Array.isArray(val)) return val
                if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
                return []
            }

            // --- DATA LOADING STRATEGY (Waterfall) ---
            // 1. Try User Specific Configuration
            // 2. Try System/Admin Configuration
            // 3. Fallback to Project Scan (All Epics)

            let fetchedOkr: JiraIssue[] = []
            let fetchedExtra: JiraIssue[] = []
            let fetchedAll: JiraIssue[] = []

            // 1. User Profile Config
            const userOkrIds = parseKeys(user?.okrEpics)
            const userExtraIds = parseKeys(user?.extraEpics)

            if (userOkrIds.length > 0 || userExtraIds.length > 0) {
                console.log(`[Dashboard] Trying User Config:`, { okr: userOkrIds, extra: userExtraIds })
                const [okrData, extraData] = await Promise.all([
                    JiraService.getEpicsByKeys(userOkrIds, version),
                    JiraService.getEpicsByKeys(userExtraIds, version)
                ])
                if (okrData.length > 0 || extraData.length > 0) {
                    fetchedOkr = okrData
                    fetchedExtra = extraData
                    fetchedAll = [...okrData, ...extraData]
                } else {
                    console.warn(`[Dashboard] User Config yielded no results. Falling back...`)
                }
            }

            // 2. System/Admin Config (if User Config failed/empty)
            if (fetchedAll.length === 0) {
                const sysOkrIds = parseKeys(systemConfig?.okr_epic_keys || localStorage.getItem("okr_epics"))
                const sysExtraIds = parseKeys(systemConfig?.extra_epic_keys || localStorage.getItem("extra_epics"))

                if (sysOkrIds.length > 0 || sysExtraIds.length > 0) {
                    console.log(`[Dashboard] Trying System/Local Config:`, { okr: sysOkrIds, extra: sysExtraIds })
                    const [okrData, extraData] = await Promise.all([
                        JiraService.getEpicsByKeys(sysOkrIds, version),
                        JiraService.getEpicsByKeys(sysExtraIds, version)
                    ])
                    if (okrData.length > 0 || extraData.length > 0) {
                        fetchedOkr = okrData
                        fetchedExtra = extraData
                        fetchedAll = [...okrData, ...extraData]
                    }
                }
            }

            // Fallback: If configured mode yielded nothing (stale config) OR no config exists
            if (fetchedAll.length === 0) {
                // Default Mode (Project Scan)
                console.log(`[Dashboard] No specific epics found (or not configured). Scanning project ${project}...`)
                fetchedAll = await JiraService.getEpics(project, version)
                fetchedOkr = fetchedAll
                fetchedExtra = []
            }

            setOkrEpics(fetchedOkr)
            setExtraEpics(fetchedExtra)
            setAllEpics(fetchedAll)

            if (fetchedAll.length === 0) {
                // Determine what went wrong for the error message
                const userConfigured = userOkrIds.length > 0 || userExtraIds.length > 0
                const sysConfigured = (systemConfig?.okr_epic_keys || []).length > 0 || (systemConfig?.extra_epic_keys || []).length > 0

                if (userConfigured || sysConfigured) {
                    setError(`Não foi possível carregar os Epics configurados (${userConfigured ? 'Perfil Usuário' : 'Sistema'}). Verifique as permissões no Jira ou as chaves configuradas.`)
                } else if (!project) {
                    setError(`Nenhuma chave de projeto definida. Configure o Project Key ou adicione Epics específicos em Configurações.`)
                } else {
                    setError(`Nenhum Epic encontrado no projeto "${project}". Tente outra chave ou configure Epics específicos.`)
                }
            }

            // Extract all unique versions for the dropdown
            const versions = new Set<string>()
            fetchedAll.forEach(epic => {
                if (epic.fields.fixVersions) {
                    epic.fields.fixVersions.forEach(v => versions.add(v.name))
                }
            })
            if (versions.size > 0) {
                setAllVersions(Array.from(versions).sort())
            }

            // Calculate quarterly metrics for OKR epics
            if (fetchedOkr.length > 0) {
                await calculateQuarterlyMetrics(fetchedOkr)
            }

        } catch (err: any) {
            console.error(err)
            setError(err.message || `Failed to load epics. Check your credentials.`)
        }
        setLoading(false)
    }

    const handleProjectChange = (newKey: string) => {
        setProjectKey(newKey)
        // Persist to settings
        updateDashboardSettings({ projectKey: newKey })
    }

    const handleVersionChange = (newVersion: string) => {
        setSelectedVersion(newVersion)
        // Persist to settings
        updateDashboardSettings({ selectedVersion: newVersion })
    }

    const calculateQuarterlyMetrics = async (epics: JiraIssue[]) => {
        const keys = epics.map(e => e.key)
        const allDetails = await JiraService.getBulkEpicDetails(keys)

        const getStatsForYear = (year: number) => {
            const stats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
            allDetails.forEach(details => {
                if (!details) return
                details.children.forEach(child => {
                    const dStr = child.fields.resolutiondate || child.fields.updated
                    if (child.fields.status.statusCategory.key === 'done' && dStr) {
                        const resolutionDate = new Date(dStr)
                        if (resolutionDate.getFullYear() === year) {
                            const month = resolutionDate.getMonth()
                            if (month <= 2) stats.Q1++
                            else if (month <= 5) stats.Q2++
                            else if (month <= 8) stats.Q3++
                            else stats.Q4++
                        }
                    }
                    if (child.subtasks) {
                        child.subtasks.forEach(sub => {
                            const sdStr = sub.fields.resolutiondate || sub.fields.updated
                            if (sub.fields.status.statusCategory.key === 'done' && sdStr) {
                                const resolutionDate = new Date(sdStr)
                                if (resolutionDate.getFullYear() === year) {
                                    const month = resolutionDate.getMonth()
                                    if (month <= 2) stats.Q1++
                                    else if (month <= 5) stats.Q2++
                                    else if (month <= 8) stats.Q3++
                                    else stats.Q4++
                                }
                            }
                        })
                    }
                })
            })
            return stats
        }

        const yearsToTry = [new Date().getFullYear(), 2025, 2024]
        let bestYear = yearsToTry[0]
        let maxCount = -1
        let bestStats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }

        for (const year of yearsToTry) {
            const stats = getStatsForYear(year)
            const total = Object.values(stats).reduce((a, b) => a + b, 0)
            if (total > maxCount) {
                maxCount = total
                bestYear = year
                bestStats = stats
            }
        }

        setDisplayYear(bestYear)
        setQuarterlyData([
            { quarter: 'Q1', count: bestStats.Q1, color: '#3B82F6' },
            { quarter: 'Q2', count: bestStats.Q2, color: '#10B981' },
            { quarter: 'Q3', count: bestStats.Q3, color: '#F59E0B' },
            { quarter: 'Q4', count: bestStats.Q4, color: '#8B5CF6' },
        ])
    }

    // Calculate Metrics (Refining with Strategic Objectives logic)
    const activeEpics = allEpics.filter(e => !e.fields.status.name.toLowerCase().includes("cancel"))

    // Calculate global progress based on Strategic Objectives if they exist
    const objectivesForCalc = strategicObjectives.filter(o => !o.excludeFromCalculation)

    let progressPercent = 0
    if (objectivesForCalc.length > 0) {
        // Use the refined calculation logic
        const totalSum = objectivesForCalc.reduce((acc, obj) => {
            const progSum = (obj.epicKeys || []).reduce((eAcc: number, eKey: string) => {
                const epic = activeEpics.find(e => e.key === eKey)
                return eAcc + (epic?.progress || 0)
            }, 0)
            const jiraProg = (obj.epicKeys || []).length > 0 ? (progSum / obj.epicKeys.length) : 0
            const actualProg = obj.suggestedProgress != null ? obj.suggestedProgress : jiraProg
            return acc + actualProg
        }, 0)
        progressPercent = Math.round(totalSum / objectivesForCalc.length)
    } else {
        // Fallback to standard Jira calc
        const totalInitiatives = activeEpics.length
        const totalProgress = activeEpics.reduce((acc, e) => acc + (e.progress ?? 0), 0)
        progressPercent = totalInitiatives > 0 ? Math.round(totalProgress / totalInitiatives) : 0
    }

    const totalInitiatives = activeEpics.length

    const EpicList = ({ title, list }: { title: string, list: JiraIssue[] }) => (
        <div className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold border-b pb-2">{title}</h3>
            {list.length === 0 ? <p className="text-muted-foreground italic">{t('dashboard.no_epics', 'No epics configured.')}</p> : (
                list.map(epic => (
                    <Link to={`/epic-analysis?key=${epic.key}`} key={epic.id} className="block group">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0 group-hover:bg-slate-50 dark:group-hover:bg-white/5 p-3 rounded-xl transition-all duration-200">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-realestate-primary-500 bg-realestate-primary-50 dark:bg-realestate-primary-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">{epic.key}</span>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-realestate-primary-600 transition-colors">{epic.fields.summary}</p>
                                </div>
                                <p className="text-xs text-slate-400 font-medium">
                                    {t('dashboard.responsible', 'Responsável')}: {epic.fields.assignee ? epic.fields.assignee.displayName : t('dashboard.not_assigned', "Não atribuído")}
                                </p>
                                {(epic.progress ?? 0) === 0 && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md border border-amber-100 dark:border-amber-800 animate-pulse w-fit mt-1">
                                        <AlertTriangle size={10} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">{t('objectives.okr_cross_alert', 'Considerar esforço - OKR Cross')}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center space-x-3">
                                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider border-none
                                    ${epic.fields.status.statusCategory.key === 'done' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        epic.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                    {epic.fields.status.name}
                                </Badge>
                                <div className="flex flex-col items-end min-w-[60px]">
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{epic.progress ?? 0}%</span>
                                    <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className="h-full bg-realestate-primary-500 transition-all duration-500"
                                            style={{ width: `${epic.progress ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))
            )}
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Strategic Overview</h2>
                <div className="flex items-center space-x-2">
                    <select
                        className="p-1.5 border rounded bg-background text-sm font-medium"
                        value={selectedVersion}
                        onChange={(e) => handleVersionChange(e.target.value)}
                    >
                        <option value="ALL">All Versions</option>
                        {allVersions.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                    <Input
                        placeholder="Project Key (e.g. DEVOPS)"
                        value={projectKey}
                        onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                        className="w-[180px]"
                    />
                    <Button onClick={() => handleProjectChange(projectKey)} size="sm">
                        <Search className="h-4 w-4 mr-2" /> Load
                    </Button>
                </div>
            </div>

            {/* AI Insights Section */}
            <AiInsightsSection
                epics={allEpics}
                strategicObjectives={strategicObjectives}
                manualOkrs={manualOkrs}
            />

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Iniciativas Ativas"
                    value={totalInitiatives}
                    icon={Rocket}
                    gradient="blue"
                    className="h-full"
                />
                <StatCard
                    title="Alcanço Médio"
                    value={`${progressPercent}%`}
                    icon={Target}
                    gradient="purple"
                    className="h-full"
                    trend={{ value: 4, isPositive: true }}
                />
                <StatCard
                    title="Entrega Q4"
                    value={quarterlyData[3]?.count || 0}
                    icon={Zap}
                    gradient="green"
                    className="h-full"
                />
                <StatCard
                    title="Taxa de Successo"
                    value="92%"
                    icon={LayoutDashboard}
                    gradient="orange"
                    className="h-full"
                />
            </div>

            {/* Quarterly Completion Chart for OKR Epics */}
            {quarterlyData.some(q => q.count > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tarefas OKR Concluídas por Trimestre ({displayYear})</CardTitle>
                        <CardDescription>Quantidade de tarefas finalizadas dos OKRs em cada período</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={quarterlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="quarter" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="count" shape={<TubularBar />} barSize={60}>
                                        {quarterlyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 items-start">
                {loading ? (
                    <div className="col-span-2 text-center p-10 text-muted-foreground">Loading Initiatives...</div>
                ) : (
                    <>
                        {/* If using manual list, show separated. If not, show one big list */}
                        {(okrEpics.length > 0 || extraEpics.length > 0) ? (
                            <>
                                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border shadow-sm col-span-1">
                                    <EpicList title="🚀 Strategic OKRs" list={okrEpics} />
                                </div>
                                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border shadow-sm col-span-1">
                                    <EpicList title="📦 Extra Epics" list={extraEpics} />
                                </div>
                            </>
                        ) : (
                            <div className="col-span-2 bg-white dark:bg-slate-950 p-4 rounded-lg border shadow-sm">
                                <EpicList title="All Epics" list={allEpics} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
