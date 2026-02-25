import { useEffect, useState, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JiraService } from "@/services/jira-client"
import { JiraIssue } from "@/types/jira"
// import { collection, addDoc, serverTimestamp } from "firebase/firestore"
// import { db } from "@/lib/firebase" // Ensure db is exported from your firebase config
// import { toast } from "sonner" // Sonner not installed
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { ChevronDown, ChevronRight, ExternalLink, Search, Clock, Sparkles, TrendingUp, Zap, Target, ListTodo, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useSettings } from "@/contexts/SettingsContext"


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
    const { settings, updateEpicAnalysisSettings } = useSettings()
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    // Priority: URL Param > Settings (Firestore) > LocalStorage
    const savedDefaultKey = settings?.epicAnalysis?.defaultEpicKey || localStorage.getItem("default_epic_key") || ""
    const initialKey = searchParams.get("key") || savedDefaultKey

    const [currentKey, setCurrentKey] = useState(initialKey.toUpperCase())
    const [searchKey, setSearchKey] = useState("")

    const [data, setData] = useState<{ epic: JiraIssue, children: JiraIssue[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedQuarter, setSelectedQuarter] = useState("ALL")
    const [selectedVersion, setSelectedVersion] = useState("ALL")
    const [extraEpicsData, setExtraEpicsData] = useState<any[]>([])
    const [missingCredentials, setMissingCredentials] = useState(false)

    // Check for missing Jira credentials on mount
    useEffect(() => {
        const jiraUrl = localStorage.getItem('jira_url')
        const jiraEmail = localStorage.getItem('jira_email')
        const jiraToken = localStorage.getItem('jira_token')

        if (!jiraUrl || !jiraEmail || !jiraToken) {
            console.warn('[EpicAnalysis] ⚠️ Missing Jira credentials')
            setMissingCredentials(true)
            setError('Configurações Jira não encontradas. Por favor, configure nas Settings ou aguarde o admin configurar.')
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (currentKey && currentKey.trim() !== "" && !missingCredentials) {
            loadEpic(currentKey)
        } else {
            // No epic key to load, stop loading immediately
            setLoading(false)
        }
    }, [currentKey, missingCredentials])

    const loadEpic = async (key: string, forceRefresh = false) => {
        setLoading(!data) // Only show loading text if we don't have data yet
        setError(null)
        try {
            const result = await JiraService.getEpicDetails(key, forceRefresh)
            if (result) {
                setData(result)
                // Persistence: Save to Firestore (Data)
                import('@/services/jira-persistence').then(({ JiraPersistenceService }) => {
                    JiraPersistenceService.saveEpicData(key, result)
                })

                // Persistence: Save as Preference (Settings)
                if (key !== settings?.epicAnalysis?.defaultEpicKey) {
                    updateEpicAnalysisSettings({ defaultEpicKey: key })
                }
            } else {
                // Fallback: Try loading from persistence if live fetch returns nothing/fails logic
                throw new Error("Epic not found in live search")
            }
        } catch (err: any) {
            console.warn("[EpicAnalysis] Live fetch failed, attempting persistence load...", err)

            try {
                const { JiraPersistenceService } = await import('@/services/jira-persistence')
                const cachedData = await JiraPersistenceService.loadEpicData(key)
                if (cachedData) {
                    setData(cachedData)
                    console.log("Modo Offline: Dados carregados do cache (Sincronização falhou)")
                    // Don't clear error entirely, possibly show it as a warning? 
                    // For now, let's clear it to show the dashboard, but maybe keep a small indicator.
                    setError(null)
                } else {
                    throw err // Re-throw original error if no cache
                }
            } catch (persistErr) {
                console.error("[EpicAnalysis] Final Error:", err)
                // Use the Service error message directly to show Auth/Network/Not Found errors
                const errorMessage = err?.message || "Failed to load epic details"
                setError(errorMessage)
            }
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


    const loadExtraEpics = async (keys: string[], forceRefresh = false) => {
        try {
            const results = await JiraService.getEpicsByKeys(keys, "ALL", forceRefresh)
            // Transform data to convert timespent from seconds to hours
            const transformedData = results.map(epic => ({
                ...epic,
                // Use aggregatetimespent (total including children) instead of timespent (often null for Epics)
                hoursSpent: Math.round((epic.fields.aggregatetimespent || epic.fields.timespent || 0) / 36) / 100
            }))
            setExtraEpicsData(transformedData)

            // Persistence: Save Extra Epics
            import('@/services/jira-persistence').then(({ JiraPersistenceService }) => {
                JiraPersistenceService.saveExtraEpicsData(transformedData)
            })

        } catch (err) {
            console.warn("[EpicAnalysis] Live extra epics fetch failed, attempting persistence...", err)
            try {
                const { JiraPersistenceService } = await import('@/services/jira-persistence')
                const cachedExtras = await JiraPersistenceService.loadExtraEpicsData()
                if (cachedExtras && cachedExtras.length > 0) {
                    setExtraEpicsData(cachedExtras)
                }
            } catch (persistErr) {
                console.error("[EpicAnalysis] Error loading extra epics:", err)
            }
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

    if (!currentKey || currentKey.trim() === "") {
        return (
            <div className="p-8 space-y-6 max-w-2xl mx-auto">
                <div className="text-center space-y-4">
                    <div className="inline-block p-4 bg-gradient-realestate-blue rounded-2xl shadow-lg">
                        <ListTodo className="h-12 w-12 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">Análise de Epic</h2>
                    <p className="text-slate-500 dark:text-slate-400">Digite o Key do Epic do Jira que deseja analisar</p>
                </div>
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Ex: ION-123, DEVOPS-456..."
                            className="pl-10 h-12 text-lg border-2 border-slate-200 focus-visible:ring-primary/20"
                            value={searchKey}
                            onChange={(e) => setSearchKey(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button type="submit" className="h-12 px-8 font-bold shadow-lg shadow-primary/20">
                        Analisar
                    </Button>
                </form>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="p-8 space-y-4">
                <h2 className="text-2xl font-bold text-red-500">Error Loading Epic</h2>
                <p>{error}</p>
                {missingCredentials && (
                    <div className="flex gap-2">
                        <Button
                            onClick={() => navigate('/settings')}
                            variant="default"
                            className="gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            Go to Settings
                        </Button>
                    </div>
                )}
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
                            {!missingCredentials && (
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
                            )}
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

    // 1. Overall Epic Progress (Weighted Average by Story Points)
    // "Total Major" includes ALL statuses except Cancelled
    const allMajorIssues = children.filter(c => !c.fields.issuetype.subtask && !c.fields.status.name.toLowerCase().includes("cancel"))

    const percentComplete = useMemo(() => {
        if (allMajorIssues.length === 0) return 0;

        let totalPoints = 0;
        let weightedProgress = 0;

        allMajorIssues.forEach(issue => {
            // Use Story Points (customfield_10016), default to weight 1 if missing
            const points = issue.fields.customfield_10016 || 1;

            // Progress field is calculated by the backend (includes 100% for Done items)
            const progress = issue.fields.progress || 0;

            totalPoints += points;
            weightedProgress += (progress * points);
        });

        return totalPoints > 0 ? Math.round(weightedProgress / totalPoints) : 0;
    }, [allMajorIssues]);

    // MAJOR METRICS (Lead for KPIs and Charts - Reacts to filters)
    const majorDone = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "done").length
    const majorInProgress = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "indeterminate").length
    const majorToDo = majorIssuesFiltered.filter(i => i.fields.status.statusCategory.key === "new").length
    const majorCancelled = allFilteredIssues.filter(i => i.fields.status.name.toLowerCase().includes("cancel") && !i.fields.issuetype.subtask).length

    // SUBTASK METRICS (Secondary details)
    // subDone, subInProgress, subToDo removed as they were not used in UI

    // METRICS (React to Filters)
    // We use filteredChildren to respect Quarter/Version filters
    // We also likely want to exclude Cancelled items from these "Achievement" counts

    // COUNTER METRICS - Use RAW children data (not filtered by version/quarter)
    // This ensures counters show the TOTAL count across the entire Epic
    const allActiveChildren = children.filter(c => !c.fields.status.name.toLowerCase().includes("cancel"))

    // Helper functions for classification
    const normalizeType = (c: JiraIssue) => (c.fields.issuetype.name || "").trim().toLowerCase()

    const isStory = (c: JiraIssue) => {
        const t = normalizeType(c)
        return ["story", "historia", "história", "user story"].some(k => t.includes(k))
    }

    const isBug = (c: JiraIssue) => {
        const t = normalizeType(c)
        return ["bug", "defect", "defeito", "falha"].some(k => t.includes(k))
    }

    const isBlock = (c: JiraIssue) => {
        const t = normalizeType(c)
        return ["block", "bloqueio", "impediment", "impedimento", "blocker"].some(k => t.includes(k))
    }

    // Major Counters (Direct Children) - Using ALL children to match total Jira visibility
    const globalStoryCount = children.filter(isStory).length
    const globalBugCount = children.filter(isBug).length
    const globalBlockCount = children.filter(isBlock).length

    // Task is a CATCH-ALL for direct children that aren't Stories, Bugs, or Blocks
    const globalTaskCount = children.filter(c => !isStory(c) && !isBug(c) && !isBlock(c)).length

    // Subtasks counter: Sum of ALL subtasks from ALL children (raw total)
    // This matches the user's JQL: "parent in (...) AND issuetype = Sub-task"
    const globalSubtaskCount = children.reduce((acc: number, c: JiraIssue) => {
        const subs = (c.fields?.subtasks || c.subtasks || [])
        return acc + subs.length
    }, 0)


    // DEBUG: Log counter breakdown
    console.log('[EpicAnalysis] 🔍 Counter Debug for Epic:', currentKey, {
        totalChildren: children.length,
        allActiveChildren: allActiveChildren.length,
        filteredChildren: filteredChildren.length,
        activeFilteredChildren: activeIssuesFiltered.length,
        issueTypesFound: Array.from(new Set(allActiveChildren.map(c => c.fields.issuetype.name))),
        counters: {
            stories: globalStoryCount,
            tasks: globalTaskCount,
            bugs: globalBugCount,
            blocks: globalBlockCount,
            subtasks: globalSubtaskCount
        },
        note: 'Counters now use RAW children data (not filtered by version/quarter)'
    })

    const chartData = [
        { name: 'Concluídos', value: majorDone, color: '#10B981' },
        { name: 'Em Andamento', value: majorInProgress, color: '#F59E0B' },
        { name: 'Novos', value: majorToDo, color: '#3B82F6' },
        { name: 'Canceladas', value: majorCancelled, color: '#EF4444' },
    ].filter(item => item.value > 0)

    // Time Tracking & Workload Variables
    let totalSpentSeconds = 0
    let totalEstimateSeconds = 0
    const workloadMap = new Map<string, number>()

    // Add Epic's own time to workload if available (optional, but good for completeness if Epic has time logged directly)
    if (epic.fields.timespent) {
        workloadMap.set("Epic: " + (epic.fields.components?.[0]?.name || "General"), epic.fields.timespent / 3600)
    }

    // Calculations moved after loop


    filteredChildren.forEach(child => {
        // Use AGGREGATE time from the child if available, which matches Jira's internal rollup.
        // Fallback to timespent + subtasks sum if aggregate is missing.
        let seconds: number = child.fields.aggregatetimespent ?? 0;
        const hasAggregate = child.fields.aggregatetimespent !== undefined && child.fields.aggregatetimespent !== null;

        if (!hasAggregate) {
            seconds = child.fields.timespent || 0
            if (child.subtasks) {
                child.subtasks.forEach(sub => { seconds += (sub.fields.timespent || 0) })
            }
        }

        // Sum to total
        totalSpentSeconds += seconds
        totalEstimateSeconds += (child.fields.aggregatetimeoriginalestimate || child.fields.timeoriginalestimate || 0)

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

    const totalSpentHours = Math.round(totalSpentSeconds / 3600)
    const totalEstimateHours = Math.round(totalEstimateSeconds / 3600)
    const timeProgress = totalEstimateHours > 0 ? Math.min(100, Math.round((totalSpentHours / totalEstimateHours) * 100)) : 0

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

    // --- SNAPSHOT LOGIC ---
    /*
    const statusDistribution = {
        done: majorDone,
        inProgress: majorInProgress,
        todo: majorToDo,
        cancelled: majorCancelled
    }
    */

    /*
    const handleManualSnapshot = async () => {
        try {
            await addDoc(collection(db, "epic_snapshots"), {
                epicKey: currentKey,
                timestamp: serverTimestamp(),
                version: "2.1-manual",
                counters: {
                    stories: globalStoryCount,
                    tasks: globalTaskCount,
                    bugs: globalBugCount,
                    blocks: globalBlockCount,
                    subtasks: globalSubtaskCount
                },
                timeTracking: {
                    spentSeconds: totalSpentSeconds,
                    estimateSeconds: totalEstimateSeconds,
                    spentHours: totalSpentHours,
                    estimateHours: totalEstimateHours
                },
                distribution: statusDistribution
            })
            // toast.success("Snapshot salvo com sucesso!")
        } catch (e) {
            console.error(e)
            // toast.error("Erro ao salvar snapshot")
        }
    }
    */

    // Auto-save effect (optional/commented out for now)
    /*
    useEffect(() => {
        if (!epic || loading || !allActiveChildren.length) return
        // saveSnapshot() logic here if we want auto-save
    }, [epic, allActiveChildren.length, totalSpentSeconds])
    */

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-baseline justify-between gap-4 mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#FF4200] rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Target size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-[#001540] dark:text-white tracking-tighter uppercase leading-none">
                            {epic.key}: <span className="text-[#FF4200]">{epic.fields.summary}</span>
                        </h2>
                        <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Análise Detalhada de Iniciativa</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Analisar outro Epic..."
                                value={searchKey}
                                onChange={e => setSearchKey(e.target.value)}
                                className="pl-9 w-[220px] h-10 rounded-xl border-slate-200"
                            />
                        </div>
                        <Button type="submit" size="sm" className="bg-[#001540] hover:bg-[#001540]/90 text-white rounded-xl px-4 font-bold">TROCAR</Button>
                    </form>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                    <select className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider px-3 py-1 outline-none" value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                        <option value="ALL">TODAS AS VERSÕES</option>
                        {allVersions.map(v => <option key={v} value={v}>{v}</option>)}
                        <option value="Unscheduled">SEM VERSÃO</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                    <select className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider px-3 py-1 outline-none" value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}>
                        <option value="ALL">TODOS OS PERÍODOS</option>
                        <option value="Q1">Q1 (JAN-MAR)</option>
                        <option value="Q2">Q2 (ABR-JUN)</option>
                        <option value="Q3">Q3 (JUL-SET)</option>
                        <option value="Q4">Q4 (OUT-DEZ)</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
                {/* 1. ITENS TOTAIS */}
                <div className="bg-[#001540] p-6 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-slate-200/50">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Itens Totais</p>
                        <ListTodo size={16} className="text-white/30" />
                    </div>
                    <div className="flex items-baseline gap-1">
                        <h2 className="text-5xl font-black leading-none">{children.length + globalSubtaskCount}</h2>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 mt-3 uppercase tracking-wider">Ativos no Jira</p>
                </div>

                {/* 2. HISTÓRIAS */}
                <div className="bg-[#001540] p-6 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-slate-200/50 relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <TrendingUp size={64} />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Histórias</p>
                        <Sparkles size={16} className="text-[#FF4200]" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-black leading-none">{globalStoryCount}</h2>
                        <span className="text-lg font-black text-white/60">/{globalStoryCount + globalTaskCount}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                        <div className="h-full bg-[#FF4200] transition-all duration-1000" style={{ width: `${Math.round((globalStoryCount / (globalStoryCount + globalTaskCount || 1)) * 100)}%` }} />
                    </div>
                </div>

                {/* 3. TICKETS & SUBS */}
                <div className="bg-[#F8FAFC] dark:bg-slate-900 p-6 rounded-[32px] text-[#001540] dark:text-white flex flex-col justify-between border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-100/50 group">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tickets & Subs</p>
                        <Zap size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black leading-none">{globalSubtaskCount}</h2>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wider">Subtarefas Técnicas</p>
                </div>

                {/* 4. ESFORÇO CONSUMIDO */}
                <div className="bg-[#10B981] p-6 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-emerald-200/50 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Esforço Consumido</p>
                        <Clock size={16} className="text-white/40" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-4xl font-black leading-none">{totalSpentHours}h</h2>
                        <p className="text-[10px] font-bold text-white/50 mt-1 uppercase">De {totalEstimateHours}h Est.</p>
                    </div>
                    <div className="w-full h-1.5 bg-white/20 rounded-full mt-4 overflow-hidden relative z-10">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${timeProgress}%` }} />
                    </div>
                </div>

                {/* 5. SAÚDE DA INICIATIVA */}
                <div className="bg-[#8B5CF6] p-6 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-purple-200/50 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Saúde da Iniciativa</p>
                        <TrendingUp size={16} className="text-white/40" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-5xl font-black leading-none">94%</h2>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 mt-3 uppercase tracking-wider">On-Track</p>
                </div>

                {/* 6. PROGRESSO GERAL (ORANGE) */}
                <div className="bg-[#FF4200] p-6 rounded-[32px] text-white flex flex-col justify-between shadow-xl shadow-orange-200/50 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Progresso Geral</p>
                        <Target size={16} className="text-white/40" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-6xl font-black leading-none">{percentComplete}%</h2>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full mt-4 overflow-hidden relative z-10">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${percentComplete}%` }} />
                    </div>
                </div>
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

            <Card className="shadow-none border-none bg-white dark:bg-slate-900 border-t-4 border-[#FF4200] overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Clock className="w-5 h-5 text-[#FF4200]" /> Painel de Esforço (Time Tracking)
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
                                <span className={`text-sm font-black ${timeProgress > 90 ? 'text-rose-500' : 'text-[#FF4200]'}`}>{timeProgress}%</span>
                            </div>
                        </div>
                        <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full transition-all duration-1000 ${timeProgress > 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-[#FF4200] to-[#E63B00]'}`}
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

            <Card className="shadow-none border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                        <ListTodo className="w-5 h-5 text-[#FF4200]" /> Detalhamento de Atividades
                    </CardTitle>
                    <CardDescription className="text-slate-400 font-medium">Lista completa de Stories, Tasks e Subtasks vinculadas</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        {filteredChildren.map(task => <TaskRow key={task.id} task={task} />)}
                    </div>
                </CardContent>
            </Card>
        </div >
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/30 group-hover:text-[#FF4200] transition-all">
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
                                className="text-slate-300 hover:text-[#FF4200] transition-colors p-1"
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
                                        <span className="text-[10px] font-black text-slate-300 group-hover/sub:text-orange-400">{sub.key}</span>
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
                                            className="text-slate-300 hover:text-[#FF4200] transition-colors p-1"
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
