import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts"
import { JiraService } from "@/services/jira"

export function OkrTracking() {
    const [metrics, setMetrics] = useState<{ cycleTime: any[], aiAdoption: any[] } | null>(null)

    useEffect(() => {
        const load = async () => {
            const data = await JiraService.getOkrMetrics()
            setMetrics(data)
        }
        load()
    }, [])

    // Default / Loading State
    const cycleTimeData = metrics?.cycleTime || []
    const aiAdoptionData = metrics?.aiAdoption || []

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">OKR Tracking</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Objective 1: Improve DevOps Throughput</CardTitle>
                        <CardDescription>Target: Increase monthly resolutions (Proxy for Cycle Time)</CardDescription>
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
                                <Area type="monotone" dataKey="days" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Objective 3: AI Adoption</CardTitle>
                        <CardDescription>Target: 80% with label 'ai-assisted'</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={aiAdoptionData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                <XAxis dataKey="name" className="text-xs" />
                                <YAxis className="text-xs" />
                                <Tooltip cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                />
                                <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} className="fill-primary" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Deploy Frequency</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12/day</div>
                        <p className="text-xs text-muted-foreground">+14% from last month</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-emerald-500 w-[80%]" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Change Failure Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0.8%</div>
                        <p className="text-xs text-muted-foreground">-0.2% improvement</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-emerald-500 w-[95%]" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">MTTR</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">14m</div>
                        <p className="text-xs text-muted-foreground">Mean Time To Recovery</p>
                        <div className="mt-4 h-[4px] w-full bg-secondary overflow-hidden rounded-full">
                            <div className="h-full bg-emerald-500 w-[60%]" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
