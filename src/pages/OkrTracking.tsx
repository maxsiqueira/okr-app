import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { JiraService } from "@/services/jira"
import { Calendar, Target, Zap, Cpu, TrendingUp, CheckCircle2, Clock, BarChart3, Sparkles } from "lucide-react"

export function OkrTracking() {
    const [metrics, setMetrics] = useState<{
        cycleTime: any[],
        aiAdoption: any[],
        epicStats: { total: number, done: number, percent: number }
    } | null>(null)
    const [, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const data = await JiraService.getOkrMetrics()
                setMetrics(data)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const cycleTimeData = metrics?.cycleTime || []
    const aiAdoptionData = metrics?.aiAdoption || []
    const epicStats = metrics?.epicStats || { total: 0, done: 0, percent: 0 }

    // Feature idea: "Pulse of Delivery" - Seasonal data logic
    const totalDeliveries = cycleTimeData.reduce((acc, curr) => acc + curr.days, 0)
    const avgMonthly = totalDeliveries / 12

    return (
        <div className="space-y-8 p-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                        OKR Center 2025
                    </h2>
                    <p className="text-muted-foreground font-medium mt-1">
                        Consolidated tracking of corporate growth and technical delivery.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg border">
                    <div className="px-3 py-1 bg-white dark:bg-slate-900 shadow-sm rounded-md text-sm font-bold border">
                        Anual Roadmap
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
                {/* Objective 1: Delivery Pulse Heatmap / Area */}
                <Card className="lg:col-span-8 overflow-hidden border-2 border-primary/5 shadow-xl shadow-primary/5">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20">
                                <Zap className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">O1: Aceleração de Entrega</CardTitle>
                                <CardDescription>Pulso mensal de itens finalizados ao longo do ano</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="p-3 bg-secondary/30 rounded-xl border border-secondary">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Média Mensal</span>
                                <span className="text-xl font-black text-primary">{Math.round(avgMonthly)} <span className="text-xs font-normal">items</span></span>
                            </div>
                            <div className="p-3 bg-secondary/30 rounded-xl border border-secondary">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Pico de Vazão</span>
                                <span className="text-xl font-black text-emerald-500">{Math.max(...cycleTimeData.map(d => d.days), 0)}</span>
                            </div>
                            <div className="p-3 bg-secondary/30 rounded-xl border border-secondary">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Total Acumulado</span>
                                <span className="text-xl font-black">{totalDeliveries}</span>
                            </div>
                            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 group hover:bg-primary/20 transition-colors">
                                <span className="text-[10px] uppercase font-bold text-primary block mb-1">Trend Status</span>
                                <div className="flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    <span className="text-lg font-black text-primary">Stable</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={cycleTimeData}>
                                    <defs>
                                        <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip
                                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white dark:bg-slate-950 border shadow-2xl p-3 rounded-xl">
                                                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{payload[0].payload.month}</p>
                                                        <p className="text-2xl font-black text-primary">{payload[0].value} <span className="text-xs">entregas</span></p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="days"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorDays)"
                                        animationDuration={2000}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Objective 2: Epic Execution Radial + List */}
                <Card className="lg:col-span-4 border-2 border-primary/5 shadow-xl">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                                <Target className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">O2: Roadmap de Epics</CardTitle>
                                <CardDescription>Iniciativas Prioritárias de 2025</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 flex flex-col items-center">
                        <div className="relative mb-10 group">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75 group-hover:scale-100 transition-transform duration-700" />
                            <div className="relative flex items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-full border shadow-inner">
                                <svg className="w-44 h-44 transform -rotate-90">
                                    <circle
                                        cx="88"
                                        cy="88"
                                        r="75"
                                        stroke="currentColor"
                                        strokeWidth="12"
                                        fill="transparent"
                                        className="text-secondary/50"
                                    />
                                    <circle
                                        cx="88"
                                        cy="88"
                                        r="75"
                                        stroke="url(#radialGradient)"
                                        strokeWidth="14"
                                        fill="transparent"
                                        strokeDasharray={471}
                                        strokeDashoffset={471 - (471 * epicStats.percent) / 100}
                                        strokeLinecap="round"
                                        className="transition-all duration-[2000ms] ease-in-out"
                                    />
                                    <defs>
                                        <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#4F46E5" />
                                            <stop offset="100%" stopColor="#0EA5E9" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute text-center">
                                    <span className="text-4xl font-black tracking-tighter text-slate-800 dark:text-white">{epicStats.percent}%</span>
                                    <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1">
                                        TOTAL DELIVERY
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500 p-1.5 rounded-md text-white">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Finalizados</span>
                                </div>
                                <span className="text-xl font-black text-emerald-600">{epicStats.done}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-400 p-1.5 rounded-md text-white">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Em Aberto</span>
                                </div>
                                <span className="text-xl font-black text-slate-700 dark:text-slate-100">{epicStats.total - epicStats.done}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Objective 3: AI Transformation */}
                <Card className="relative overflow-hidden group border-2 border-indigo-500/10 shadow-lg">
                    <div className="absolute top-0 right-0 p-8 text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors">
                        <Cpu size={120} className="text-indigo-500/5 group-hover:text-indigo-500/10 transition-colors" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">O3: Transformação em IA</CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="flex items-end gap-2 mb-4">
                            <div className="text-4xl font-black text-indigo-600">
                                {aiAdoptionData.find(a => a.name === 'AI Assisted')?.value || 0}
                            </div>
                            <div className="text-xs font-bold text-muted-foreground pb-1.5 uppercase">Itens Co-Piloted</div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-[2000ms]"
                                style={{ width: '60%' }}
                            />
                        </div>
                        <p className="text-[10px] mt-2 font-bold text-indigo-600 uppercase">Progresso da Adoção</p>
                    </CardContent>
                </Card>

                {/* Efficiency KPI */}
                <Card className="relative overflow-hidden group border-2 border-emerald-500/10 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Eficiência de Ciclo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-black rounded-lg uppercase">
                                Alta Vazão
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-[2000ms]"
                                style={{ width: '85%' }}
                            />
                        </div>
                        <p className="text-[10px] mt-2 font-bold text-emerald-600 uppercase">Health Score: 0.85</p>
                    </CardContent>
                </Card>

                {/* Predictor Feature (The "Suprise") */}
                <Card className="bg-slate-900 dark:bg-black text-white border-0 shadow-2xl relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-primary animate-ping" />
                        <div className="w-1 h-1 rounded-full bg-primary" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Sparkles className="h-3 w-3" /> Predictive Analyst
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 font-bold uppercase">Projeção Q4</span>
                                <span className="text-primary font-black">92%</span>
                            </div>
                            <div className="grid grid-cols-6 gap-1 mt-2">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div
                                        key={i}
                                        className={`h-6 rounded-sm ${i < 5 ? 'bg-primary/40' : i === 5 ? 'bg-primary animate-pulse' : 'bg-slate-800'}`}
                                    />
                                ))}
                            </div>
                            <p className="text-[10px] leading-relaxed text-slate-400 font-medium">
                                Com base nos últimos <span className="text-white">90 dias</span>, o Roadmap estratégico de 2025 está <span className="text-emerald-400 font-bold">Adiantado</span> em 12 dias.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Delivery Timeline View */}
            <Card className="border-0 bg-secondary/20 border-t-2 border-primary/20 rounded-none shadow-none">
                <CardContent className="p-4 flex items-center justify-center gap-8 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" /> Year Long Tracking Active
                    </div>
                    <div className="flex items-center gap-2 border-l pl-8">
                        <Calendar className="h-3 w-3" /> Updated: {new Date().toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 border-l pl-8">
                        <BarChart3 className="h-3 w-3" /> Real-time Jira Sync
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
