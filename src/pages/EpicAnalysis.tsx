import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ExternalLink, Search, Clock, Sparkles, TrendingUp, Zap, Target, ListTodo } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"


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

const HorizontalTubularBar = (props: any) => {
    const { fill, x, y, width, height, index } = props;
    if (width <= 0 || !width) return null;

    // Width is the length of the bar (horizontal)
    // Height is the thickness of the bar (vertical)

    const sideWidth = height * 0.25; // The "depth" look on the right side
    const gradientId = `barGradientH-${index}`;

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
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={darken(fill, 40)} />
                    <stop offset="25%" stopColor={fill} />
                    <stop offset="45%" stopColor={darken(fill, -25)} />
                    <stop offset="65%" stopColor={fill} />
                    <stop offset="100%" stopColor={darken(fill, 50)} />
                </linearGradient>
            </defs>

            {/* Main Body */}
            <path
                d={`M ${x + sideWidth / 2},${y} 
                   L ${x + width - sideWidth / 2},${y} 
                   A ${sideWidth / 2},${height / 2} 0 0 1 ${x + width - sideWidth / 2},${y + height} 
                   L ${x + sideWidth / 2},${y + height} 
                   A ${sideWidth / 2},${height / 2} 0 0 0 ${x + sideWidth / 2},${y} Z`}
                fill={`url(#${gradientId})`}
            />

            {/* End Cap (Right) */}
            <ellipse
                cx={x + width - sideWidth / 2}
                cy={y + height / 2}
                rx={sideWidth / 2}
                ry={height / 2}
                fill={fill}
                stroke={darken(fill, 10)}
                strokeWidth={0.5}
            />
            {/* Start Cap (Left) - drawn implicitly or can be explicit if we want "solid" look, 
                but usually hidden by the "back" of the 3D object unless rotated. 
                Let's draw a darker ellipse at the start to simulate depth. */}
            <ellipse
                cx={x + sideWidth / 2}
                cy={y + height / 2}
                rx={sideWidth / 2}
                ry={height / 2}
                fill={darken(fill, 30)}
                stroke={darken(fill, 40)}
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
    const [leaderNote, setLeaderNote] = useState("")
    const [clevelNote, setClevelNote] = useState("")
    const [savingNotes, setSavingNotes] = useState(false)

    useEffect(() => {
        loadEpic(currentKey)
    }, [currentKey])

    const loadEpic = async (key: string, forceRefresh = false) => {
        setLoading(!data) // Only show loading text if we don't have data yet
        setError(null)
        try {
            const result = await JiraService.getEpicDetails(key, forceRefresh)
            if (result) {
                setData(result)
                // Load notes from Firestore
                const docRef = doc(db, "epic_notes", key)
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                    setLeaderNote(docSnap.data().leaderNote || "")
                    setClevelNote(docSnap.data().clevelNote || "")
                } else {
                    setLeaderNote("")
                    setClevelNote("")
                }
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

    const saveNotes = async () => {
        setSavingNotes(true)
        try {
            await setDoc(doc(db, "epic_notes", currentKey), {
                leaderNote,
                clevelNote,
                updatedAt: new Date().toISOString()
            }, { merge: true })
        } catch (err) {
            console.error("Error saving notes:", err)
            alert("Erro ao salvar notas.")
        }
        setSavingNotes(false)
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


    const loadExtraEpics = async (keys: string[], forceRefresh = false) => {
        try {
            const results = await JiraService.getEpicsByKeys(keys, "ALL", forceRefresh)
            // Transform data to convert timespent from seconds to hours
            const transformedData = results.map(epic => ({
                ...epic,
                hoursSpent: Math.round((epic.fields.timespent || 0) / 36) / 100 // Convert to hours with 2 decimals
            }))
            setExtraEpicsData(transformedData)
        } catch (err) {
            console.error("[EpicAnalysis] Error loading extra epics:", err)
        }
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                        <form onSubmit={handleSearch} className="flex gap-2 w-full md:max-w-md">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Jira Epic Key (ex: ION-123)"
                                    className="pl-9 h-10 border-slate-200 focus-visible:ring-primary/20"
                                    value={searchKey}
                                    onChange={(e) => setSearchKey(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="h-10 px-6 font-bold shadow-lg shadow-primary/20">Analisar</Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 gap-2 border-slate-200"
                                onClick={() => {
                                    loadEpic(currentKey, true)
                                    const extraKeysStr = localStorage.getItem("extra_epics") || ""
                                    if (extraKeysStr) {
                                        const keys = extraKeysStr.split(",").map(k => k.trim()).filter(k => k.length > 0)
                                        if (keys.length > 0) loadExtraEpics(keys, true)
                                    }
                                }}
                                disabled={loading}
                            >
                                <TrendingUp className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                                Sync
                            </Button>
                        </form>
                    </div>
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
    // subDone, subInProgress, subToDo removed as they were not used in UI

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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                <Card className="col-span-2 shadow-realestate border-none bg-white dark:bg-slate-900 border-l-4 border-realestate-primary-500 overflow-hidden">
                    <CardContent className="pt-6 relative">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alcance do Epic</span>
                            <Target className="h-4 w-4 text-realestate-primary-500" />
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative h-24 w-24">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[{ value: percentComplete }, { value: 100 - percentComplete }]}
                                            cx="50%" cy="50%"
                                            innerRadius={35}
                                            outerRadius={45}
                                            startAngle={90} endAngle={-270}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill="#3b82f6" /><Cell fill="#e2e8f0" className="dark:fill-slate-800" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <span className="text-xl font-black text-slate-800 dark:text-white">{percentComplete}%</span>
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-2xl font-black text-slate-800 dark:text-white">Progresso Geral</p>
                                <p className="text-xs text-slate-400 font-medium">Baseado em {allMajorIssues.length} itens majoritários</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <StatCard
                    title="Entregues"
                    value={majorDone}
                    icon={Zap}
                    gradient="green"
                    trend={{ value: Math.round((majorDone / (majorIssuesFiltered.length || 1)) * 100), isPositive: true }}
                />
                <StatCard
                    title="Em Andamento"
                    value={majorInProgress}
                    icon={TrendingUp}
                    gradient="blue"
                />
                <StatCard
                    title="Pendentes"
                    value={majorToDo}
                    icon={Clock}
                    gradient="orange"
                />
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

            <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 border-t-4 border-realestate-primary-500 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Clock className="w-5 h-5 text-realestate-primary-500" /> Painel de Esforço (Time Tracking)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Esforço Consumido</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">{totalSpentHours}h</span>
                                    <span className="text-xs text-slate-400 font-medium">de {totalEstimateHours}h estimadas</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-sm font-black ${timeProgress > 90 ? 'text-rose-500' : 'text-realestate-primary-500'}`}>{timeProgress}%</span>
                            </div>
                        </div>
                        <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full transition-all duration-1000 ${timeProgress > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-realestate-primary-500 to-realestate-primary-600'}`}
                                style={{ width: `${Math.min(100, timeProgress)}%` }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="pb-0"><CardTitle className="text-lg font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Distribuição de Status</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%" cy="50%"
                                        innerRadius={70}
                                        outerRadius={95}
                                        paddingAngle={5}
                                        stroke="none"
                                        dataKey="value"
                                        label={({ value }) => `${value}`}
                                    >
                                        {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                            padding: '12px'
                                        }}
                                    />
                                    <Legend iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="pb-0"><CardTitle className="text-lg font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Distribuição de Horas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={workloadData}
                                        cx="50%" cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        stroke="none"
                                        dataKey="hours"
                                        label={({ name, hours }) => `${name.slice(0, 10)}: ${hours}h`}
                                    >
                                        {workloadData.map((_, i) => <Cell key={i} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'][i % 6]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Tarefas Concluídas por Trimestre ({displayYear})</CardTitle></CardHeader>
                <CardContent><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={quarterlyData} margin={{ top: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="quarter" /><YAxis allowDecimals={false} /><Tooltip cursor={{ fill: 'transparent' }} /><Bar dataKey="count" shape={<TubularBar />} barSize={40}>{quarterlyData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent>
            </Card>

            <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Principais Entregas (Milestones - {displayYear})
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-medium font-inter">Stories e Tasks concluídas agrupadas por trimestre</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid gap-8 md:grid-cols-4">
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                            <div key={q} className="space-y-4">
                                <div className="flex items-center gap-2 border-b-2 border-slate-50 dark:border-slate-800 pb-2">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${q === 'Q1' ? 'bg-blue-500' :
                                        q === 'Q2' ? 'bg-emerald-500' :
                                            q === 'Q3' ? 'bg-amber-500' :
                                                'bg-purple-500'
                                        }`} />
                                    <h4 className="font-black text-xs text-slate-500 uppercase tracking-widest">{q} RESULTS</h4>
                                </div>
                                <div className="space-y-3">
                                    {milestonesByQuarter[q].length === 0 ? (
                                        <p className="text-[10px] text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Sem entregas majoritárias.</p>
                                    ) : (
                                        milestonesByQuarter[q].map(m => (
                                            <div key={m.id} className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 group hover:border-realestate-primary-500 hover:shadow-realestate transition-all duration-200">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[9px] font-black text-realestate-primary-500 bg-realestate-primary-50 dark:bg-realestate-primary-900/30 px-1.5 py-0.5 rounded uppercase">{m.key}</span>
                                                    <span className="text-[9px] text-slate-400 flex items-center gap-1"><Clock size={8} /> {m.fields.resolutiondate ? new Date(m.fields.resolutiondate).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight line-clamp-2 italic">{m.fields.summary}</p>
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
                <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                    <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                        <CardTitle className="text-lg font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Performance por Categoria</CardTitle>
                        <CardDescription className="text-slate-400 font-medium">Breakdown por Componente (incluindo subtasks)</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            {componentData.length === 0 ? (
                                <div className="text-sm text-slate-400 italic bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed text-center">Nenhum componente vinculado.</div>
                            ) : (
                                componentData.map(([name, stats]) => (
                                    <div key={name} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stats.done + stats.wip + stats.todo} Itens totais</span>
                                        </div>
                                        <div className="flex space-x-2">
                                            {stats.done > 0 && <Badge className="text-[9px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-none font-black">{stats.done} DONE</Badge>}
                                            {stats.wip > 0 && <Badge className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-none font-black">{stats.wip} WIP</Badge>}
                                            {stats.todo > 0 && <Badge className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-none font-black">{stats.todo} TODO</Badge>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Análise de Effort (Horas)</CardTitle>
                        <CardDescription>Comparativo de esforço entre Epics Extras</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            {extraEpicsData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={extraEpicsData}
                                        layout="vertical"
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="key" type="category" width={80} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            formatter={(value: number) => [`${value}h`, 'Horas Gastas']}
                                            labelFormatter={(label) => `Epic: ${label}`}
                                        />
                                        <Bar dataKey="hoursSpent" name="Horas" shape={<HorizontalTubularBar />} barSize={20}>
                                            {extraEpicsData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][index % 5]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    Sem dados para exibir.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Leader Note</CardTitle>
                        <CardDescription>Anotações do Líder Técnico</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Insira suas observações técnicas aqui..."
                            className="min-h-[150px] resize-none"
                            value={leaderNote}
                            onChange={(e) => setLeaderNote(e.target.value)}
                        />
                        <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                                {savingNotes ? "Salvando..." : "Salvar Nota"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">C-Level Note</CardTitle>
                        <CardDescription>Visão Executiva e Estratégica</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Insira observações para diretoria/executivos..."
                            className="min-h-[150px] resize-none"
                            value={clevelNote}
                            onChange={(e) => setClevelNote(e.target.value)}
                        />
                        <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                                {savingNotes ? "Salvando..." : "Salvar Nota"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                        <ListTodo className="w-5 h-5 text-realestate-primary-500" /> Detalhamento de Atividades
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-medium">Lista completa de Stories, Tasks e Subtasks vinculadas</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        {filteredChildren.map(task => <TaskRow key={task.id} task={task} />)}
                    </div>
                </CardContent>
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
        <div className="border-none rounded-xl bg-slate-50/50 dark:bg-white/5 overflow-hidden mb-3 last:mb-0 transition-all duration-200">
            <div
                className="flex items-center justify-between p-4 cursor-pointer group hover:bg-white dark:hover:bg-slate-800 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center space-x-3 flex-grow">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:bg-realestate-primary-50 dark:group-hover:bg-realestate-primary-900/30 group-hover:text-realestate-primary-500 transition-all">
                        {hasSubtasks ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <ListTodo size={14} />}
                    </div>
                    <div className="space-y-1 flex-grow">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded uppercase tracking-wider">{task.key}</span>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-realestate-primary-600 transition-colors">{task.fields.summary}</p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const baseUrl = localStorage.getItem("jira_url") || "";
                                    let url = baseUrl.trim();
                                    if (url && !url.startsWith('http')) url = `https://${url}`;
                                    url = url.replace(/\/$/, "");
                                    if (url) window.open(`${url}/browse/${task.key}`, '_blank')
                                }}
                                className="text-slate-300 hover:text-realestate-primary-500 transition-colors p-1"
                            >
                                <ExternalLink size={12} />
                            </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[9px] font-black h-4 px-1 border-slate-200">{task.fields.issuetype.name}</Badge></span>
                            {(selfSpent > 0 || selfEst > 0) && (
                                <span className={`flex items-center gap-1.5 ${selfSpent > selfEst && selfEst > 0 ? "text-rose-500 font-black" : "text-emerald-500 font-bold"}`}>
                                    <Clock size={12} />
                                    {Math.round(selfSpent * 10) / 10}h / {Math.round(selfEst * 10) / 10}h
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] font-black uppercase tracking-wider border-none px-2 py-1
                        ${task.fields.status.statusCategory.key === 'done' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            task.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {task.fields.status.name}
                    </Badge>
                </div>
            </div>
            {expanded && hasSubtasks && (
                <div className="px-4 pb-4 animate-slide-down">
                    <div className="ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-3 mt-2">
                        {task.subtasks!.map(sub => {
                            const subSpent = (sub.fields.timespent || 0) / 3600;
                            const subEst = (sub.fields.timeoriginalestimate || 0) / 3600
                            return (
                                <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/50 transition-colors group/sub">
                                    <div className="flex items-center gap-3 flex-grow text-xs">
                                        <span className="text-[10px] font-black text-slate-300 group-hover/sub:text-realestate-primary-400">{sub.key}</span>
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">{sub.fields.summary}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const baseUrl = localStorage.getItem("jira_url") || "";
                                                let url = baseUrl.trim();
                                                if (url && !url.startsWith('http')) url = `https://${url}`;
                                                url = url.replace(/\/$/, "");
                                                if (url) window.open(`${url}/browse/${sub.key}`, '_blank')
                                            }}
                                            className="text-slate-300 hover:text-realestate-primary-500 transition-colors p-1"
                                        >
                                            <ExternalLink size={10} />
                                        </button>
                                        {(subSpent > 0 || subEst > 0) && (
                                            <span className={`flex items-center gap-1.5 ml-2 ${subSpent > subEst && subEst > 0 ? "text-rose-500 font-black" : "text-slate-400"}`}>
                                                <Clock size={10} />
                                                {Math.round(subSpent * 10) / 10}h / {Math.round(subEst * 10) / 10}h
                                            </span>
                                        )}
                                    </div>
                                    <Badge variant="outline" className={`text-[8px] font-black uppercase tracking-tighter h-5 border-none
                                        ${sub.fields.status.statusCategory.key === 'done' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-slate-50 text-slate-400 dark:bg-slate-800'}`}>
                                        {sub.fields.status.name}
                                    </Badge>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
