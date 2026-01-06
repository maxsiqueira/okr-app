import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { Link } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Sparkles } from "lucide-react"
import { AiService } from "@/services/ai"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

export function StrategicDashboard() {
    const [okrEpics, setOkrEpics] = useState<JiraIssue[]>([])
    const [extraEpics, setExtraEpics] = useState<JiraIssue[]>([])
    const [allEpics, setAllEpics] = useState<JiraIssue[]>([]) // Fallback or Combined
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [projectKey, setProjectKey] = useState("")
    const [quarterlyData, setQuarterlyData] = useState<{ quarter: string, count: number, color: string }[]>([])

    useEffect(() => {
        // Try to get project key from localStorage, default to ION
        const savedProjectKey = localStorage.getItem("jira_project_key") || "ION"
        setProjectKey(savedProjectKey)
        loadData(savedProjectKey)
    }, [])

    const loadData = async (project: string) => {
        setLoading(true)
        setError(null)
        try {
            // Check for specific lists first
            const okrIds = (localStorage.getItem("okr_epics") || "").split(",").map(s => s.trim()).filter(Boolean)
            const extraIds = (localStorage.getItem("extra_epics") || "").split(",").map(s => s.trim()).filter(Boolean)

            if (okrIds.length > 0 || extraIds.length > 0) {
                // Configured Mode
                const [okrData, extraData] = await Promise.all([
                    JiraService.getEpicsByKeys(okrIds),
                    JiraService.getEpicsByKeys(extraIds)
                ])
                setOkrEpics(okrData)
                setExtraEpics(extraData)
                setAllEpics([...okrData, ...extraData])
                // Calculate quarterly metrics for OKR epics
                await calculateQuarterlyMetrics(okrData)
            } else {
                // Default Mode (Project Scan)
                const data = await JiraService.getEpics(project)
                setAllEpics(data)
                setOkrEpics(data) // Treat all as main for now
                setExtraEpics([])
                if (data.length === 0) {
                    setError(`No epics found in project "${project}". Try a different project key or configure specific Epics in Settings.`)
                }
            }
        } catch (err) {
            setError(`Failed to load epics. Check your credentials.`)
        }
        setLoading(false)
    }

    const handleProjectChange = (newKey: string) => {
        setProjectKey(newKey)
        localStorage.setItem("jira_project_key", newKey)
        loadData(newKey)
    }

    const calculateQuarterlyMetrics = async (epics: JiraIssue[]) => {
        const currentYear = new Date().getFullYear()
        const quarterlyCompletion = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }

        // Fetch details for all epics in PARALLEL (not sequential)
        const detailsPromises = epics.map(epic =>
            JiraService.getEpicDetails(epic.key).catch(err => {
                console.error(`Failed to fetch details for ${epic.key}`, err)
                return null
            })
        )

        const allDetails = await Promise.all(detailsPromises)

        allDetails.forEach(details => {
            if (!details) return

            // Count completed children by quarter
            details.children.forEach(child => {
                if (child.fields.status.statusCategory.key === 'done' && child.fields.resolutiondate) {
                    const resolutionDate = new Date(child.fields.resolutiondate)
                    if (resolutionDate.getFullYear() === currentYear) {
                        const month = resolutionDate.getMonth()
                        if (month <= 2) quarterlyCompletion.Q1++
                        else if (month <= 5) quarterlyCompletion.Q2++
                        else if (month <= 8) quarterlyCompletion.Q3++
                        else quarterlyCompletion.Q4++
                    }
                }
                // Also count subtasks
                if (child.subtasks) {
                    child.subtasks.forEach(sub => {
                        if (sub.fields.status.statusCategory.key === 'done' && sub.fields.resolutiondate) {
                            const resolutionDate = new Date(sub.fields.resolutiondate)
                            if (resolutionDate.getFullYear() === currentYear) {
                                const month = resolutionDate.getMonth()
                                if (month <= 2) quarterlyCompletion.Q1++
                                else if (month <= 5) quarterlyCompletion.Q2++
                                else if (month <= 8) quarterlyCompletion.Q3++
                                else quarterlyCompletion.Q4++
                            }
                        }
                    })
                }
            })
        })

        setQuarterlyData([
            { quarter: 'Q1', count: quarterlyCompletion.Q1, color: '#3B82F6' },
            { quarter: 'Q2', count: quarterlyCompletion.Q2, color: '#10B981' },
            { quarter: 'Q3', count: quarterlyCompletion.Q3, color: '#F59E0B' },
            { quarter: 'Q4', count: quarterlyCompletion.Q4, color: '#8B5CF6' },
        ])
    }

    // Calculate Metrics (Combined)
    const totalInitiatives = allEpics.length
    const doneCount = allEpics.filter(e => e.fields.status.statusCategory.key === "done").length
    const progressPercent = totalInitiatives > 0 ? Math.round((doneCount / totalInitiatives) * 100) : 0

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
            <AiInsightsSection epics={allEpics} />

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
                        <p className="text-xs text-muted-foreground">{doneCount} of {totalInitiatives} initiatives done</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quarterly Completion Chart for OKR Epics */}
            {quarterlyData.some(q => q.count > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tarefas OKR Concluídas por Trimestre ({new Date().getFullYear()})</CardTitle>
                        <CardDescription>Quantidade de tarefas finalizadas dos OKRs em cada período</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={quarterlyData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ quarter, count }) => `${quarter}: ${count}`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="count"
                                    >
                                        {quarterlyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
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

function AiInsightsSection({ epics }: { epics: JiraIssue[] }) {
    const [insight, setInsight] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        const result = await AiService.generateInsights({ epics })
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
                        Get strategic insights powered by Gemini 3 Pro.
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
                        {insight.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('•') || line.startsWith('-') ? "pl-4 mb-1" : "mb-2"}>
                                {line.replace(/\*\*/g, '')}
                            </p>
                        ))}
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
