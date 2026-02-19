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

        // Mocking/Simplifying quarterly for reports
        const qData = [
            { quarter: 'Q1', count: 12, color: '#3B82F6' },
            { quarter: 'Q2', count: 18, color: '#10B981' },
            { quarter: 'Q3', count: 15, color: '#F59E0B' },
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
            title: 'Relatório de Objetivos Estratégicos',
            description: 'Visão completa dos objetivos macro, iniciativas vinculadas e progresso apurado.',
            icon: Target,
            color: 'text-emerald-500',
            bg: 'bg-emerald-50 dark:bg-emerald-950/20',
            action: () => setShowStrategicReport(true)
        },
        {
            id: 'dashboard',
            title: 'Resumo Executivo (Dashboard)',
            description: 'Snapshop dos KPIs de performance, conclusão trimestral e visão geral de iniciativas.',
            icon: LayoutDashboard,
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-950/20',
            action: () => setShowExecutiveReport(true)
        },
        {
            id: 'okr',
            title: 'Acompanhamento de OKRs 2025',
            description: 'Detalhamento por KR, confiança de entrega e status RAG de cada iniciativa.',
            icon: BarChart3,
            color: 'text-purple-500',
            bg: 'bg-purple-50 dark:bg-purple-950/20',
            action: () => { }
        }
    ]

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    )

    return (
        <div className="space-y-8 p-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                        <FileBarChart className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white uppercase">
                            {t('sidebar.reports', 'Centro de Relatórios')}
                        </h2>
                        <p className="text-slate-400 font-medium">{t('reports.subtitle', 'Selecione e gere visões estratégicas para impressão ou envio.')}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportCards.map((report) => (
                    <Card key={report.id} className="group hover:shadow-xl transition-all duration-300 border-slate-100 dark:border-slate-800 overflow-hidden">
                        <CardHeader className={`${report.bg} border-b border-slate-100 dark:border-slate-800 transition-colors`}>
                            <div className="flex justify-between items-start">
                                <div className={`p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm ${report.color}`}>
                                    <report.icon size={24} />
                                </div>
                                <Sparkles className="text-slate-200 dark:text-slate-800 group-hover:text-indigo-400 transition-colors" size={20} />
                            </div>
                            <div className="mt-4">
                                <CardTitle className="text-lg font-bold group-hover:text-indigo-600 transition-colors">{report.title}</CardTitle>
                                <CardDescription className="mt-2 line-clamp-2">{report.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Button
                                onClick={report.action}
                                className="w-full justify-between font-bold bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-xl"
                            >
                                Gerar Report <ChevronRight size={18} />
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

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                    <Printer size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Dica de Impressão</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                        Utilize a opção de <strong>Salvar como PDF</strong> no diálogo de impressão para enviar o relatório por e-mail com fidelidade visual.
                    </p>
                </div>
            </div>
        </div>
    )
}
