import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResponsiveContainer, XAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from "recharts"
import { JiraService } from "@/services/jira"
import { Target, Zap, Cpu, TrendingUp, BarChart3, Sparkles, PieChart as PieIcon, Hourglass, RefreshCw } from "lucide-react"

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

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function OkrTracking() {
    const [metrics, setMetrics] = useState<{
        cycleTime: any[],
        aiAdoption: any[],
        epicStats: { total: number, done: number, percent: number },
        investmentMix: any[]
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [projectKey, setProjectKey] = useState(localStorage.getItem("jira_project_key") || "ION")

    useEffect(() => {
        loadData(projectKey)
    }, [])

    const loadData = async (key: string) => {
        setLoading(true)
        setError(null)
        try {
            const data = await JiraService.getOkrMetrics(key)
            setMetrics(data)
        } catch (e: any) {
            console.error("Failed to load metrics", e)
            setError(e.message || "Falha na sincronização. Verifique o Proxy e as Credenciais.")
        } finally {
            setLoading(false)
        }
    }

    const handleProjectChange = (newKey: string) => {
        const up = newKey.toUpperCase()
        setProjectKey(up)
        localStorage.setItem("jira_project_key", up)
        loadData(up)
    }

    const cycleTimeData = metrics?.cycleTime || []
    const investmentMix = metrics?.investmentMix || []
    const epicStats = metrics?.epicStats || { total: 0, done: 0, percent: 0 }

    const totalDeliveries = cycleTimeData.reduce((acc, curr) => acc + curr.days, 0)
    const totalHours = cycleTimeData.reduce((acc, curr) => acc + curr.hours, 0)
    const avgMonthly = totalDeliveries / 12

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="font-bold text-slate-500 animate-pulse text-center px-4">Consolidando Visão Estratégica 2025...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-4">
                <Card className="max-w-md border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <Zap className="h-5 w-5" /> Erro na Sincronização
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                        <div className="bg-white p-3 rounded border border-red-100 text-xs text-slate-500 font-mono">
                            Verifique se o Project Key "{projectKey}" está correto e se você tem acesso.
                        </div>
                        <Button onClick={() => loadData(projectKey)} className="w-full bg-red-600 hover:bg-red-700">
                            Tentar Novamente
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6 md:space-y-8 p-1 md:p-2">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                        Executive OKR Center 2025
                    </h2>
                    <p className="text-muted-foreground font-medium mt-1 text-sm md:text-base">
                        Sincronizado com o projeto: <span className="font-bold text-primary">{projectKey}</span>
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Input
                            value={projectKey}
                            onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                            placeholder="Project Key..."
                            className="w-full md:w-32 bg-white"
                        />
                        <Button onClick={() => handleProjectChange(projectKey)} size="sm" className="shrink-0">
                            <Search className="h-4 w-4 mr-2" /> Sync
                        </Button>
                    </div>
                    <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-xl border">
                        <div className="px-4 py-1.5 bg-white dark:bg-slate-900 shadow-sm rounded-lg text-[10px] font-black border uppercase tracking-wider">
                            Ciclo Ativo
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Level KPIs */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                <Card className="border-none bg-primary text-white shadow-xl shadow-primary/20">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between opacity-80 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Total Entregue</span>
                            <Zap className="h-4 w-4" />
                        </div>
                        <div className="text-3xl font-black">{totalDeliveries}</div>
                        <div className="text-[10px] mt-1 font-medium italic">Histórias, Tasks e Defeitos</div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-slate-900 text-white shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between opacity-70 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Esforço Investido</span>
                            <Hourglass className="h-4 w-4" />
                        </div>
                        <div className="text-3xl font-black">{totalHours.toLocaleString()}h</div>
                        <div className="text-[10px] mt-1 font-medium italic">Equivalente a {Math.round(totalHours / 160)} Homens/Mês</div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-white shadow-xl border-l-4 border-l-emerald-500">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Aderência ao Roadmap</span>
                            <Target className="h-4 w-4" />
                        </div>
                        <div className="text-3xl font-black text-slate-800">{epicStats.percent}%</div>
                        <div className="text-[10px] mt-1 font-medium text-emerald-600">Projeção Q4 estável</div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-white shadow-xl border-l-4 border-l-indigo-500">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest">Fator de Velocidade</span>
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="text-3xl font-black text-slate-800">{Math.round(avgMonthly)}</div>
                        <div className="text-[10px] mt-1 font-medium text-slate-500 italic">Média de itens/mês</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Investment Mix - NEW STRATEGIC VIEW */}
                <Card className="lg:col-span-5 border-2 border-slate-100 shadow-lg">
                    <CardHeader className="pb-0">
                        <div className="flex items-center gap-2">
                            <PieIcon className="h-4 w-4 text-primary" />
                            <CardTitle className="text-lg">Mix de Investimento 2025</CardTitle>
                        </div>
                        <CardDescription>Onde o esforço da ION foi alocado estrategicamente</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={investmentMix}
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={8}
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeWidth={3}
                                        dataKey="value"
                                    >
                                        {investmentMix.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                        formatter={(value: any) => [`${value}% do Esforço`, 'Investimento']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-2 mt-2">
                            {investmentMix.map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">{item.name.split('/')[0]}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-800">{item.value}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Delivery Pulse with Hours - COMBINED VIEW */}
                <Card className="lg:col-span-7 border-2 border-slate-100 shadow-lg overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm border">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                </div>
                                <CardTitle className="text-sm md:text-lg">Pulso de Entrega & Esforço</CardTitle>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border">JAN - DEZ</div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8">
                        <div className="h-[280px] md:h-[340px] w-full">
                            <BarChart data={cycleTimeData} margin={{ top: 20, right: 10, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white border shadow-2xl p-4 rounded-xl border-slate-100">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 border-b pb-1">{data.month} 2025</p>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-bold text-indigo-600 flex items-center justify-between gap-4">
                                                            Itens: <span className="text-lg font-black">{data.days}</span>
                                                        </p>
                                                        <p className="text-sm font-bold text-slate-600 flex items-center justify-between gap-4">
                                                            Horas: <span className="text-lg font-black">{data.hours}h</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="days"
                                    shape={<TubularBar />}
                                    barSize={20}
                                />
                            </BarChart>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Strategic Footer / Predictive */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-slate-900 text-white border-0 shadow-2xl overflow-hidden relative">
                    <div className="absolute -right-4 -bottom-4 opacity-5">
                        <Sparkles size={160} />
                    </div>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Análise Preditiva de Impacto</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm leading-relaxed text-slate-300">
                                Com base no **Mix de Investimento** atual de 2025, a ION está destinando <span className="text-white font-bold">{investmentMix.find(m => m.name.includes("Inovação"))?.value || 0}%</span> da sua capacidade para novos produtos. Este patamar é considerado **Saudável** para escala.
                            </p>
                            <div className="flex items-center gap-4 border-t border-slate-800 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Estabilidade de Operação</span>
                                    <span className="text-emerald-400 font-black">94%</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-800 pl-4">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Risco de Burnout</span>
                                    <span className="text-amber-400 font-black">Baixo</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* AI & Automation Focus */}
                <Card className="border-2 border-indigo-100 bg-indigo-50/20 shadow-lg">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-indigo-600" />
                            <CardTitle className="text-lg font-bold text-slate-800 tracking-tight">Adoção de Inteligência Artificial</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-3 mb-4">
                            <div className="text-5xl font-black text-indigo-600 uppercase">
                                {totalDeliveries > 0
                                    ? ((metrics?.aiAdoption.find(a => a.name === 'AI Assisted')?.value || 0) / totalDeliveries * 100).toFixed(1)
                                    : "0.0"}%
                            </div>
                            <div className="text-xs font-bold text-slate-500 pb-2 uppercase tracking-tighter">Entregas assistidas por IA</div>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-[2000ms]"
                                style={{ width: `${((metrics?.aiAdoption.find(a => a.name === 'AI Assisted')?.value || 0) / totalDeliveries * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] mt-2 font-black text-indigo-700 uppercase tracking-widest">Métrica de Maturidade Tecnológica 2025</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

