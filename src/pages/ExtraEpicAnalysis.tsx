import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { JiraService } from "@/services/jira"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { TrendingUp, Layers } from "lucide-react"

// Custom 3D-like Cylinder shape for BarChart
const CylinderBar = (props: any) => {
    const { fill, x, y, width, height } = props;
    if (height === 0 || !height) return null;

    const radiusX = width / 2;
    const radiusY = 5; // Perspective depth

    return (
        <g>
            {/* Cylinder Bottom */}
            <ellipse cx={x + radiusX} cy={y + height} rx={radiusX} ry={radiusY} fill={fill} filter="brightness(0.7)" />
            {/* Cylinder Body */}
            <rect x={x} y={y} width={width} height={height} fill={fill} />
            {/* Cylinder Top */}
            <ellipse cx={x + radiusX} cy={y} rx={radiusX} ry={radiusY} fill={fill} filter="brightness(1.2)" />
        </g>
    );
};

export function ExtraEpicAnalysis() {
    const [extraKeys, setExtraKeys] = useState<string[]>([])
    const [allData, setAllData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [displayYear] = useState(new Date().getFullYear())

    useEffect(() => {
        const extraKeysStr = localStorage.getItem("extra_epics") || ""
        if (extraKeysStr) {
            const keys = extraKeysStr.split(",").map(k => k.trim()).filter(k => k.length > 0)
            setExtraKeys(keys)
            loadDetails(keys)
        } else {
            setLoading(false)
        }
    }, [])

    const loadDetails = async (keys: string[]) => {
        setLoading(true)
        try {
            const results = await JiraService.getBulkEpicDetails(keys)
            setAllData(results)
        } catch (err) {
            console.error("Error loading extra epic details:", err)
        }
        setLoading(false)
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Analizando Epics Extras...</div>
    if (extraKeys.length === 0) return <div className="p-8 text-center italic">Nenhum "Extra Epic" configurado nas Settings.</div>

    const getStatsForYear = (year: number) => {
        const stats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
        allData.forEach(res => {
            const issues = res.children.flatMap((c: any) => [c, ...(c.subtasks || [])])
            issues.forEach((issue: any) => {
                if (issue.fields.status.statusCategory.key === 'done') {
                    const dStr = issue.fields.resolutiondate || issue.fields.updated
                    if (dStr) {
                        const d = new Date(dStr)
                        if (d.getFullYear() === year) {
                            const m = d.getMonth()
                            if (m <= 2) stats.Q1++
                            else if (m <= 5) stats.Q2++
                            else if (m <= 8) stats.Q3++
                            else stats.Q4++
                        }
                    }
                }
            })
        })
        return stats
    }

    const quarterlyData = [
        { quarter: 'Q1', count: getStatsForYear(displayYear).Q1, color: '#3B82F6' },
        { quarter: 'Q2', count: getStatsForYear(displayYear).Q2, color: '#10B981' },
        { quarter: 'Q3', count: getStatsForYear(displayYear).Q3, color: '#F59E0B' },
        { quarter: 'Q4', count: getStatsForYear(displayYear).Q4, color: '#8B5CF6' },
    ]

    const totalItems = allData.reduce((acc, res) => acc + res.children.length, 0)
    const totalDone = allData.reduce((acc, res) => {
        const doneInChild = res.children.filter((c: any) => c.fields.status.statusCategory.key === 'done').length
        return acc + doneInChild
    }, 0)
    const globalProgress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Layers className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Extra Epics Analysis</h2>
                        <p className="text-muted-foreground">Consolidado de iniciativas complementares</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold text-muted-foreground uppercase block">Progresso Médio</span>
                    <span className="text-3xl font-black text-indigo-600">{globalProgress}%</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-2 border-indigo-50 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-indigo-500" />
                            Vazão Trimestral (3D View) - {displayYear}
                        </CardTitle>
                        <CardDescription>Volume de entregas agregadas por trimestre</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={quarterlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                    <XAxis dataKey="quarter" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="count" shape={<CylinderBar />} barSize={50}>
                                        {quarterlyData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-indigo-50 shadow-lg">
                    <CardHeader>
                        <CardTitle>Status dos Epics Extras</CardTitle>
                        <CardDescription>Distribuição atual de status dos epics monitorados</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Done', value: allData.filter(d => d.epic.fields.status.statusCategory.key === 'done').length },
                                        { name: 'WIP', value: allData.filter(d => d.epic.fields.status.statusCategory.key === 'indeterminate').length },
                                        { name: 'To Do', value: allData.filter(d => d.epic.fields.status.statusCategory.key === 'new').length }
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#10B981" /><Cell fill="#F59E0B" /><Cell fill="#3B82F6" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allData.map(res => (
                    <Card key={res.epic.key} className="hover:shadow-md transition-shadow border-indigo-100">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{res.epic.key}</span>
                                <span className="text-lg font-black text-slate-800">{res.epic.progress}%</span>
                            </div>
                            <CardTitle className="text-sm mt-1 leading-tight line-clamp-2">{res.epic.fields.summary}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Progress value={res.epic.progress} className="h-1.5 mb-4" />
                            <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                                <div className="p-2 bg-slate-50 rounded">
                                    Done: <span className="text-emerald-600">{res.children.filter((c: any) => c.fields.status.statusCategory.key === 'done').length}</span>
                                </div>
                                <div className="p-2 bg-slate-50 rounded">
                                    Total: <span className="text-slate-800">{res.children.length}</span>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                className="w-full mt-4 text-[10px] font-bold text-indigo-600 border-t rounded-none py-1 h-auto"
                                onClick={() => window.location.href = `/epic-analysis?key=${res.epic.key}`}
                            >
                                ANALISE DETALHADA →
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
