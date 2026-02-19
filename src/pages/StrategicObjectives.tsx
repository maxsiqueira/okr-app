import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Target, BarChart3, RefreshCw, Pencil, X, ExternalLink, ListTodo, TrendingUp, Zap, AlertTriangle, Users, Printer } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useTranslation } from "react-i18next"
import { StrategicReport } from "@/components/objectives/StrategicReport"
import { JiraService } from "@/services/jira-client"
import { db, auth } from "@/lib/firebase"
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore"
import { AiInsightsSection } from "@/components/analytics/AiInsightsSection"

export interface StrategicObjective {
    id: string
    title: string
    description: string
    epicKeys: string[] // List of epic keys associated with this objective
    teamIds?: string[] // Multiple teams
    teamId?: string // Legacy single team support
    suggestedProgress?: number | null // Manual override for progress
    excludeFromCalculation?: boolean // Flag to exclude from global KPI
}

export interface Team {
    id: string
    name: string
    color: string
}

const DEFAULT_TEAMS: Team[] = [
    { id: '1', name: 'Devops', color: '#4F46E5' },
    { id: '2', name: 'Infra', color: '#0891B2' },
    { id: '3', name: 'Comercial', color: '#EA580C' },
    { id: '4', name: 'RH', color: '#DB2777' },
    { id: '5', name: 'Adm', color: '#475569' },
    { id: '6', name: 'Desenvolvimento', color: '#2563EB' },
    { id: '7', name: 'Suporte', color: '#059669' },
    { id: '8', name: 'Implantação', color: '#7C3AED' },
    { id: '9', name: 'Projetos', color: '#9333EA' },
    { id: '10', name: 'Sucesso do Cliente', color: '#0284C7' }
]

