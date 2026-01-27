import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Printer, ChevronDown, ChevronRight, Target, BarChart3, Pencil } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore"

interface KeyResult {
    id: string
    name: string
    responsible: string
    progress: number
    notes: string
}

interface ManualObjective {
    id: string
    name: string
    year: number
    quarter: string // "Q1", "Q2", "Q3", "Q4", "Year"
    krs: KeyResult[]
}

export function ManualOkrs() {
    const [objectives, setObjectives] = useState<ManualObjective[]>([])
    const [newName, setNewName] = useState("")
    const [newYear, setNewYear] = useState(new Date().getFullYear())
    const [newQuarter, setNewQuarter] = useState("Q1")
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [editingObjId, setEditingObjId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")

    // Filters
    const [filterYear, setFilterYear] = useState<number | "ALL">("ALL")
    const [filterQuarter, setFilterQuarter] = useState<string>("ALL")

    useEffect(() => {
        const q = query(collection(db, "manual_okrs"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items: ManualObjective[] = [];
            querySnapshot.forEach((doc) => {
                items.push({ ...doc.data() as ManualObjective, id: doc.id });
            });
            setObjectives(items);
        });

        return () => unsubscribe();
    }, [])

    const saveObjectiveToFirestore = async (obj: ManualObjective) => {
        try {
            await setDoc(doc(db, "manual_okrs", obj.id), obj);
        } catch (e) {
            console.error("Error saving manual objective:", e);
        }
    }

    const handleAddObjective = async () => {
        if (!newName) return
        const newItem: ManualObjective = {
            id: Date.now().toString(),
            name: newName,
            year: newYear,
            quarter: newQuarter,
            krs: []
        }
        await saveObjectiveToFirestore(newItem);
        setNewName("")
        setExpandedIds(prev => new Set(prev).add(newItem.id))
    }

    const handleDeleteObjective = async (id: string) => {
        if (!confirm("Excluir este objetivo e todos os seus KRs?")) return
        await deleteDoc(doc(db, "manual_okrs", id));
    }

    const handleAddKR = async (objId: string) => {
        const obj = objectives.find(o => o.id === objId);
        if (obj) {
            const newKR: KeyResult = {
                id: Date.now().toString(),
                name: "Novo Key Result",
                responsible: "",
                progress: 0,
                notes: ""
            };
            const updatedObj = { ...obj, krs: [...obj.krs, newKR] };
            await saveObjectiveToFirestore(updatedObj);
        }
    }

    const handleDeleteKR = async (objId: string, krId: string) => {
        const obj = objectives.find(o => o.id === objId);
        if (obj) {
            const updatedObj = { ...obj, krs: obj.krs.filter(kr => kr.id !== krId) };
            await saveObjectiveToFirestore(updatedObj);
        }
    }

    const handleUpdateKR = async (objId: string, krId: string, field: keyof KeyResult, value: any) => {
        const obj = objectives.find(o => o.id === objId);
        if (obj) {
            const updatedKRs = obj.krs.map(kr =>
                kr.id === krId ? { ...kr, [field]: value } : kr
            );
            const updatedObj = { ...obj, krs: updatedKRs };
            await saveObjectiveToFirestore(updatedObj);
        }
    }

    const handleUpdateObjName = async (id: string, name: string) => {
        const obj = objectives.find(o => o.id === id);
        if (obj) {
            await saveObjectiveToFirestore({ ...obj, name });
        }
    }

    const startEditingObj = (e: React.MouseEvent, obj: ManualObjective) => {
        e.stopPropagation()
        setEditingObjId(obj.id)
        setEditName(obj.name)
    }

    const saveObjName = (e: React.FormEvent | React.FocusEvent, id: string) => {
        if (e.type === 'submit') e.preventDefault()
        if (editName.trim()) {
            handleUpdateObjName(id, editName)
        }
        setEditingObjId(null)
    }
    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filteredObjectives = objectives.filter(obj => {
        if (filterYear !== "ALL" && obj.year !== filterYear) return false
        if (filterQuarter !== "ALL" && obj.quarter !== filterQuarter) return false
        return true
    })

    return (
        <div className="space-y-6 p-4 print:p-0">
            <div className="flex justify-between items-center print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Gestão Manual de OKRs</h2>
                        <p className="text-muted-foreground">Planejamento e acompanhamento de metas por trimestre.</p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => window.print()} className="gap-2">
                    <Printer className="h-4 w-4" /> Imprimir Relatório Diário
                </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-4 print:hidden bg-slate-50 p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Filtrar Ano:</span>
                    <select
                        className="text-xs p-1 border rounded bg-white"
                        value={filterYear}
                        onChange={e => setFilterYear(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    >
                        <option value="ALL">Todos</option>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Trimestre:</span>
                    <select
                        className="text-xs p-1 border rounded bg-white"
                        value={filterQuarter}
                        onChange={e => setFilterQuarter(e.target.value)}
                    >
                        <option value="ALL">Todos</option>
                        <option value="Q1">Q1</option>
                        <option value="Q2">Q2</option>
                        <option value="Q3">Q3</option>
                        <option value="Q4">Q4</option>
                        <option value="Anual">Anual</option>
                    </select>
                </div>
            </div>

            <Card className="print:hidden border-dashed bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Novo Objetivo Estratégico</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-6 space-y-1.5">
                        <label className="text-xs font-semibold">Título do Objetivo (O)</label>
                        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Expandir infraestrutura de dados" className="bg-background" />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold">Ano</label>
                        <Input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))} className="bg-background" />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold">Trimestre</label>
                        <select
                            value={newQuarter}
                            onChange={e => setNewQuarter(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                            <option value="Q1">Q1</option>
                            <option value="Q2">Q2</option>
                            <option value="Q3">Q3</option>
                            <option value="Q4">Q4</option>
                            <option value="Anual">Anual</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <Button onClick={handleAddObjective} className="w-full gap-2 font-bold">
                            <Plus className="h-4 w-4" /> CRIAR (O)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {filteredObjectives.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-muted flex flex-col items-center">
                        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground italic">Nenhum OKR cadastrado para este ciclo.</p>
                    </div>
                ) : (
                    objectives.map(obj => {
                        const avgProgress = obj.krs.length > 0
                            ? Math.round(obj.krs.reduce((acc, kr) => acc + kr.progress, 0) / obj.krs.length)
                            : 0
                        const isExpanded = expandedIds.has(obj.id)

                        return (
                            <div key={obj.id} className="border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${isExpanded ? 'bg-primary/5' : ''}`}
                                    onClick={() => toggleExpand(obj.id)}
                                >
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="print:hidden">
                                            {isExpanded ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                        </div>
                                        <div className="flex flex-col flex-1 pl-4" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{obj.quarter} {obj.year}</span>
                                                {editingObjId === obj.id ? (
                                                    <form onSubmit={(e) => saveObjName(e, obj.id)} className="flex-1">
                                                        <Input
                                                            autoFocus
                                                            className="h-8 font-bold text-lg border-primary/40 focus-visible:ring-primary shadow-none -ml-2"
                                                            value={editName}
                                                            onChange={e => setEditName(e.target.value)}
                                                            onBlur={(e) => saveObjName(e, obj.id)}
                                                        />
                                                    </form>
                                                ) : (
                                                    <div className="flex items-center gap-2 group/title">
                                                        <h3 className="text-lg font-bold" onClick={() => toggleExpand(obj.id)}>{obj.name}</h3>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => startEditingObj(e, obj)}
                                                            className="h-6 w-6 p-0 opacity-0 group-hover/title:opacity-100 transition-opacity"
                                                        >
                                                            <Pencil className="h-3 w-3 text-muted-foreground" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground" onClick={() => toggleExpand(obj.id)}>{obj.krs.length} Key Results definidos</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-primary">{avgProgress}% Alcançado</span>
                                            <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden print:hidden">
                                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${avgProgress}%` }} />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="print:hidden text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteObjective(obj.id); }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 bg-muted/5 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent border-none">
                                                    <TableHead className="h-8 text-[10px] uppercase font-bold text-muted-foreground">Key Result (KR)</TableHead>
                                                    <TableHead className="h-8 text-[10px] uppercase font-bold text-muted-foreground w-[200px]">Responsável</TableHead>
                                                    <TableHead className="h-8 text-[10px] uppercase font-bold text-muted-foreground w-[120px] text-right">Progresso</TableHead>
                                                    <TableHead className="h-8 text-[10px] uppercase font-bold text-muted-foreground w-[60px] print:hidden"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {obj.krs.map(kr => (
                                                    <TableRow key={kr.id} className="group border-slate-100">
                                                        <TableCell className="py-3">
                                                            <Input
                                                                className="h-8 font-medium border-none shadow-none focus-visible:ring-1 px-2"
                                                                value={kr.name}
                                                                onChange={e => handleUpdateKR(obj.id, kr.id, "name", e.target.value)}
                                                            />
                                                            <Input
                                                                className="h-7 text-xs border-none shadow-none bg-transparent italic opacity-60 px-2 mt-1"
                                                                placeholder="Notas adicionais..."
                                                                value={kr.notes}
                                                                onChange={e => handleUpdateKR(obj.id, kr.id, "notes", e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <Input
                                                                className="h-8 text-sm"
                                                                placeholder="Nome do owner"
                                                                value={kr.responsible}
                                                                onChange={e => handleUpdateKR(obj.id, kr.id, "responsible", e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right">
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <Input
                                                                    type="number"
                                                                    className="h-8 w-16 text-right font-bold"
                                                                    value={kr.progress}
                                                                    onChange={e => handleUpdateKR(obj.id, kr.id, "progress", Number(e.target.value))}
                                                                />
                                                                <span className="font-bold text-sm">%</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right print:hidden">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                                                                onClick={() => handleDeleteKR(obj.id, kr.id)}
                                                            >
                                                                <Plus className="h-4 w-4 rotate-45" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="hover:bg-transparent border-none">
                                                    <TableCell colSpan={4} className="pt-4 pb-2 text-center">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleAddKR(obj.id)}
                                                            className="border-dashed gap-2 text-xs font-bold"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" /> Adicionar KR para este Objetivo
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-32 p-12 border-t bg-slate-50 rounded-xl">
                <div className="grid grid-cols-2 gap-20">
                    <div className="space-y-12">
                        <div className="border-t border-slate-400 pt-4 text-center">
                            <p className="font-bold text-sm uppercase">Assinatura do Gestor</p>
                            <p className="text-[10px] text-slate-500 mt-1">Responsável pela execução do ciclo</p>
                        </div>
                    </div>
                    <div className="space-y-12">
                        <div className="border-t border-slate-400 pt-4 text-center">
                            <p className="font-bold text-sm uppercase">Validação Diretoria</p>
                            <p className="text-[10px] text-slate-500 mt-1">Data: {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <p className="text-[9px] text-slate-400 italic">Relatório gerado via Strategic Dashboard v2 - {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
        </div>
    )
}
