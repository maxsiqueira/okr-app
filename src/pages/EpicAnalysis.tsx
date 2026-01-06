import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ExternalLink, Search, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export function EpicAnalysis() {
    const [searchParams, setSearchParams] = useSearchParams()
    const initialKey = searchParams.get("key") || "DEVOPS-633"

    const [currentKey, setCurrentKey] = useState(initialKey.toUpperCase())
    const [searchKey, setSearchKey] = useState("")

    const [data, setData] = useState<{ epic: JiraIssue, children: JiraIssue[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedQuarter, setSelectedQuarter] = useState("ALL")
    const [selectedVersion, setSelectedVersion] = useState("ALL")

    useEffect(() => {
        loadEpic(currentKey)
    }, [currentKey])

    const loadEpic = async (key: string) => {
        setLoading(true)
        setError(null)
        try {
            // If it's the mock text, simple fetch. If real, it will try real first.
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchKey.trim()) {
            const upperKey = searchKey.trim().toUpperCase()
            setCurrentKey(upperKey)
            setSearchParams({ key: upperKey })
        }
    }

    if (loading) return <div className="p-8">Loading analysis for {currentKey}...</div>

    // If error or no data, show search and error
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

    // Filter Logic
    const filteredChildren = children.filter(child => {
        if (selectedQuarter === "ALL") return true

        const createdDate = new Date(child.fields.created)
        // If resolved, use resolutiondate. If not, use Now.
        const endDate = child.fields.resolutiondate ? new Date(child.fields.resolutiondate) : new Date()

        const currentYear = new Date().getFullYear() // Assume current year for Q filtering as per request simplicity

        let qStartMonth = 0
        let qEndMonth = 11

        switch (selectedQuarter) {
            case "Q1": qStartMonth = 0; qEndMonth = 2; break;
            case "Q2": qStartMonth = 3; qEndMonth = 5; break;
            case "Q3": qStartMonth = 6; qEndMonth = 8; break;
            case "Q4": qStartMonth = 9; qEndMonth = 11; break;
        }

        const qStart = new Date(currentYear, qStartMonth, 1)
        const qEnd = new Date(currentYear, qEndMonth + 1, 0) // Last day of end month

        // Check overlap: Task Start <= QEnd AND Task End >= QStart
        const quarterMatch = createdDate <= qEnd && endDate >= qStart
        if (!quarterMatch) return false

        // Version Filter
        if (selectedVersion === "ALL") return true
        if (selectedVersion === "Unscheduled") return !child.fields.fixVersions || child.fields.fixVersions.length === 0
        return child.fields.fixVersions?.some(v => v.name === selectedVersion)
    })

    // Extract Versions for Filter
    const allVersions = Array.from(new Set(children.flatMap(c => c.fields.fixVersions?.map(v => v.name) || []))).sort()

    // UPDATE METRICS TO USE FILTERED LIST
    const doneCount = filteredChildren.filter(c => c.fields.status.statusCategory.key === "done").length
    const inProgressCount = filteredChildren.filter(c => c.fields.status.statusCategory.key === "indeterminate").length
    const toDoCount = filteredChildren.filter(c => c.fields.status.statusCategory.key === "new").length

    // Calculate cancelled
    const cancelledCount = filteredChildren.filter(c =>
        c.fields.status.name.toLowerCase().includes("cancel")
    ).length

    const chartData = [
        { name: 'Concluídos', value: doneCount, color: '#10B981' },
        { name: 'Em Andamento', value: inProgressCount, color: '#F59E0B' },
        { name: 'Novos', value: toDoCount, color: '#3B82F6' },
        { name: 'Canceladas', value: cancelledCount, color: '#EF4444' },
    ].filter(item => item.value > 0)

    const total = filteredChildren.length
    const percentComplete = total > 0 ? Math.round((doneCount / total) * 100) : 0

    // Time Tracking Calculations - CORRECT Jira Logic
    // Rule: If a task has subtasks, only count subtask time (not parent time)
    // This prevents double-counting when time is logged on both parent and subtasks
    let totalSpentSeconds = 0
    let totalEstimateSeconds = 0

    // 1. Include Epic's own time (if any worklogs are logged directly on the Epic)
    totalSpentSeconds += epic.fields.timespent || 0
    totalEstimateSeconds += epic.fields.timeoriginalestimate || 0

    // 2. Include child tasks (with correct aggregation)
    filteredChildren.forEach(child => {
        const hasSubtasks = child.subtasks && child.subtasks.length > 0

        if (hasSubtasks) {
            // If task has subtasks, ONLY count subtask time (Jira's rule)
            child.subtasks!.forEach(sub => {
                totalSpentSeconds += sub.fields.timespent || 0
                totalEstimateSeconds += sub.fields.timeoriginalestimate || 0
            })
        } else {
            // If no subtasks, count the parent task's time
            totalSpentSeconds += child.fields.timespent || 0
            totalEstimateSeconds += child.fields.timeoriginalestimate || 0
        }
    })

    const totalSpentHours = Math.round(totalSpentSeconds / 3600)
    const totalEstimateHours = Math.round(totalEstimateSeconds / 3600)
    const timeProgress = totalEstimateHours > 0 ? Math.min(100, Math.round((totalSpentHours / totalEstimateHours) * 100)) : 0

    // Workload from Filtered Data (Time Spent / Waste)
    const workloadMap = new Map<string, number>()
    filteredChildren.forEach(child => {
        // Own time
        let seconds = child.fields.timespent || 0
        // Subtasks time
        if (child.subtasks) {
            child.subtasks.forEach(sub => {
                seconds += (sub.fields.timespent || 0)
            })
        }

        const hours = seconds / 3600
        if (hours > 0) {
            // Group by component, or "General" if none
            const groups = child.fields.components?.length ? child.fields.components.map(c => c.name) : ["General"]

            // Split hours among groups if multiple
            const hoursPerGroup = hours / groups.length

            groups.forEach(group => {
                const current = workloadMap.get(group) || 0
                workloadMap.set(group, current + hoursPerGroup)
            })
        }
    })

    // Convert to chart data
    const realWorkloadData = Array.from(workloadMap.entries()).map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10 // 1 decimal
    })).sort((a, b) => b.hours - a.hours)

    // Fallback if no time tracking data found
    const workloadData = realWorkloadData.length > 0 ? realWorkloadData : [
        { name: 'Sem registros', hours: 0 }
    ]

    // Quarterly Completion Breakdown (Tasks Finished by Quarter)
    const currentYear = new Date().getFullYear()
    const quarterlyCompletion = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }

    filteredChildren.forEach(child => {
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

    const quarterlyData = [
        { quarter: 'Q1', count: quarterlyCompletion.Q1, color: '#3B82F6' },
        { quarter: 'Q2', count: quarterlyCompletion.Q2, color: '#10B981' },
        { quarter: 'Q3', count: quarterlyCompletion.Q3, color: '#F59E0B' },
        { quarter: 'Q4', count: quarterlyCompletion.Q4, color: '#8B5CF6' },
    ]

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

            {/* Top Metrics Row - Gauges and Status Cards */}
            <div className="flex justify-end mb-4 space-x-2">
                <select
                    className="p-2 border rounded bg-background text-foreground"
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                >
                    <option value="ALL">All Versions</option>
                    {allVersions.map(v => <option key={v} value={v}>{v}</option>)}
                    <option value="Unscheduled">Unscheduled</option>
                </select>
                <select
                    className="p-2 border rounded bg-background text-foreground"
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                >
                    <option value="ALL">All Periods</option>
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Apr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Sep)</option>
                    <option value="Q4">Q4 (Oct-Dec)</option>
                </select>
            </div>

            <div className="grid gap-4 md:grid-cols-6">
                {/* Circular Gauge */}
                <Card className="col-span-2">
                    <CardContent className="pt-6">
                        <div className="relative h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { value: percentComplete },
                                            { value: 100 - percentComplete }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        startAngle={90}
                                        endAngle={-270}
                                        dataKey="value"
                                    >
                                        <Cell fill="hsl(var(--primary))" />
                                        <Cell fill="hsl(var(--muted))" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-4xl font-bold text-primary">{percentComplete}%</span>
                            </div>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-sm font-medium">ATINGIMENTO</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Cards */}
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-emerald-600">{doneCount}</div>
                        <p className="text-xs font-medium mt-2 text-emerald-600">ENTREGUES</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-amber-500">{inProgressCount}</div>
                        <p className="text-xs font-medium mt-2 text-amber-500">WIP</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-blue-500">{toDoCount}</div>
                        <p className="text-xs font-medium mt-2 text-blue-500">NOVAS</p>
                    </CardContent>
                </Card>
                <Card className="col-span-1">
                    <CardContent className="pt-6 text-center">
                        <div className="text-3xl font-bold text-red-500">{cancelledCount}</div>
                        <p className="text-xs font-medium mt-2 text-red-500">CANCELADAS</p>
                    </CardContent>
                </Card>
            </div>

            {/* Time Tracking Summary Panel */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Summary Panel (Time Tracking)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Time</span>
                            <span>{totalSpentHours}h / {totalEstimateHours}h</span>
                        </div>
                        <Progress value={timeProgress} className="h-4" />
                        <p className="text-xs text-muted-foreground text-right">{timeProgress}% consumed</p>
                    </div>
                </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Task Distribution Pie */}
                <Card>
                    <CardHeader>
                        <CardTitle>Distribuição de Tarefas ({selectedQuarter})</CardTitle>
                        <CardDescription>Por status</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ value }) => `${value}`}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Workload Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Horas Gastas ({selectedQuarter})</CardTitle>
                        <CardDescription>Tempo registrado por área</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={workloadData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={true}
                                        label={({ name, hours }) => `${name}: ${hours}h`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="hours"
                                    >
                                        {workloadData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][index % 4]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quarterly Completion Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Tarefas Concluídas por Trimestre ({currentYear})</CardTitle>
                    <CardDescription>Quantidade de tarefas finalizadas em cada período</CardDescription>
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

            {/* Breakdown List */}
            <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                    <CardTitle>Task Breakdown</CardTitle>
                    <CardDescription>Status and Sub-tasks</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {filteredChildren.map(task => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function TaskRow({ task }: { task: JiraIssue }) {
    const [expanded, setExpanded] = useState(false)
    const hasSubtasks = task.subtasks && task.subtasks.length > 0

    // Task Own Time
    const selfSpent = (task.fields.timespent || 0) / 3600
    const selfEst = (task.fields.timeoriginalestimate || 0) / 3600

    return (
        <div className="border-b last:border-0 pb-2">
            <div
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center space-x-2 flex-grow">
                    {hasSubtasks ? (
                        <div className="text-muted-foreground">
                            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                    ) : (
                        <div className="w-4" /> // Spacer
                    )}
                    <div className="space-y-1 flex-grow">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none group-hover:text-primary group-hover:underline">
                                {task.key}: {task.fields.summary}
                            </p>
                            <span
                                className="text-muted-foreground hover:text-blue-500"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const baseUrl = localStorage.getItem("jira_url") || ""
                                    let url = baseUrl.trim()
                                    if (url && !url.startsWith('http')) url = `https://${url}`
                                    url = url.replace(/\/$/, "")
                                    if (url) window.open(`${url}/browse/${task.key}`, '_blank')
                                }}
                            >
                                <ExternalLink size={12} />
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex gap-4">
                            <span>{task.fields.issuetype.name}</span>
                            {/* Time Badge */}
                            {(selfSpent > 0 || selfEst > 0) && (
                                <span className={`flex items-center gap-1 ${selfSpent > selfEst && selfEst > 0 ? "text-red-500 font-semibold" : "text-emerald-600"}`}>
                                    <Clock size={10} />
                                    {Math.round(selfSpent * 10) / 10}h / {Math.round(selfEst * 10) / 10}h
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className={`px-2 py-1 rounded-full text-xs font-bold shrink-0
                    ${task.fields.status.statusCategory.key === 'done' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' :
                        task.fields.status.statusCategory.key === 'indeterminate' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
                    {task.fields.status.name}
                </div>
            </div>

            {/* Subtasks */}
            {expanded && hasSubtasks && (
                <div className="ml-8 mt-2 space-y-2 border-l-2 pl-4 border-muted">
                    {task.subtasks!.map(sub => {
                        const subSpent = (sub.fields.timespent || 0) / 3600
                        const subEst = (sub.fields.timeoriginalestimate || 0) / 3600

                        return (
                            <div key={sub.id} className="flex items-center justify-between p-1">
                                <div className="flex items-center gap-2 flex-grow">
                                    <span className="text-xs text-muted-foreground">{sub.key}: {sub.fields.summary}</span>
                                    <span
                                        className="cursor-pointer text-muted-foreground hover:text-blue-500"
                                        onClick={(e) => {
                                            e.stopPropagation() // Prevent row toggle
                                            const baseUrl = localStorage.getItem("jira_url") || ""
                                            let url = baseUrl.trim()
                                            if (url && !url.startsWith('http')) url = `https://${url}`
                                            url = url.replace(/\/$/, "")
                                            if (url) window.open(`${url}/browse/${sub.key}`, '_blank')
                                        }}
                                    >
                                        <ExternalLink size={10} />
                                    </span>
                                    {(subSpent > 0 || subEst > 0) && (
                                        <span className={`text-[10px] ml-2 ${subSpent > subEst && subEst > 0 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                                            ({Math.round(subSpent * 10) / 10}h / {Math.round(subEst * 10) / 10}h)
                                        </span>
                                    )}
                                </div>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0
                                    ${sub.fields.status.statusCategory.key === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {sub.fields.status.name}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
