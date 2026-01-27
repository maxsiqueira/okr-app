import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Sparkles } from "lucide-react"
import { AiService } from "@/services/ai"
import { Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"

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

    useEffect(() => {
        const savedProjectKey = localStorage.getItem("jira_project_key") || "ION"
        setProjectKey(savedProjectKey)
        loadData(savedProjectKey, selectedVersion)
        loadManualContext()
    }, [selectedVersion])

    const loadManualContext = () => {
        const savedObjs = localStorage.getItem("strategic_objectives")
        const savedOkrs = localStorage.getItem("manual_okrs")
        if (savedObjs) setStrategicObjectives(JSON.parse(savedObjs))
        if (savedOkrs) setManualOkrs(JSON.parse(savedOkrs))
    }

    const loadData = async (project: string, version: string = "ALL") => {
        setLoading(true)
        setError(null)
        try {
            // Check for specific lists first
            const okrIds = (localStorage.getItem("okr_epics") || "").split(",").map(s => s.trim()).filter(Boolean)
            const extraIds = (localStorage.getItem("extra_epics") || "").split(",").map(s => s.trim()).filter(Boolean)

            let fetchedOkr: JiraIssue[] = []
            let fetchedExtra: JiraIssue[] = []
            let fetchedAll: JiraIssue[] = []

            if (okrIds.length > 0 || extraIds.length > 0) {
                // Configured Mode
                const [okrData, extraData] = await Promise.all([
                    JiraService.getEpicsByKeys(okrIds, version),
                    JiraService.getEpicsByKeys(extraIds, version)
                ])
                fetchedOkr = okrData
                fetchedExtra = extraData
                fetchedAll = [...okrData, ...extraData]
            } else {
                // Default Mode (Project Scan)
                fetchedAll = await JiraService.getEpics(project, version)
                fetchedOkr = fetchedAll
                fetchedExtra = []
            }

            setOkrEpics(fetchedOkr)
            setExtraEpics(fetchedExtra)
            setAllEpics(fetchedAll)

            if (fetchedAll.length === 0) {
                if (okrIds.length > 0 || extraIds.length > 0) {
                    setError(`As chaves configuradas (OKR/Extra) não foram encontradas. Verifique se os IDs estão corretos nas Configurações.`)
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

        } catch (err) {
            console.error(err)
            setError(`Failed to load epics. Check your credentials.`)
        }
        setLoading(false)
    }

    const handleProjectChange = (newKey: string) => {
        setProjectKey(newKey)
        localStorage.setItem("jira_project_key", newKey)
        loadData(newKey, selectedVersion)
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

    // Calculate Metrics (Combined)
    const activeEpics = allEpics.filter(e => !e.fields.status.name.toLowerCase().includes("cancel"))
    const totalInitiatives = activeEpics.length
    const totalProgress = activeEpics.reduce((acc, e) => acc + (e.progress ?? 0), 0)
    const progressPercent = totalInitiatives > 0 ? Math.round(totalProgress / totalInitiatives) : 0

    const EpicList = ({ title, list }: { title: string, list: JiraIssue[] }) => (
        <div className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold border-b pb-2">{title}</h3>
            {list.length === 0 ? <p className="text-muted-foreground italic">No epics configured.</p> : (
                list.map(epic => (
                    <Link to={`/epic-analysis?key=${epic.key}`} key={epic.id} className="block group">
                        <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 group-hover:bg-muted/50 p-2 rounded-md transition-colors">
                            <div className="space-y-1">
                                <p className="text-sm font-medium leading-none group-hover:underline">{epic.key}: {epic.fields.summary}</p>
                                <p className="text-xs text-muted-foreground">
                                    Assigned to {epic.fields.assignee ? epic.fields.assignee.displayName : "Unassigned"}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`px-2 py-1 rounded-full text-xs font-bold 
                                    ${epic.fields.status.statusCategory.key === 'done' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' :
                                        epic.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' :
                                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
                                    {epic.fields.status.name}
                                </div>
                                <div className="text-sm font-bold ml-4">
                                    {epic.progress ?? 0}%
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
                        onChange={(e) => setSelectedVersion(e.target.value)}
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Initiatives</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInitiatives}</div>
                        <p className="text-xs text-muted-foreground">{totalInitiatives > 0 ? "Active Projects" : "No data found"}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{progressPercent}%</div>
                        <p className="text-xs text-muted-foreground">Average Reach of active initiatives</p>
                    </CardContent>
                </Card>
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

function AiInsightsSection({ epics, strategicObjectives, manualOkrs }: { epics: JiraIssue[], strategicObjectives: any[], manualOkrs: any[] }) {
    const [insight, setInsight] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        const result = await AiService.generateInsights({
            epics,
            strategicObjectives,
            manualOkrs
        })
        setInsight(result)
        setLoading(false)
    }

    return (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <Sparkles className="h-5 w-5" /> AI Analyst
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Get strategic insights powered by Gemini 1.5 Flash.
                    </p>
                </div>
                {!insight && (
                    <Button onClick={handleGenerate} disabled={loading || epics.length === 0} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                        {loading ? "Analyzing..." : "Generate Insights"}
                    </Button>
                )}
            </CardHeader>
            {insight && (
                <CardContent>
                    <div className="prose dark:prose-invert text-sm max-w-none">
                        {insight.split('\n').map((line, i) => {
                            if (!line.trim()) return <div key={i} className="h-2" />

                            // Handle Bold (**text**)
                            const parts = line.split(/(\*\*.*?\*\*)/g)
                            const content = parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j}>{part.slice(2, -2)}</strong>
                                }
                                return part
                            })

                            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                                return <p key={i} className="pl-4 mb-1 flex items-start gap-2"><span>•</span><span>{content}</span></p>
                            }

                            if (line.match(/^\d\./)) {
                                return <p key={i} className="font-bold text-base mt-4 mb-2 text-indigo-800 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900 pb-1">{content}</p>
                            }

                            return <p key={i} className="mb-2 leading-relaxed">{content}</p>
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
