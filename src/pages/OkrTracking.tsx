import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import { JiraService } from "@/services/jira"

export function OkrTracking() {
    const [metrics, setMetrics] = useState<{
        cycleTime: any[],
        aiAdoption: any[],
        epicStats: { total: number, done: number, percent: number }
    } | null>(null)

    useEffect(() => {
        const load = async () => {
            const data = await JiraService.getOkrMetrics()
            setMetrics(data)
        }
        load()
    }, [])

    const cycleTimeData = metrics?.cycleTime || []
    const aiAdoptionData = metrics?.aiAdoption || []
    const epicStats = metrics?.epicStats || { total: 0, done: 0, percent: 0 }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">OKR Tracking 2025</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Objetivo 1: Aumentar Entrega de Funcionalidades (2025)</CardTitle>
                        <CardDescription>Volume de tarefas finalizadas mês a mês ao longo de 2025</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={cycleTimeData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="days"
                                    name="Entregas"
                                    stroke="hsl(var(--primary))"
                                    fill="hsl(var(--primary))"
                                    fillOpacity={0.2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Objetivo 2: Conclusão de Epics Estratégicos</CardTitle>
                        <CardDescription>Status atual das iniciativas OKR prioritárias</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pt-8">
                        <div className="relative flex items-center justify-center">
                            <svg className="w-48 h-48 transform -rotate-90">
                                <circle
                                    cx="96"
                                    cy="96"
                                    r="80"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    className="text-secondary"
                                />
                                <circle
                                    cx="96"
                                    cy="96"
                                    r="80"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={502.6}
                                    strokeDashoffset={502.6 - (502.6 * epicStats.percent) / 100}
                                    className="text-primary transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className="text-4xl font-bold">{epicStats.percent}%</span>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Concluído</p>
                            </div>
                        </div>
                        <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Total Epics</p>
                                <p className="text-2xl font-bold">{epicStats.total}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Finalizados</p>
                                <p className="text-2xl font-bold text-emerald-500">{epicStats.done}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-background to-muted/50 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Esforço Realizado (2025)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{cycleTimeData.reduce((acc, curr) => acc + curr.days, 0)} Itens</div>
                        <p className="text-xs text-muted-foreground">Volume total de entregas no ano</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-primary w-full" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Objetivo 3: Adoção de IA</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {aiAdoptionData.find(a => a.name === 'AI Assisted')?.value || 0} Itens
                        </div>
                        <p className="text-xs text-muted-foreground">Uso de etiquetas 'ai-assisted'</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-indigo-500 w-[60%]" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Eficiência de Ciclo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">Alta</div>
                        <p className="text-xs text-muted-foreground">Baseado na vazão de 2025</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-emerald-500 w-[85%]" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
