import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Target, BarChart3, RefreshCw, Pencil, X, Sparkles } from "lucide-react"
import { JiraService } from "@/services/jira"
import { AiService } from "@/services/ai"
import { db } from "@/lib/firebase"
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore"

export interface StrategicObjective {
    id: string
    title: string
    description: string
    epicKeys: string[] // List of epic keys associated with this objective
    teamId?: string
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
    const [objectives, setObjectives] = useState<StrategicObjective[]>([])
    const [epicData, setEpicData] = useState<Record<string, { progress: number, hours: number, summary?: string, status?: string }>>({})
    const [rawJiraEpics, setRawJiraEpics] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newDesc, setNewDesc] = useState("")
    const [newEpics, setNewEpics] = useState("")
    const [newTeamId, setNewTeamId] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [teams, setTeams] = useState<Team[]>([])
    const [showTeamManager, setShowTeamManager] = useState(false)

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
        });

        return () => {
            unsubscribe();
            unsubscribeTeams();
        };
    }, [])

    const fetchEpicProgress = async (currentObjectives: StrategicObjective[]) => {
        setLoading(true)
        try {
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
            setEpicData(prev => ({ ...prev, ...progressMap }))
        } catch (error) {
            console.error("Failed to fetch epic progress", error)
        }
        setLoading(false)
    }

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
                teamId: newTeamId
            };
            await saveObjectiveToFirestore(updated);
            setEditingId(null)
        } else {
            const newItem: StrategicObjective = {
                id: Date.now().toString(),
                title: newTitle,
                description: newDesc,
                epicKeys: newEpics.split(",").map(s => s.trim()).filter(Boolean),
                teamId: newTeamId
            }
            await saveObjectiveToFirestore(newItem);
        }
        setNewTitle("")
        setNewDesc("")
        setNewEpics("")
        setNewTeamId("")
    }

    const startEditing = (obj: StrategicObjective) => {
        setEditingId(obj.id)
        setNewTitle(obj.title)
        setNewDesc(obj.description)
        setNewEpics(obj.epicKeys.join(", "))
        setNewTeamId(obj.teamId || "")
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEditing = () => {
        setEditingId(null)
        setNewTitle("")
        setNewDesc("")
        setNewEpics("")
        setNewTeamId("")
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

    return (
        <div className="space-y-6 p-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Objetivos Estratégicos - Gestão a Vista</h2>
                        <p className="text-muted-foreground">
                            Monitoramento em tempo real do atingimento de metas cruzando Epics/Tasks do Jira.
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => fetchEpicProgress(objectives)} disabled={loading} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Sincronizar Jira
                </Button>
            </div>

            {/* AI Analyst Integration */}
            <AiInsightsSection
                epics={rawJiraEpics}
                strategicObjectives={objectives}
                manualOkrs={[]} // On this page we focus on Strategic
            />

            <Card className={editingId ? "border-amber-200 bg-amber-50/30" : "border-primary/20 bg-primary/5"}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        {editingId ? <Pencil className="h-4 w-4 text-amber-600" /> : <Plus className="h-4 w-4" />}
                        {editingId ? "Editando Objetivo" : "Novo Macro-Objetivo"}
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
                        <div className="space-y-2">
                            <label className="text-xs font-bold">Time Responsável</label>
                            <div className="flex gap-2">
                                <select
                                    value={newTeamId}
                                    onChange={(e) => setNewTeamId(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">Selecione um Time</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                <Button variant="outline" size="sm" onClick={() => setShowTeamManager(true)} type="button">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold">Iniciativas Vinc. (Epics ou Tasks)</label>
                            <Input
                                value={newEpics}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEpics(e.target.value)}
                                placeholder="Ex: DEVOPS-633, DEVOPS-970"
                                className="bg-white"
                            />
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
                    <Button onClick={handleAdd} className={`w-full md:w-auto font-bold uppercase text-xs tracking-widest gap-2 ${editingId ? 'bg-amber-600 hover:bg-amber-700' : ''}`}>
                        {editingId ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {editingId ? "Salvar Alterações" : "Cadastrar no Board"}
                    </Button>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                        <TableRow>
                            <TableHead className="w-[400px]">Objetivo Estratégico (Macro)</TableHead>
                            <TableHead>Iniciativas & Horas Gastas</TableHead>
                            <TableHead className="w-[180px] text-right">Progresso Consolidado</TableHead>
                            <TableHead className="w-[80px] text-right">Ações</TableHead>
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
                                const progSum = obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.progress || 0), 0)
                                const totalProg = obj.epicKeys.length > 0 ? Math.round(progSum / obj.epicKeys.length) : 0
                                const totalHours = obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.hours || 0), 0)

                                return (
                                    <TableRow key={obj.id} className={`transition-colors border-slate-100 ${editingId === obj.id ? 'bg-amber-50/50 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'}`}>
                                        <TableCell className="py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                                    <span className="font-black text-slate-800 text-lg leading-tight">{obj.title}</span>
                                                    {(() => {
                                                        const team = teams.find(t => t.id === obj.teamId);
                                                        if (!team) return null;
                                                        return (
                                                            <span
                                                                className="text-[10px] font-bold px-2 py-0.5 rounded text-white ml-2"
                                                                style={{ backgroundColor: team.color }}
                                                            >
                                                                {team.name.toUpperCase()}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed pl-4 border-l-2 border-slate-100 italic">
                                                    {obj.description || "Sem descrição estratégica definida."}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {obj.epicKeys.length > 0 ? obj.epicKeys.map(k => (
                                                    <div key={k} className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-700">{k}</span>
                                                            <span className="text-[10px] font-bold text-blue-600 border-l pl-1.5 ml-1.5">{epicData[k]?.progress ?? '?'}%</span>
                                                            <span className="text-[10px] font-medium text-slate-400 border-l pl-1.5 ml-1.5">{Math.round(epicData[k]?.hours || 0)}h</span>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <span className="text-xs text-muted-foreground italic">Nenhuma iniciativa vinculada</span>
                                                )}
                                                {totalHours > 0 && (
                                                    <div className="w-full mt-2">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Esforço Total: <span className="text-slate-800">{totalHours.toFixed(1)} Horas</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-6">
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex items-center gap-2">
                                                    <BarChart3 className={`h-5 w-5 ${totalProg === 100 ? 'text-emerald-500' : 'text-primary'}`} />
                                                    <span className={`text-2xl font-black tracking-tight ${totalProg === 100 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                        {totalProg}%
                                                    </span>
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
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => startEditing(obj)} className="text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(obj.id)} className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors">
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
            {/* Team Management Modal */}
            {showTeamManager && (
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
            )}
        </div>
    )
}

function AiInsightsSection({ epics, strategicObjectives, manualOkrs }: { epics: any[], strategicObjectives: any[], manualOkrs: any[] }) {
    const [insight, setInsight] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        const result = await AiService.generateInsights({
            epics,
            strategicObjectives,
            manualOkrs
        })
        setInsight(result)
        setLoading(false)
    }

    return (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900 border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <Sparkles className="h-5 w-5" /> AI Strategic Analyst
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Análise de impacto cruzando iniciativas Jira e objetivos da diretoria.
                    </p>
                </div>
                {!insight && (
                    <Button onClick={handleGenerate} disabled={loading || (epics.length === 0 && strategicObjectives.length === 0)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                        {loading ? "Calculando..." : "Gerar Análise Estratégica"}
                    </Button>
                )}
            </CardHeader>
            {insight && (
                <CardContent className="pt-2">
                    <div className="prose dark:prose-invert text-sm max-w-none bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-indigo-100/50">
                        {insight.split('\n').map((line, i) => {
                            if (!line.trim()) return <div key={i} className="h-2" />

                            const parts = line.split(/(\*\*.*?\*\*)/g)
                            const content = parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j}>{part.slice(2, -2)}</strong>
                                }
                                return part
                            })

                            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                                return <p key={i} className="pl-4 mb-1 flex items-start gap-2"><span>•</span><span>{content}</span></p>
                            }

                            if (line.match(/^\d\./)) {
                                return <p key={i} className="font-bold text-base mt-4 mb-2 text-indigo-800 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900 pb-1">{content}</p>
                            }

                            return <p key={i} className="mb-2 leading-relaxed">{content}</p>
                        })}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                if (insight) {
                                    setLoading(true);
                                    await AiService.saveAnalysisResult(insight);
                                    setLoading(false);
                                    alert("Análise salva com sucesso!");
                                }
                            }}
                            disabled={loading}
                            className="text-[10px] uppercase font-bold tracking-wider gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                            Salvar no Histórico
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setInsight(null)} className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Limpar Análise
                        </Button>
                    </div>
                </CardContent>
            )}

            <CardContent className="border-t border-indigo-100/30 pt-4">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase text-indigo-400">Teste de Prompt Direto (Salva em 'historico_ia')</label>
                    <div className="flex gap-2">
                        <Input
                            id="manual-prompt"
                            placeholder="Digite um prompt para testar a gravação direta no Cloud..."
                            className="bg-white/50 border-indigo-100 text-sm"
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold"
                            onClick={async () => {
                                const input = document.getElementById('manual-prompt') as HTMLInputElement;
                                if (!input.value) return;
                                try {
                                    setLoading(true);
                                    const res = await AiService.processAndSaveIA(input.value);
                                    setInsight(res);
                                    input.value = "";
                                    alert("Sucesso! Verifique o console para confirmação do Google Cloud.");
                                } catch (e: any) {
                                    alert("Erro: " + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            disabled={loading}
                        >
                            Enviar & Salvar
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