export function StrategicObjectives() {
    const { t } = useTranslation()
    const [objectives, setObjectives] = useState<StrategicObjective[]>([])
    const [epicData, setEpicData] = useState<Record<string, { progress: number, hours: number, summary?: string, status?: string }>>({})
    const [rawJiraEpics, setRawJiraEpics] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newDesc, setNewDesc] = useState("")
    const [newEpics, setNewEpics] = useState("")
    const [newSuggestedProgress, setNewSuggestedProgress] = useState<string>("")
    const [includeInCalc, setIncludeInCalc] = useState<boolean>(true)
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
    const [showReport, setShowReport] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [showTeamManager, setShowTeamManager] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    useEffect(() => {
        // Firestore Real-time sync for Objectives
        const q = query(collection(db, "strategic_objectives"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items: StrategicObjective[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ ...doc.data() as StrategicObjective, id: doc.id });
            });
            setObjectives(items);
            fetchEpicProgress(items);
        }, (error) => {
            console.error("Error fetching strategic_objectives:", error);
            setErrorMsg(`Erro ao carregar Objetivos: ${error.message} (Code: ${error.code})`)
        });

        // Firestore Real-time sync for Teams
        const qTeams = query(collection(db, "strategic_teams"));
        const unsubscribeTeams = onSnapshot(qTeams, (querySnapshot) => {
            const items: Team[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ ...doc.data() as Team, id: doc.id });
            });
            if (items.length > 0) {
                setTeams(items);
            } else {
                setTeams(DEFAULT_TEAMS);
            }
        }, (error) => {
            console.error("Error fetching strategic_teams:", error);
            setErrorMsg(`Erro ao carregar Times: ${error.message} (Code: ${error.code})`)
            // Fallback to defaults on error
            setTeams(DEFAULT_TEAMS);
        });

        return () => {
            unsubscribe();
            unsubscribeTeams();
        };
    }, [])

    const fetchEpicProgress = async (currentObjectives: StrategicObjective[]) => {
        setLoading(true)
        try {
            // 1. Try Firestore shared cache first (2 min TTL)
            const cachedRef = doc(db, "epic_progress_cache", "current");
            const cachedDoc = await getDoc(cachedRef);

            if (cachedDoc.exists()) {
                const cached = cachedDoc.data();
                const age = Date.now() - cached.timestamp;

                // Use if less than 24 hours old (Persistence Strategy)
                if (age < 24 * 60 * 60 * 1000) {
                    console.log("[Epic Progress] Using Firestore cache (age:", Math.round(age / 1000), "s)");
                    setEpicData(cached.data);
                    setRawJiraEpics(cached.rawEpics || []);
                    setLoading(false);
                    return;
                }
            }

            // 2. Fetch fresh from Jira
            const allKeys = Array.from(new Set(currentObjectives.flatMap(o => o.epicKeys)))
            if (allKeys.length === 0) {
                setLoading(false)
                return
            }

            const epics = await JiraService.getEpicsByKeys(allKeys)
            setRawJiraEpics(epics)

            const progressMap: Record<string, { progress: number, hours: number, summary?: string, status?: string }> = {}
            epics.forEach((e: any) => {
                progressMap[e.key] = {
                    progress: e.progress || 0,
                    hours: e.totalHours || 0,
                    summary: e.fields.summary,
                    status: e.fields.status.name
                }
            })

            // 3. Save to Firestore for other users
            await setDoc(cachedRef, {
                data: progressMap,
                rawEpics: epics,
                timestamp: Date.now(),
                updatedBy: auth.currentUser?.email || 'unknown'
            });
            console.log("[Epic Progress] Fetched from Jira and cached");

            setEpicData(progressMap)
        } catch (error) {
            console.error("Failed to fetch epic progress", error)
        }
        setLoading(false)
    }


    // UNIFIED PROGRESS CALCULATION - Ensures all users see same percentages
    const getObjectiveProgress = (obj: StrategicObjective): number => {
        // Priority 1: Manual override (suggestedProgress)
        if (obj.suggestedProgress !== null && obj.suggestedProgress !== undefined) {
            return obj.suggestedProgress;
        }

        // Priority 2: Calculate from Jira epic progress
        if (obj.epicKeys.length === 0) return 0;

        const progSum = obj.epicKeys.reduce(
            (acc, key) => acc + (epicData[key]?.progress || 0),
            0
        );
        return Math.round(progSum / obj.epicKeys.length);
    };

    const saveObjectiveToFirestore = async (obj: StrategicObjective) => {
        try {
            await setDoc(doc(db, "strategic_objectives", obj.id), obj);
        } catch (e) {
            console.error("Error saving objective:", e);
        }
    }

    const handleAdd = async () => {
        if (!newTitle) return
        if (editingId) {
            const updated: StrategicObjective = {
                id: editingId,
                title: newTitle,
                description: newDesc,
                epicKeys: newEpics.split(",").map(s => s.trim()).filter(Boolean),
                teamIds: selectedTeamIds,
                suggestedProgress: newSuggestedProgress !== "" ? parseInt(newSuggestedProgress) : null,
                excludeFromCalculation: !includeInCalc
            };

            // Clean up null fields for Firestore
            if (updated.suggestedProgress === null) {
                delete (updated as any).suggestedProgress;
            }
            await saveObjectiveToFirestore(updated);
            setEditingId(null)
        } else {
            const newItem: StrategicObjective = {
                id: Date.now().toString(),
                title: newTitle,
                description: newDesc,
                epicKeys: newEpics.split(",").map(s => s.trim()).filter(Boolean),
                teamIds: selectedTeamIds,
                suggestedProgress: newSuggestedProgress !== "" ? parseInt(newSuggestedProgress) : null,
                excludeFromCalculation: !includeInCalc
            }

            // Clean up null fields for Firestore
            if (newItem.suggestedProgress === null) {
                delete (newItem as any).suggestedProgress;
            }
            await saveObjectiveToFirestore(newItem);
        }
        setNewTitle("")
        setNewDesc("")
        setNewEpics("")
        setNewSuggestedProgress("")
        setSelectedTeamIds([])
    }

    const startEditing = (obj: StrategicObjective) => {
        setEditingId(obj.id)
        setNewTitle(obj.title)
        setNewDesc(obj.description)
        setNewEpics(obj.epicKeys.join(", "))
        setNewSuggestedProgress(obj.suggestedProgress != null ? obj.suggestedProgress.toString() : "")
        setIncludeInCalc(!obj.excludeFromCalculation)
        // Handle migration from legacy teamId to teamIds
        setSelectedTeamIds(obj.teamIds || (obj.teamId ? [obj.teamId] : []))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setNewTitle("")
        setNewDesc("")
        setNewEpics("")
        setNewSuggestedProgress("")
        setSelectedTeamIds([])
    }

    const handleTeamAdd = async (name: string) => {
        if (!name) return
        const newTeam: Team = {
            id: Date.now().toString(),
            name,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
        }
        await setDoc(doc(db, "strategic_teams", newTeam.id), newTeam);
    }

    const handleTeamDelete = async (id: string) => {
        await deleteDoc(doc(db, "strategic_teams", id));
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este objetivo estratégico?")) return
        await deleteDoc(doc(db, "strategic_objectives", id));
    }

    // Consolidate metrics
    const totalMetas = objectives.length
    const objectivesForCalc = objectives.filter(o => !o.excludeFromCalculation)
    const avgProgress = objectivesForCalc.length > 0
        ? Math.round(objectivesForCalc.reduce((acc, obj) => {
            return acc + getObjectiveProgress(obj)
        }, 0) / objectivesForCalc.length)
        : 0

    const openJira = (key: string) => {
        const baseUrl = localStorage.getItem("jira_url") || "";
        let url = baseUrl.trim();
        if (url && !url.startsWith('http')) url = `https://${url}`;
        url = url.replace(/\/$/, "");
        if (url) window.open(`${url}/browse/${key}`, '_blank')
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-realestate-primary-500 rounded-2xl shadow-realestate-lg transform -rotate-3">
                        <Target className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white uppercase">{t('objectives.title', 'Objetivos Estratégicos')}</h2>
                        <p className="text-slate-400 font-medium">{t('objectives.subtitle', 'Gestão à Vista e Monitoramento de Iniciativas')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setShowReport(true)}
                        className="gap-2 font-bold uppercase tracking-wider text-xs border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 shadow-sm"
                    >
                        <Printer className="h-4 w-4" />
                        Relatório
                    </Button>
                    <Button variant="outline" onClick={() => fetchEpicProgress(objectives)} disabled={loading} className="gap-2 font-bold uppercase tracking-wider text-xs border-slate-200 shadow-sm hover:bg-slate-50">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar Jira
                    </Button>
                </div>
            </div>
        </div>
            {
        errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded-r shadow-sm">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700">
                            {errorMsg}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    {/* Strategic Report Overlay */ }
    {
        showReport && (
            <StrategicReport
                objectives={objectives}
                epicData={epicData}
                avgProgress={avgProgress}
                onClose={() => setShowReport(false)}
            />
        )
    }

    {/* KPI Board */ }
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
            title="Quantidade de Metas"
            value={totalMetas}
            icon={ListTodo}
            gradient="blue"
            className="h-32"
        />
        <StatCard
            title="Percentual Apurado (Metas Ativas)"
            value={`${avgProgress}%`}
            icon={Zap}
            gradient="purple"
            trend={{ value: avgProgress, isPositive: avgProgress > 50 }}
            className="h-32"
        />
    </div>

    {/* AI Analyst Integration */ }
            <AiInsightsSection
                epics={rawJiraEpics}
                strategicObjectives={objectives}
                manualOkrs={[]} // On this page we focus on Strategic
            />

            <Card className="shadow-realestate border-none bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800">
                    <CardTitle className="text-lg font-black flex items-center gap-2 text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                        <Target className="w-5 h-5 text-realestate-primary-500" /> Acompanhamento de Objetivos
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <TableRow>
                                <TableHead className="w-[400px] text-[10px] font-black uppercase tracking-widest py-4">Objetivo Estratégico (Macro)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Iniciativas Vinc. & Esforço</TableHead>
                                <TableHead className="w-[180px] text-right text-[10px] font-black uppercase tracking-widest py-4">Progresso Consolidado</TableHead>
                                <TableHead className="w-[100px] text-right text-[10px] font-black uppercase tracking-widest py-4">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {objectives.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                                        Nenhum macro-objetivo configurado para exibição.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                objectives.map(obj => {
                                    const totalProg = getObjectiveProgress(obj)
                                    const isManual = obj.suggestedProgress != null
                                    const totalHours = obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.hours || 0), 0)

                                    return (
                                        <TableRow key={obj.id} className={`transition-colors border-slate-100 ${editingId === obj.id ? 'bg-amber-50/50 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'}`}>
                                            <TableCell className="py-6">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="w-2 h-2 rounded-full bg-realestate-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] flex-shrink-0" />
                                                        <span className="font-black text-slate-800 dark:text-slate-100 text-lg leading-tight uppercase">{obj.title}</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(() => {
                                                                const teamIds = obj.teamIds || (obj.teamId ? [obj.teamId] : []);
                                                                if (teamIds.length === 0) return null;

                                                                return teamIds.map(tid => {
                                                                    const team = teams.find(t => t.id === tid);
                                                                    if (!team) return null;
                                                                    return (
                                                                        <Badge
                                                                            key={tid}
                                                                            className="text-[9px] font-black px-2 py-0.5 rounded-md text-white border-none shadow-sm"
                                                                            style={{ backgroundColor: team.color }}
                                                                        >
                                                                            {team.name.toUpperCase()}
                                                                        </Badge>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground leading-relaxed pl-4 border-l-2 border-slate-100 italic">
                                                        {obj.description || "Sem descrição estratégica definida."}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-2">
                                                    {obj.epicKeys.length > 0 ? obj.epicKeys.map(k => (
                                                        <div key={k} className="flex flex-col gap-0.5 group/epic">
                                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:border-realestate-primary-500/30">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-black text-slate-400 group-hover/epic:text-realestate-primary-500 transition-colors uppercase">{k}</span>
                                                                    <button
                                                                        onClick={() => openJira(k)}
                                                                        className="text-slate-300 hover:text-realestate-primary-500 transition-colors p-0.5"
                                                                        title="Ver no Jira"
                                                                    >
                                                                        <ExternalLink size={10} />
                                                                    </button>
                                                                </div>
                                                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">{epicData[k]?.progress ?? '?'}%</span>
                                                                <span className="text-[10px] font-bold text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">{Math.round(epicData[k]?.hours || 0)}h</span>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <span className="text-xs text-slate-400 italic">Nenhuma iniciativa vinculada</span>
                                                    )}
                                                    {totalHours > 0 && (
                                                        <div className="w-full mt-2">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                Esforço Total: <span className="text-slate-800 dark:text-slate-200 font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">{totalHours.toFixed(1)} Horas</span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-6">
                                                <div className="flex flex-col items-end gap-2">
                                                    {((obj.teamIds?.length || 0) > 1) && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100 dark:border-indigo-800 animate-pulse">
                                                            <Users size={10} />
                                                            <span className="text-[9px] font-black uppercase tracking-tighter">{t('objectives.okr_cross_alert', 'Considerar esforço - OKR Cross')}</span>
                                                        </div>
                                                    )}
                                                    {totalProg === 0 && !((obj.teamIds?.length || 0) > 1) && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md border border-amber-100 dark:border-amber-800 animate-pulse">
                                                            <AlertTriangle size={10} />
                                                            <span className="text-[9px] font-black uppercase tracking-tighter">{t('objectives.zero_progress_alert', 'Atenção: Progresso Zero')}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <BarChart3 className={`h-5 w-5 ${totalProg === 100 ? 'text-emerald-500' : 'text-primary'}`} />
                                                        <span className={`text-2xl font-black tracking-tight ${totalProg === 100 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                            {totalProg}%
                                                        </span>
                                                        {isManual && (
                                                            <Badge className="text-[8px] font-black bg-slate-100 text-slate-500 border-none px-1.5 py-0">{t('objectives.manual_progress_label', 'MANUAL')}</Badge>
                                                        )}
                                                        {obj.excludeFromCalculation && (
                                                            <Badge className="text-[8px] font-black bg-rose-100 text-rose-500 border-none px-1.5 py-0">{t('objectives.excluded_from_calc_label', 'DESCONSIDERADO')}</Badge>
                                                        )}
                                                    </div>
                                                    <div className="w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${totalProg === 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-primary'}`}
                                                            style={{ width: `${totalProg}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1 px-2">
                                                    <Button variant="ghost" size="sm" onClick={() => startEditing(obj)} className="text-slate-400 hover:text-realestate-primary-500 hover:bg-realestate-primary-50 transition-colors p-2 rounded-lg">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(obj.id)} className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors p-2 rounded-lg">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Card className={editingId ? "border-amber-200 bg-amber-50/30 shadow-lg" : "border-none bg-white dark:bg-slate-900 shadow-realestate overflow-hidden"}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0 border-b border-slate-50 dark:border-slate-800 mb-4">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        {editingId ? <Pencil className="h-4 w-4 text-amber-600" /> : <TrendingUp className="h-4 w-4 text-realestate-primary-500" />}
                        {editingId ? "Modificar Objetivo" : "Novo Macro-Objetivo Estratégico"}
                    </CardTitle>
                    {editingId && (
                        <Button variant="ghost" size="sm" onClick={cancelEditing} className="text-xs h-7 gap-1 uppercase font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-100">
                            <X className="h-3 w-3" /> Cancelar
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold">Título do Objetivo (Macro)</label>
                            <Input
                                value={newTitle}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
                                placeholder="Ex: Eficiência Operacional e Cloud"
                                className="bg-white"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase text-slate-400">Times Responsáveis</label>
                                <Button variant="ghost" size="sm" onClick={() => setShowTeamManager(true)} type="button" className="h-5 px-1 text-realestate-primary-500 hover:bg-realestate-primary-50">
                                    <Plus className="h-3 w-3" /> <span className="text-[10px] ml-1 font-black">GERENCIAR</span>
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 p-3 min-h-[42px] rounded-xl border border-slate-100 bg-slate-50/50">
                                {teams.map(t => {
                                    const isSelected = selectedTeamIds.includes(t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedTeamIds(prev =>
                                                    prev.includes(t.id)
                                                        ? prev.filter(id => id !== t.id)
                                                        : [...prev, t.id]
                                                )
                                            }}
                                            className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider transition-all border",
                                                isSelected
                                                    ? "text-white shadow-md scale-105"
                                                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                            )}
                                            style={isSelected ? { backgroundColor: t.color, borderColor: t.color } : {}}
                                        >
                                            {t.name.toUpperCase()}
                                        </button>
                                    )
                                })}
                                {teams.length === 0 && <span className="text-[10px] text-slate-400 italic">Nenhum time cadastrado</span>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-400 tracking-tight">Iniciativas Vinc. <span className="text-[10px] text-slate-300 ml-1">(Separe por vírgula)</span></label>
                            <Input
                                value={newEpics}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEpics(e.target.value)}
                                placeholder="DEVOPS-633, DEVOPS-970, ..."
                                className="bg-white rounded-xl border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-400">{t('objectives.suggested_progress', 'Progresso Sugerido (%)')}</label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={newSuggestedProgress}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSuggestedProgress(e.target.value)}
                                placeholder="Manual (%)"
                                className="bg-white rounded-xl border-slate-200"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <Checkbox
                            id="includeInCalc"
                            checked={includeInCalc}
                            onCheckedChange={(checked: boolean) => setIncludeInCalc(checked)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="includeInCalc"
                                className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                {t('objectives.include_in_calculation', 'Considerar no Cálculo Global')}
                            </label>
                            <p className="text-[10px] text-slate-500 font-medium">
                                {includeInCalc
                                    ? "Este objetivo será incluído na média de progresso do dashboard."
                                    : "Este objetivo ficará visível, mas não afetará a média global."}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold">Descrição do Impacto Estratégico</label>
                        <Textarea
                            value={newDesc}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDesc(e.target.value)}
                            placeholder="Qual o valor de negócio esperado?"
                            className="bg-white min-h-[80px]"
                        />
                    </div>
                    <Button onClick={handleAdd} className={`w-full md:w-auto font-black uppercase text-xs tracking-[0.2em] gap-2 py-6 px-8 rounded-xl shadow-realestate-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gradient-realestate-blue'}`}>
                        {editingId ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {editingId ? "Salvar Alterações" : "Cadastrar no Board"}
                    </Button>
                </CardContent>
            </Card>

    {/* Team Management Modal */ }
    {
        showTeamManager && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-2xl">
                    <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Gerenciar Times Responsáveis</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowTeamManager(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const input = form.elements.namedItem('teamName') as HTMLInputElement;
                                handleTeamAdd(input.value);
                                input.value = '';
                            }}
                        >
                            <Input name="teamName" placeholder="Nome do novo time..." className="bg-white" />
                            <Button type="submit" size="sm" className="font-bold">ADC</Button>
                        </form>
                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-2 border rounded bg-slate-50">
                            {teams.map(t => (
                                <div key={t.id} className="flex items-center gap-2 px-2 py-1 bg-white border rounded shadow-sm text-xs font-bold">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                                    <span>{t.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleTeamDelete(t.id)}
                                        className="ml-1 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            * Times deletados continuarão aparecendo em objetivos antigos até que sejam editados.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }
        </div >
    )
}
