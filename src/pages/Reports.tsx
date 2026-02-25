import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileBarChart, Printer, Target, LayoutDashboard, BarChart3, ChevronRight, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StrategicReport } from "@/components/objectives/StrategicReport"
import { ExecutiveReport } from "@/components/objectives/ExecutiveReport"
import { collection, query, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { JiraService } from "@/services/jira-client"

export default function Reports() {
    const { t } = useTranslation()
    const [objectives, setObjectives] = useState<any[]>([])
    const [epicData, setEpicData] = useState<Record<string, any>>({})
    const [dashboardData, setDashboardData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showStrategicReport, setShowStrategicReport] = useState(false)
    const [showExecutiveReport, setShowExecutiveReport] = useState(false)

    useEffect(() => {
        const q = query(collection(db, "strategic_objectives"))
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const objs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
            setObjectives(objs)

            // Fetch progress for all related epics
            const allEpicKeys = Array.from(new Set(objs.flatMap(obj => obj.epicKeys || [])))
            if (allEpicKeys.length > 0) {
                const progressMap: Record<string, any> = {}
                const epics = await JiraService.getEpicsByKeys(allEpicKeys)
                epics.forEach(epic => {
                    progressMap[epic.key] = {
                        progress: epic.progress || 0,
                        hours: (epic as any).hours || 0
                    }
                })
                setEpicData(progressMap)
            }
            setLoading(false)
        })

        loadDashboardMetrics()

        return () => unsubscribe()
    }, [])

    const loadDashboardMetrics = async () => {
        const pk = localStorage.getItem("jira_project_key") || "ION"
        const epics = await JiraService.getEpics(pk)
        const activeEpics = epics.filter(e => !e.fields.status.name.toLowerCase().includes("cancel"))

        const totalInitiatives = activeEpics.length
        const totalProgress = activeEpics.reduce((acc, e) => acc + (e.progress ?? 0), 0)
        const avgProgress = totalInitiatives > 0 ? Math.round(totalProgress / totalInitiatives) : 0

        // Mocking quarterly for reports - using ION branding colors
        const qData = [
            { quarter: 'Q1', count: 12, color: '#001540' },
            { quarter: 'Q2', count: 18, color: '#FF4200' },
            { quarter: 'Q3', count: 15, color: '#10B981' },
            { quarter: 'Q4', count: 8, color: '#8B5CF6' },
        ]

        setDashboardData({
            totalInitiatives,
            avgProgress,
            q4Deliveries: 8,
            successRate: "92%",
            quarterlyData: qData
        })
    }

    const objectivesForCalc = objectives.filter(o => !o.excludeFromCalculation)
    const avgProgress = objectivesForCalc.length > 0
        ? Math.round(objectivesForCalc.reduce((acc, obj) => {
            const progSum = (obj.epicKeys || []).reduce((eAcc: number, eKey: string) => eAcc + (epicData[eKey]?.progress || 0), 0)
            const jiraProg = (obj.epicKeys || []).length > 0 ? (progSum / obj.epicKeys.length) : 0
            const actualProg = obj.suggestedProgress != null ? obj.suggestedProgress : jiraProg
            return acc + actualProg
        }, 0) / objectivesForCalc.length)
        : 0

    const reportCards = [
        {
            id: 'strategic',
            title: 'Apuração Estratégica (Macro)',
            description: 'Visão completa dos objetivos macro, iniciativas vinculadas e progresso apurado com KPIs ION.',
            icon: Target,
            color: 'text-[#FF4200]',
            bg: 'bg-orange-50 dark:bg-orange-950/20',
            action: () => setShowStrategicReport(true)
        },
        {
            id: 'dashboard',
            title: 'Resumo de Performance (Executivo)',
            description: 'Snapshot dos KPIs de performance, conclusão trimestral e visão geral de iniciativas.',
            icon: LayoutDashboard,
            color: 'text-[#001540] dark:text-blue-400',
            bg: 'bg-slate-50 dark:bg-slate-900/50',
            action: () => setShowExecutiveReport(true)
        },
        {
            id: 'okr',
            title: 'OKR Tracking 2025',
            description: 'Detalhamento por KR, confiança de entrega e status RAG de cada iniciativa estratégica.',
            icon: BarChart3,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-950/20',
            action: () => { }
        }
    ]

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4200]"></div>
        </div>
    )

    return (
        <div className="space-y-8 p-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#FF4200] rounded-2xl shadow-lg shadow-orange-100 dark:shadow-none">
                        <FileBarChart className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter text-[#001540] dark:text-white uppercase leading-none">
                            {t('sidebar.reports', 'Centro de Relatórios')}
                        </h2>
                        <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">{t('reports.subtitle', 'Visões Estratégicas e Consolidação de Resultados')}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportCards.map((report) => (
                    <Card key={report.id} className="group hover:shadow-2xl transition-all duration-500 border-none bg-white dark:bg-slate-900 overflow-hidden rounded-[32px] shadow-xl shadow-slate-100/50">
                        <CardHeader className={`${report.bg} border-b border-white/10 transition-colors pt-8 pb-8`}>
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ${report.color}`}>
                                    <report.icon size={28} />
                                </div>
                                <Sparkles className="text-white/40 group-hover:text-[#FF4200] transition-colors" size={24} />
                            </div>
                            <div className="mt-6">
                                <CardTitle className="text-xl font-black text-[#001540] dark:text-white group-hover:text-[#FF4200] transition-colors uppercase tracking-tight">{report.title}</CardTitle>
                                <CardDescription className="mt-2 font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{report.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 pb-8">
                            <Button
                                onClick={report.action}
                                className="w-full justify-between font-black bg-[#001540] hover:bg-[#001540]/90 text-white dark:bg-[#FF4200] dark:hover:bg-[#FF4200]/90 h-14 rounded-2xl px-6 group-hover:scale-[1.02] transition-transform"
                            >
                                GERAR RELATÓRIO <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Strategic Report Overlay */}
            {showStrategicReport && (
                <StrategicReport
                    objectives={objectives}
                    epicData={epicData}
                    avgProgress={avgProgress}
                    onClose={() => setShowStrategicReport(false)}
                />
            )}

            {/* Executive Report Overlay */}
            {showExecutiveReport && dashboardData && (
                <ExecutiveReport
                    data={dashboardData}
                    onClose={() => setShowExecutiveReport(false)}
                />
            )}

            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 text-center space-y-4 shadow-lg shadow-slate-100/20">
                <div className="mx-auto w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-[#FF4200] shadow-inner">
                    <Printer size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-[#001540] dark:text-white uppercase tracking-tight">Dica de Exportação</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 font-medium leading-relaxed">
                        Para melhor fidelidade, utilize a opção <strong>"Salvar como PDF"</strong>. Nossos relatórios foram otimizados para layouts de página A4 e apresentações executivas.
                    </p>
                </div>
            </div>
        </div>
    )
}
