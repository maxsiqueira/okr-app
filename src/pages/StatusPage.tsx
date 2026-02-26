import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusService } from "@/services/status-service"
import {
    Activity,
    CheckCircle2,
    XCircle,
    RefreshCcw,
    Clock,
    Database,
    Globe,
    Cloud,
    ShieldCheck
} from "lucide-react"

interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'loading';
    latency?: number;
    message?: string;
}

export function StatusPage() {
    const [status, setStatus] = useState<{
        firestore: HealthStatus,
        jira: HealthStatus,
        functions: HealthStatus,
        session: HealthStatus
    }>({
        firestore: { status: 'loading' },
        jira: { status: 'loading' },
        functions: { status: 'loading' },
        session: { status: 'loading' }
    })
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const checkAll = async () => {
        setRefreshing(true)
        const [firestore, jira, functions, session] = await Promise.all([
            StatusService.checkFirestore(),
            StatusService.checkJira(),
            StatusService.checkFunctions(),
            StatusService.checkSession()
        ])

        setStatus({
            firestore: firestore as HealthStatus,
            jira: jira as HealthStatus,
            functions: functions as HealthStatus,
            session: session as HealthStatus
        })
        setLastUpdated(new Date())
        setRefreshing(false)
    }

    useEffect(() => {
        checkAll()
    }, [])

    const StatusCard = ({ title, data, icon: Icon, color }: { title: string, data: HealthStatus, icon: any, color: string }) => (
        <Card className="shadow-lg border-none overflow-hidden transition-all hover:shadow-xl">
            <div className={`h-1.5 w-full ${data.status === 'healthy' ? 'bg-emerald-500' : data.status === 'unhealthy' ? 'bg-rose-500' : 'bg-slate-300 animate-pulse'}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</CardTitle>
                    <CardDescription className="text-xs font-bold">
                        {data.status === 'loading' ? 'Verificando...' : data.status === 'healthy' ? 'Sistema Operacional' : 'Interrupção Detectada'}
                    </CardDescription>
                </div>
                <div className={`p-2 rounded-xl bg-${color}-50 text-${color}-600`}>
                    <Icon size={20} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`font-black tracking-tighter ${data.status === 'healthy' ? 'bg-emerald-50 text-emerald-600 border-none' :
                            data.status === 'unhealthy' ? 'bg-rose-50 text-rose-600 border-none' :
                                'bg-slate-50 text-slate-400 border-none'
                            }`}>
                            {data.status === 'healthy' ? <CheckCircle2 size={12} className="mr-1" /> : data.status === 'unhealthy' ? <XCircle size={12} className="mr-1" /> : <RefreshCcw size={12} className="mr-1 animate-spin" />}
                            {data.status.toUpperCase()}
                        </Badge>
                        {data.latency !== undefined && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                <Clock size={10} />
                                {data.latency}ms
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-400 italic">
                        {data.message || 'Aguardando diagnóstico...'}
                    </div>
                </div>
            </CardContent>
        </Card>
    )

    return (
        <div className="space-y-8 p-6 lg:p-12 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Activity size={24} />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-[#001540] dark:text-white uppercase">System Status</h1>
                    </div>
                    <p className="text-slate-500 font-bold tracking-widest text-xs uppercase pl-1">Monitoramento de Infraestrutura em Tempo Real</p>
                </div>
                <div className="flex items-center gap-4">
                    {lastUpdated && (
                        <div className="text-right hidden md:block">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Último Check</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{lastUpdated.toLocaleTimeString()}</p>
                        </div>
                    )}
                    <Button
                        onClick={checkAll}
                        disabled={refreshing}
                        className="h-12 px-8 font-black rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <RefreshCcw size={18} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'ATUALIZANDO...' : 'RECARREGAR'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <StatusCard
                    title="Banco de Dados"
                    data={status.firestore}
                    icon={Database}
                    color="blue"
                />
                <StatusCard
                    title="Jira Integration"
                    data={status.jira}
                    icon={Globe}
                    color="orange"
                />
                <StatusCard
                    title="Cloud Functions"
                    data={status.functions}
                    icon={Cloud}
                    color="purple"
                />
            </div>

            <Card className="bg-gradient-to-br from-[#001540] to-[#002b80] text-white border-none rounded-[32px] overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldCheck size={120} />
                </div>
                <CardHeader>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Relatório de Sessão</CardTitle>
                    <CardDescription className="text-white/60 font-bold uppercase tracking-widest text-[10px]">Diagnóstico de Conectividade e Segurança</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Versão do App</p>
                            <p className="text-lg font-black">v2.1.0-STABLE</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Ambiente</p>
                            <p className="text-lg font-black uppercase">Production</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Criptografia</p>
                            <p className="text-lg font-black">TLS 1.3 / AES-256</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase text-white/40 mb-1">Segurança Proxy</p>
                            <p className="text-lg font-black text-emerald-400">HARDENED</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
