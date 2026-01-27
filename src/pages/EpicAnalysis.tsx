import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ExternalLink, Search, Clock, Sparkles, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"

const TubularBar = (props: any) => {
    const { fill, x, y, width, height, index } = props;
    if (height <= 0 || !height) return null;

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
                    <stop offset="45%" stopColor={darken(fill, -25)} />
                    <stop offset="65%" stopColor={fill} />
                    <stop offset="100%" stopColor={darken(fill, 50)} />
                </linearGradient>
            </defs>

            <path
                d={`M ${x},${y + topHeight / 2} 
                   L ${x},${y + height - topHeight / 2} 
                   A ${width / 2},${topHeight / 2} 0 0 0 ${x + width},${y + height - topHeight / 2} 
                   L ${x + width},${y + topHeight / 2} 
                   A ${width / 2},${topHeight / 2} 0 0 1 ${x},${y + topHeight / 2} Z`}
                fill={`url(#${gradientId})`}
            />

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

export function EpicAnalysis() {
    const [searchParams, setSearchParams] = useSearchParams()
    const savedDefaultKey = localStorage.getItem("default_epic_key") || "DEVOPS-633"
    const initialKey = searchParams.get("key") || savedDefaultKey

    const [currentKey, setCurrentKey] = useState(initialKey.toUpperCase())
    const [searchKey, setSearchKey] = useState("")

    const [data, setData] = useState<{ epic: JiraIssue, children: JiraIssue[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedQuarter, setSelectedQuarter] = useState("ALL")
    const [selectedVersion, setSelectedVersion] = useState("ALL")
    const [extraEpicsData, setExtraEpicsData] = useState<any[]>([])
    const [loadingExtra, setLoadingExtra] = useState(false)

    useEffect(() => {
        loadEpic(currentKey)
    }, [currentKey])

    const loadEpic = async (key: string) => {
        setLoading(true)
        setError(null)
        try {
            const result = await JiraService.getEpicDetails(key)
            if (result) {
                setData(result)
            } else {
                setError(`Epic ${key} not found or details unavailable.`)
                setData(null)
            }
        } catch (err: any) {
            const errorMessage = err?.message || "Failed to load epic details"
            setError(`${errorMessage}. Please check your Jira credentials/connection in Settings.`)
            console.error("[EpicAnalysis] Error:", err)
        }
        setLoading(false)
    }

    useEffect(() => {
        const extraKeysStr = localStorage.getItem("extra_epics") || ""
        if (extraKeysStr) {
            const keys = extraKeysStr.split(",").map(k => k.trim()).filter(k => k.length > 0)
            if (keys.length > 0) {
                loadExtraEpics(keys)
            }
        }
    }, [])

    const loadExtraEpics = async (keys: string[]) => {
        setLoadingExtra(true)
        try {
            const results = await JiraService.getEpicsByKeys(keys)
            setExtraEpicsData(results)
        } catch (err) {
            console.error("[EpicAnalysis] Error loading extra epics:", err)
        }
        setLoadingExtra(false)
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchKey.trim()) {
            const upperKey = searchKey.trim().toUpperCase()
            setCurrentKey(upperKey)
            setSearchParams({ key: upperKey })
        }
    }

    if (loading) return <div className="p-8 text-center">Loading analysis for {currentKey}...</div>

    if (error || !data) {
        return (
            <div className="p-8 space-y-4">
                <h2 className="text-2xl font-bold text-red-500">Error Loading Epic</h2>
                <p>{error}</p>
                <div className="max-w-md">
                    <form onSubmit={handleSearch} className="flex space-x-2">
                        <Input
                            placeholder="Enter Epic Key (e.g. ION-123)"
                            value={searchKey}
                            onChange={e => setSearchKey(e.target.value)}
                        />
                        <Button type="submit"><Search className="mr-2 h-4 w-4" /> Analyze</Button>
                    </form>
                </div>
            </div>
        )
    }

    const { epic, children } = data

    // 1. Prepare FLATTENED list of all issues (Stories/Tasks + Subtasks) for metric consistency
    const allAtoms = children.flatMap(c => [c, ...(c.subtasks || [])])

    // 1b. Helper to get the most relevant year for the trend chart
    const calculateStatsForYear = (year: number) => {
        const stats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
        allAtoms.forEach(issue => {
            const isDone = issue.fields.status.statusCategory.key === 'done'
            const dStr = issue.fields.resolutiondate || issue.fields.updated
            if (isDone && dStr) {
                const d = new Date(dStr)
                if (d.getFullYear() === year) {
                    const m = d.getMonth()
                    if (m <= 2) stats.Q1++
                    else if (m <= 5) stats.Q2++
                    else if (m <= 8) stats.Q3++
                    else stats.Q4++
                }
            }
        })
        return stats
    }

    const currentYear = new Date().getFullYear()
    const yearsToTry = [currentYear, currentYear - 1, currentYear - 2]
    let bestYearStats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
    let displayYear = currentYear
    let maxDoneVolume = -1

    yearsToTry.forEach(y => {
        const s = calculateStatsForYear(y)
        const total = Object.values(s).reduce((a, b) => a + b, 0)
        if (total > maxDoneVolume) {
            maxDoneVolume = total
            bestYearStats = s
            displayYear = y
        }
    })

    const quarterlyData = [
        { quarter: 'Q1', count: bestYearStats.Q1, color: '#3B82F6' },
        { quarter: 'Q2', count: bestYearStats.Q2, color: '#10B981' },
        { quarter: 'Q3', count: bestYearStats.Q3, color: '#F59E0B' },
        { quarter: 'Q4', count: bestYearStats.Q4, color: '#8B5CF6' },
    ]

    // 1c. Group Milestones (Major items finished in displayYear)
    const milestonesByQuarter = {
        Q1: [] as JiraIssue[],
        Q2: [] as JiraIssue[],
        Q3: [] as JiraIssue[],
        Q4: [] as JiraIssue[]
    }

    allAtoms.filter(i => !i.fields.issuetype.subtask && i.fields.status.statusCategory.key === 'done').forEach(issue => {
        const dStr = issue.fields.resolutiondate || issue.fields.updated
        if (dStr) {
            const d = new Date(dStr)
            if (d.getFullYear() === displayYear) {
                const m = d.getMonth()
                if (m <= 2) milestonesByQuarter.Q1.push(issue)
                else if (m <= 5) milestonesByQuarter.Q2.push(issue)
                else if (m <= 8) milestonesByQuarter.Q3.push(issue)
                else milestonesByQuarter.Q4.push(issue)
            }
        }
    })

    // 2. Filter Logic for UI: Deep include parents if subtasks match
    const filteredChildren = children.filter(child => {
        const versionMatch = selectedVersion === "ALL" || (child.fields.fixVersions?.some(v => v.name === selectedVersion))
            || (selectedVersion === "Unscheduled" && (!child.fields.fixVersions || child.fields.fixVersions.length === 0))

        if (!versionMatch) return false
        if (selectedQuarter === "ALL") return true

        const qYear = new Date().getFullYear()
        let qStartMonth = 0; let qEndMonth = 11
        switch (selectedQuarter) {
            case "Q1": qStartMonth = 0; qEndMonth = 2; break;
            case "Q2": qStartMonth = 3; qEndMonth = 5; break;
            case "Q3": qStartMonth = 6; qEndMonth = 8; break;
            case "Q4": qStartMonth = 9; qEndMonth = 11; break;
        }
        const qStart = new Date(qYear, qStartMonth, 1)
        const qEnd = new Date(qYear, qEndMonth + 1, 0)
        qEnd.setHours(23, 59, 59, 999)

        const checkIssueMatches = (iss: JiraIssue) => {
            const dStr = iss.fields.resolutiondate || iss.fields.updated
            if (!dStr) return false
            const d = new Date(dStr)
            return d >= qStart && d <= qEnd && iss.fields.status.statusCategory.key === 'done'
        }

        const selfMatches = checkIssueMatches(child)
        const anySubMatches = child.subtasks?.some(s => checkIssueMatches(s))

        return selfMatches || anySubMatches
    })

    const allVersions = Array.from(new Set(children.flatMap(c => c.fields.fixVersions?.map(v => v.name) || []))).sort()

    // UPDATE METRICS TO USE FILTERED LIST (Children + Subtasks)
    const allFilteredIssues = filteredChildren.flatMap(c => [c, ...(c.subtasks || [])])

    const activeIssuesFiltered = allFilteredIssues.filter(c => !c.fields.status.name.toLowerCase().includes("cancel"))

    // Correct categorization using subtask field
    const majorIssuesFiltered = activeIssuesFiltered.filter(i => !i.fields.issuetype.subtask)
    const subtaskIssuesOnlyFiltered = activeIssuesFiltered.filter(i => i.fields.issuetype.subtask)

    // 1. Overall Epic Progress (Jira Logic: Major Done / Total Major)
    // "Total Major" includes ALL statuses (To Do, In Progress, Done, Cancelled)
    const allMajorIssues = children.filter(c => !c.fields.issuetype.subtask)
    const allDoneMajorIssues = allMajorIssues.filter(c => c.fields.status.statusCategory.key === "done").length
    const percentComplete = allMajorIssues.length > 0
        ? Math.round((allDoneMajorIssues / allMajorIssues.length) * 100)
        : 0

    // MAJOR METRICS (Lead for KPIs and Charts - Reacts to filters)
    const majorDone = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "done").length
    const majorInProgress = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "indeterminate").length
    const majorToDo = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "new").length
    const majorCancelled = allFilteredIssues.filter(i => i.fields.status.name.toLowerCase().includes("cancel") && !i.fields.issuetype.subtask).length

    // SUBTASK METRICS (Secondary details)
    const subDone = subtaskIssuesOnlyFiltered.filter(i => i.fields.status.statusCategory.key === "done").length
    const subInProgress = subtaskIssuesOnlyFiltered.filter(i => i.fields.status.statusCategory.key === "indeterminate").length
    const subToDo = subtaskIssuesOnlyFiltered.filter(i => i.fields.status.statusCategory.key === "new").length

    const cancelledCount = majorCancelled

    // GLOBAL Counters (Independent of Filter)
    const globalStoryCount = children.filter(c =>
        ["Story", "Historia", "História"].some(name => c.fields.issuetype.name.includes(name))
    ).length
    const globalTaskCount = children.filter(c =>
        ["Task", "Tarefa"].some(name => c.fields.issuetype.name.includes(name))
    ).length
    const globalBugCount = children.filter(c =>
        ["Bug", "Defeito", "Falha"].some(name => c.fields.issuetype.name.includes(name))
    ).length
    const globalBlockCount = children.filter(c =>
        ["Block", "Impedimento", "Blocker"].some(name => c.fields.issuetype.name.includes(name))
    ).length
    const globalSubtaskCount = children.reduce((acc, c) => {
        const fromSubtasksProperty = c.subtasks?.length || 0
        const isSelfSubtask = c.fields.issuetype.subtask ? 1 : 0
        return acc + fromSubtasksProperty + isSelfSubtask
    }, 0)

    const chartData = [
        { name: 'Concluídos', value: majorDone, color: '#10B981' },
        { name: 'Em Andamento', value: majorInProgress, color: '#F59E0B' },
        { name: 'Novos', value: majorToDo, color: '#3B82F6' },
        { name: 'Canceladas', value: majorCancelled, color: '#EF4444' },
    ].filter(item => item.value > 0)

    // Time Tracking
    let totalSpentSeconds = epic.fields.timespent || 0
    let totalEstimateSeconds = epic.fields.timeoriginalestimate || epic.fields.timeestimate || 0

    filteredChildren.forEach(child => {
        totalSpentSeconds += child.fields.timespent || 0
        totalEstimateSeconds += child.fields.timeoriginalestimate || child.fields.timeestimate || 0
        if (child.subtasks) {
            child.subtasks.forEach(sub => {
                totalSpentSeconds += sub.fields.timespent || 0
                totalEstimateSeconds += sub.fields.timeoriginalestimate || sub.fields.timeestimate || 0
            })
        }
    })

    const totalSpentHours = Math.round(totalSpentSeconds / 3600)
    const totalEstimateHours = Math.round(totalEstimateSeconds / 3600)
    const timeProgress = totalEstimateHours > 0 ? Math.min(100, Math.round((totalSpentHours / totalEstimateHours) * 100)) : 0

    // Workload
    const workloadMap = new Map<string, number>()
    if (epic.fields.timespent) {
        const hours = epic.fields.timespent / 3600
        workloadMap.set("Epic: " + (epic.fields.components?.[0]?.name || "General"), hours)
    }

    filteredChildren.forEach(child => {
        let seconds = child.fields.timespent || 0
        if (child.subtasks) {
            child.subtasks.forEach(sub => { seconds += (sub.fields.timespent || 0) })
        }
        const hours = seconds / 3600
        if (hours > 0) {
            const groups = child.fields.components?.length ? child.fields.components.map(c => c.name) : ["General"]
            const hoursPerGroup = hours / groups.length
            groups.forEach(group => {
                const current = workloadMap.get(group) || 0
                workloadMap.set(group, current + hoursPerGroup)
            })
        }
    })

    const realWorkloadData = Array.from(workloadMap.entries()).map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10
    })).sort((a, b) => b.hours - a.hours)

    const workloadData = realWorkloadData.length > 0 ? realWorkloadData : [{ name: 'Sem registros', hours: 0 }]

    // Analyst & Component Data
    const componentStats = new Map<string, { done: number, wip: number, todo: number, cancelled: number }>()

    allFilteredIssues.forEach((issue: JiraIssue) => {
        const cat = issue.fields.status.statusCategory.key

        const comps = issue.fields.components?.length ? issue.fields.components.map(c => c.name) : ["General"]
        comps.forEach(comp => {
            const cStats = componentStats.get(comp) || { done: 0, wip: 0, todo: 0, cancelled: 0 }
            if (cat === 'done') cStats.done++
            else if (cat === 'indeterminate') cStats.wip++
            else if (cat === 'new') cStats.todo++
            if (issue.fields.status.name.toLowerCase().includes('cancel')) cStats.cancelled++
            componentStats.set(comp, cStats)
        })
    })

    const componentData = Array.from(componentStats.entries()).sort((a, b) => (b[1].done + b[1].wip) - (a[1].done + a[1].wip))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{epic.key}: {epic.fields.summary}</h2>
                    <p className="text-muted-foreground">Deep Dive Analysis</p>
                </div>
                <div className="flex items-center space-x-2">
                    <form onSubmit={handleSearch} className="flex space-x-2">
                        <Input
                            placeholder="Analyze another Epic..."
                            value={searchKey}
                            onChange={e => setSearchKey(e.target.value)}
                            className="w-[200px]"
                        />
                        <Button type="submit" size="icon" variant="secondary"><Search className="h-4 w-4" /></Button>
                    </form>
                </div>
            </div>

            <div className="flex justify-end mb-4 space-x-2">
                <select className="p-2 border rounded bg-background text-foreground" value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                    <option value="ALL">All Versions</option>
                    {allVersions.map(v => <option key={v} value={v}>{v}</option>)}
                    <option value="Unscheduled">Unscheduled</option>
                </select>
                <select className="p-2 border rounded bg-background text-foreground" value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}>
                    <option value="ALL">All Periods</option>
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Apr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Sep)</option>
                    <option value="Q4">Q4 (Oct-Dec)</option>
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-6">
                <Card className="col-span-2">
                    <CardContent className="pt-6">
                        <div className="relative h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[{ value: percentComplete }, { value: 100 - percentComplete }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} startAngle={90} endAngle={-270} dataKey="value">
                                        <Cell fill="hsl(var(--primary))" /><Cell fill="hsl(var(--muted))" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-4xl font-bold text-primary">{percentComplete}%</span>
                            </div>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-sm font-medium">ALCANCE</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-emerald-600">{majorDone}</div>
                        <p className="text-[10px] text-muted-foreground">+{subDone} subtasks</p>
                        <p className="text-xs font-medium mt-1 text-emerald-600 uppercase">Entregues</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-amber-500">{majorInProgress}</div>
                        <p className="text-[10px] text-muted-foreground">+{subInProgress} subtasks</p>
                        <p className="text-xs font-medium mt-1 text-amber-500 uppercase">WIP</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-blue-500">{majorToDo}</div>
                        <p className="text-[10px] text-muted-foreground">+{subToDo} subtasks</p>
                        <p className="text-xs font-medium mt-1 text-blue-500 uppercase">Novas</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-red-500">{cancelledCount}</div>
                        <p className="text-xs font-medium mt-2 text-red-500 uppercase">Canceladas</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                {[
                    { label: "Histórias", val: globalStoryCount },
                    { label: "Tasks", val: globalTaskCount },
                    { label: "Bugs", val: globalBugCount },
                    { label: "Blocks", val: globalBlockCount },
                    { label: "Subtasks", val: globalSubtaskCount }
                ].map(item => (
                    <Card key={item.label} className="bg-muted/30 border-dashed hover:bg-muted/50 transition-colors">
                        <CardContent className="pt-4 pb-4 text-center">
                            <div className="text-2xl font-bold text-foreground">{item.val}</div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{item.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5" /> Summary Panel (Time Tracking)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col space-y-2">
                        <div className="flex justify-between text-sm font-medium"><span>Time</span><span>{totalSpentHours}h / {totalEstimateHours}h</span></div>
                        <Progress value={timeProgress} className="h-4" /><p className="text-xs text-muted-foreground text-right">{timeProgress}% consumed</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Distribuição de Tarefas ({selectedQuarter})</CardTitle></CardHeader>
                    <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} stroke="rgba(255,255,255,0.2)" strokeWidth={2} dataKey="value" label={({ value }) => `${value}`}>{chartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} /><Legend /></PieChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Horas Gastas ({selectedQuarter})</CardTitle></CardHeader>
                    <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={workloadData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="rgba(255,255,255,0.1)" strokeWidth={1} dataKey="hours" label={({ name, hours }) => `${name.slice(0, 10)}: ${hours}h`}>{workloadData.map((_, i) => <Cell key={i} fill={['#4F46E5', '#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6'][i % 6]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '12px' }} /></PieChart></ResponsiveContainer></div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Tarefas Concluídas por Trimestre ({displayYear})</CardTitle></CardHeader>
                <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={quarterlyData} margin={{ top: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="quarter" /><YAxis allowDecimals={false} /><Tooltip cursor={{ fill: 'transparent' }} /><Bar dataKey="count" shape={<TubularBar />} barSize={40}>{quarterlyData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Principais Entregas (Milestones - {displayYear})
                    </CardTitle>
                    <CardDescription>Stories e Tasks concluídas agrupadas por trimestre</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-4">
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                            <div key={q} className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-1">
                                    <div className={`w-2 h-2 rounded-full ${q === 'Q1' ? 'bg-blue-500' : q === 'Q2' ? 'bg-emerald-500' : q === 'Q3' ? 'bg-amber-500' : 'bg-purple-500'
                                        }`} />
                                    <h4 className="font-bold text-sm tracking-tight">{q} Results</h4>
                                </div>
                                <div className="space-y-2">
                                    {milestonesByQuarter[q].length === 0 ? (
                                        <p className="text-[10px] text-muted-foreground italic">Sem entregas majoritárias.</p>
                                    ) : (
                                        milestonesByQuarter[q].map(m => (
                                            <div key={m.id} className="p-2 rounded bg-muted/30 border border-muted group hover:border-primary/50 transition-colors">
                                                <p className="text-[10px] font-bold text-primary mb-1">{m.key}</p>
                                                <p className="text-[11px] font-medium leading-tight line-clamp-2">{m.fields.summary}</p>
                                                <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                                                    <Clock size={8} /> {m.fields.resolutiondate ? new Date(m.fields.resolutiondate).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Performance por Categoria</CardTitle>
                        <CardDescription>Breakdown por Componente (incluindo subtasks)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {componentData.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic">Nenhum componente vinculado.</div>
                            ) : (
                                componentData.map(([name, stats]) => (
                                    <div key={name} className="flex items-center justify-between border-b pb-2 last:border-0">
                                        <div className="text-sm font-medium">{name}</div>
                                        <div className="flex space-x-2">
                                            {stats.done > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded-sm font-bold">{stats.done} Done</span>}
                                            {stats.wip > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded-sm font-bold">{stats.wip} WIP</span>}
                                            {stats.todo > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-sm font-bold">{stats.todo} ToDo</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Análise de Tasks Extras</CardTitle>
                        <CardDescription>Acompanhamento de Epics configurados nas Settings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {loadingExtra ? (
                                <div className="text-sm text-muted-foreground flex items-center gap-2">Carregando dados extras...</div>
                            ) : extraEpicsData.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic">Nenhuma task extra configurada ou encontrada.</div>
                            ) : (
                                extraEpicsData.map((e: any) => (
                                    <div key={e.key} className="flex flex-col space-y-1 border-b pb-2 last:border-0">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium truncate max-w-[200px]">{e.key}: {e.fields.summary}</div>
                                            <div className="text-xs font-bold text-emerald-600">{e.progress}%</div>
                                        </div>
                                        <Progress value={e.progress} className="h-1.5" />
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Status: {e.fields.status.name}</span>
                                            <span className="cursor-pointer hover:underline" onClick={() => {
                                                const baseUrl = localStorage.getItem("jira_url") || "";
                                                let url = baseUrl.trim();
                                                if (url && !url.startsWith('http')) url = `https://${url}`;
                                                url = url.replace(/\/$/, "");
                                                if (url) window.open(`${url}/browse/${e.key}`, '_blank');
                                            }}>Ver no Jira</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-1 lg:col-span-2">
                <CardHeader><CardTitle>Task Breakdown</CardTitle><CardDescription>Status and Sub-tasks</CardDescription></CardHeader>
                <CardContent><div className="space-y-4">{filteredChildren.map(task => <TaskRow key={task.id} task={task} />)}</div></CardContent>
            </Card>
        </div>
    )
}

function TaskRow({ task }: { task: JiraIssue }) {
    const [expanded, setExpanded] = useState(false)
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const selfSpent = (task.fields.timespent || 0) / 3600
    const selfEst = (task.fields.timeoriginalestimate || 0) / 3600

    return (
        <div className="border-b last:border-0 pb-2">
            <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center space-x-2 flex-grow">
                    {hasSubtasks ? <div className="text-muted-foreground">{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div> : <div className="w-4" />}
                    <div className="space-y-1 flex-grow"><div className="flex items-center gap-2"><p className="text-sm font-medium leading-none group-hover:text-primary group-hover:underline">{task.key}: {task.fields.summary}</p><span className="text-muted-foreground hover:text-blue-500" onClick={(e) => {
                        e.stopPropagation(); const baseUrl = localStorage.getItem("jira_url") || ""; let url = baseUrl.trim(); if (url && !url.startsWith('http')) url = `https://${url}`; url = url.replace(/\/$/, ""); if (url) window.open(`${url}/browse/${task.key}`, '_blank')
                    }}><ExternalLink size={12} /></span></div><p className="text-xs text-muted-foreground flex gap-4"><span>{task.fields.issuetype.name}</span>{(selfSpent > 0 || selfEst > 0) && (<span className={`flex items-center gap-1 ${selfSpent > selfEst && selfEst > 0 ? "text-red-500 font-semibold" : "text-emerald-600"}`}><Clock size={10} />{Math.round(selfSpent * 10) / 10}h / {Math.round(selfEst * 10) / 10}h</span>)}</p></div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-bold shrink-0 ${task.fields.status.statusCategory.key === 'done' ? 'bg-emerald-100 text-emerald-800' : task.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{task.fields.status.name}</div>
            </div>
            {expanded && hasSubtasks && (<div className="ml-8 mt-2 space-y-2 border-l-2 pl-4 border-muted">{task.subtasks!.map(sub => {
                const subSpent = (sub.fields.timespent || 0) / 3600; const subEst = (sub.fields.timeoriginalestimate || 0) / 3600
                return (<div key={sub.id} className="flex items-center justify-between p-1"><div className="flex items-center gap-2 flex-grow"><span className="text-xs text-muted-foreground">{sub.key}: {sub.fields.summary}</span><span className="cursor-pointer text-muted-foreground hover:text-blue-500" onClick={(e) => {
                    e.stopPropagation(); const baseUrl = localStorage.getItem("jira_url") || ""; let url = baseUrl.trim(); if (url && !url.startsWith('http')) url = `https://${url}`; url = url.replace(/\/$/, ""); if (url) window.open(`${url}/browse/${sub.key}`, '_blank')
                }}><ExternalLink size={10} /></span>{(subSpent > 0 || subEst > 0) && (<span className={`text-[10px] ml-2 ${subSpent > subEst && subEst > 0 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>({Math.round(subSpent * 10) / 10}h / {Math.round(subEst * 10) / 10}h)</span>)}</div><div className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${sub.fields.status.statusCategory.key === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>{sub.fields.status.name}</div></div>)
            })}</div>)}
        </div>
    )
}
