import { useEffect, useState } from "react"
import { JiraService } from "@/services/jira"
import { JiraIssue } from "@/types/jira"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, Percent, BarChart3, GripHorizontal, Target, Plus } from "lucide-react"
import { StrategicObjective } from "./StrategicObjectives"

// Interface for local state persistence
interface AssessmentData {
    id: string
    isApproved: boolean
    manualProgress: number | null // If null, use Jira progress
    isExtra: boolean
    notes: string
    manualAttachments?: string[] // Base64 strings
}

export function OkrAssessment() {
    const [issues, setIssues] = useState<JiraIssue[]>([])
    const [loading, setLoading] = useState(true)
    const [assessmentData, setAssessmentData] = useState<Record<string, AssessmentData>>({})
    const [filterOnlyApproved, setFilterOnlyApproved] = useState(false)
    const [strategicObjectives, setStrategicObjectives] = useState<StrategicObjective[]>([])

    // Load Data
    useEffect(() => {
        loadData()
        loadAssessmentData()
        loadStrategicObjectives()
    }, [])

    const loadStrategicObjectives = () => {
        const saved = localStorage.getItem("strategic_objectives")
        if (saved) setStrategicObjectives(JSON.parse(saved))
    }

    const loadData = async () => {
        setLoading(true)
        try {
            const okrIds = (localStorage.getItem("okr_epics") || "").split(",").map(s => s.trim()).filter(Boolean)
            const projectKey = localStorage.getItem("jira_project_key") || "ION"

            let epicsToFetch: JiraIssue[] = []

            if (okrIds.length > 0) {
                epicsToFetch = await JiraService.getEpicsByKeys(okrIds)
            } else {
                epicsToFetch = await JiraService.getEpics(projectKey)
            }

            // Optimized Bulk Fetching: Prevent dozens of parallel requests that freeze the browser
            const keys = epicsToFetch.map(e => e.key)
            const detailsResults = await JiraService.getBulkEpicDetails(keys)

            // Flatten all children into a single list
            const allChildren: JiraIssue[] = []
            detailsResults.forEach(res => {
                if (res && res.children) {
                    allChildren.push(...res.children)
                }
            })

            // Sort by Epic key and then Issue key for organization
            allChildren.sort((a, b) => {
                const parentA = a.fields.parent?.key || a.fields.customfield_10014 || ""
                const parentB = b.fields.parent?.key || b.fields.customfield_10014 || ""
                if (parentA !== parentB) return parentA.localeCompare(parentB)
                return a.key.localeCompare(b.key)
            })

            setIssues(allChildren)
        } catch (error) {
            console.error("Failed to load assessment data", error)
        }
        setLoading(false)
    }

    const loadAssessmentData = () => {
        const saved = localStorage.getItem("okr_assessment_data")
        if (saved) {
            setAssessmentData(JSON.parse(saved))
        }
    }

    const saveAssessmentData = (newData: Record<string, AssessmentData>) => {
        setAssessmentData(newData)
        localStorage.setItem("okr_assessment_data", JSON.stringify(newData))
    }

    const handleApprovalChange = (epicId: string, approved: boolean | string) => {
        const isChecked = approved === true || approved === "true"; // Handle checkbox event
        const current = assessmentData[epicId] || { id: epicId, isApproved: false, manualProgress: null, isExtra: false, notes: "" }
        const updated = { ...assessmentData, [epicId]: { ...current, isApproved: isChecked } }
        saveAssessmentData(updated)
    }

    const handleManualProgressChange = (epicId: string, value: string) => {
        const numValue = value === "" ? null : Number(value)
        const current = assessmentData[epicId] || { id: epicId, isApproved: false, manualProgress: null, isExtra: false, notes: "" }
        const updated = { ...assessmentData, [epicId]: { ...current, manualProgress: numValue } }
        saveAssessmentData(updated)
    }

    const handleExtraChange = (epicId: string, isExtra: boolean | string) => {
        const isChecked = isExtra === true || isExtra === "true";
        const current = assessmentData[epicId] || { id: epicId, isApproved: false, manualProgress: null, isExtra: false, notes: "" }
        const updated = { ...assessmentData, [epicId]: { ...current, isExtra: isChecked } }
        saveAssessmentData(updated)
    }

    const handleBulkApproval = (approved: boolean) => {
        const newData = { ...assessmentData }
        filteredIssues.forEach(issue => {
            const current = newData[issue.id] || { id: issue.id, isApproved: false, manualProgress: null, isExtra: false, notes: "" }
            newData[issue.id] = { ...current, isApproved: approved }
        })
        saveAssessmentData(newData)
    }

    const handleResetAdjustments = () => {
        if (!confirm("Tem certeza que deseja limpar todos os percentuais manuais, observações e prints anexados?")) return

        const newData = { ...assessmentData }
        filteredIssues.forEach(issue => {
            if (newData[issue.id]) {
                newData[issue.id] = {
                    ...newData[issue.id],
                    manualProgress: null,
                    notes: "",
                    manualAttachments: []
                }
            }
        })
        saveAssessmentData(newData)
    }

    const handleNotesChange = (issueId: string, value: string) => {
        const current = assessmentData[issueId] || { id: issueId, isApproved: false, manualProgress: null, isExtra: false, notes: "" }
        const updated = { ...assessmentData, [issueId]: { ...current, notes: value } }
        saveAssessmentData(updated)
    }

    const handleManualAttachment = (issueId: string, base64: string) => {
        const current = assessmentData[issueId] || { id: issueId, isApproved: false, manualProgress: null, isExtra: false, notes: "", manualAttachments: [] }
        const updatedAtts = [...(current.manualAttachments || []), base64].slice(-3) // Limit to 3 for storage safety
        const updated = { ...assessmentData, [issueId]: { ...current, manualAttachments: updatedAtts } }
        saveAssessmentData(updated)
    }

    const handleRemoveManualAttachment = (issueId: string, index: number) => {
        const current = assessmentData[issueId]
        if (!current || !current.manualAttachments) return
        const updatedAtts = current.manualAttachments.filter((_, i) => i !== index)
        const updated = { ...assessmentData, [issueId]: { ...current, manualAttachments: updatedAtts } }
        saveAssessmentData(updated)
    }

    const handlePrint = () => {
        window.print()
    }

    // Filter Logic
    const filteredIssues = issues.filter((issue: JiraIssue) => {
        if (filterOnlyApproved) {
            const data = assessmentData[issue.id]
            return data && data.isApproved
        }
        return true
    })

    // Calculations
    const totalItems = filteredIssues.length
    // Count approved only if explicitly marked approved
    const approvedCount = filteredIssues.filter((e: JiraIssue) => assessmentData[e.id]?.isApproved).length

    // 1. Calculate Base Jira Progress (Ratio of issues Concluded)
    // Matches the 81% logic (concluded items / total items) as per Epic Analysis
    const issuesDoneCount = filteredIssues.filter(i => i.fields.status.statusCategory.key === "done").length
    const jiraAverage = totalItems > 0 ? Math.round((issuesDoneCount / totalItems) * 100) : 0

    // 2. Calculate Final Adjusted Progress (Using manual overrides)
    // IMPORTANT: Fallback to binary jira progress (100 if Done, 0 otherwise) 
    // to maintain consistency with Baseline Jira KPI when no adjustments exist.
    const totalFinalSum = filteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        const manual = data?.manualProgress
        // Use binary logic as baseline to match the 82%
        const binaryJiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : 0
        const progress = (manual !== null && manual !== undefined) ? manual : binaryJiraProgress
        return sum + progress
    }, 0)
    const averageProgress = totalItems > 0 ? Math.round(totalFinalSum / totalItems) : 0

    // 3. Calculate "Atingimento Alcançado" (Contribution of Approved items to the total)
    const totalApprovedSum = filteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        if (!data?.isApproved) return sum
        const manual = data?.manualProgress
        // Maintain consistency: use binary (100 for Done, 0 for WIP) as baseline for KPI cards
        const binaryJiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : 0
        const progress = (manual !== null && manual !== undefined) ? manual : binaryJiraProgress
        return sum + progress
    }, 0)
    const reachedAverage = totalItems > 0 ? Math.round(totalApprovedSum / totalItems) : 0

    return (
        <div className="space-y-6 print:space-y-2 p-4 print:p-0">
            {/* Header - Hidden in Print if needed, or styled differently */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Apuração de OKRs / Resultados</h2>
                    <p className="text-muted-foreground">
                        Gestão de aprovação, ajustes manuais e relatório final.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetAdjustments} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                        Resetar Ajustes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setFilterOnlyApproved(!filterOnlyApproved)}>
                        {filterOnlyApproved ? "Mostrar Todos" : "Apenas Aprovados"}
                    </Button>
                    <Button size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Relatório
                    </Button>
                </div>
            </div>

            {/* Print Header Only */}
            <div className="hidden print:block mb-8 text-center border-b pb-4">
                <h1 className="text-2xl font-bold">Relatório Oficial de Apuração de Resultados - 2025</h1>
                <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5 print:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
                        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Histórias/Tarefas listadas
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Itens Aprovados</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{approvedCount}</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Marcados como validados
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50/50 dark:bg-slate-900/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Baseline Jira</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">{jiraAverage}%</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Progresso original do Jira
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Atingimento Global (Apurado)</CardTitle>
                        <Percent className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{averageProgress}%</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Média final (Com seus ajustes)
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600">Atingimento Alcançado</CardTitle>
                        <BarChart3 className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{reachedAverage}%</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Apenas itens aprovados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <div className="rounded-md border bg-white dark:bg-slate-950 print:border-none">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px] print:w-[60px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Aprov.</span>
                                    <Checkbox
                                        className="print:hidden h-3 w-3"
                                        checked={filteredIssues.length > 0 && filteredIssues.every(i => assessmentData[i.id]?.isApproved)}
                                        onCheckedChange={(c: boolean) => handleBulkApproval(c)}
                                    />
                                </div>
                            </TableHead>
                            <TableHead className="w-[80px] print:w-[60px]">Extra</TableHead>
                            <TableHead>OKR / História (KR)</TableHead>
                            <TableHead className="w-[120px]">Status Real</TableHead>
                            <TableHead className="w-[100px] text-right">% Jira</TableHead>
                            <TableHead className="w-[120px] text-right print:w-[100px]">Novo %</TableHead>
                            <TableHead className="w-[100px] text-right font-bold">Final</TableHead>
                            <TableHead className="print:hidden">Observações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Carregando dados...
                                </TableCell>
                            </TableRow>
                        ) : filteredIssues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Nenhum item encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredIssues.map((issue: JiraIssue) => (
                                <HistoryRow
                                    key={issue.id}
                                    issue={issue}
                                    data={assessmentData[issue.id] || { id: issue.id, isApproved: false, manualProgress: null, isExtra: false, notes: "" }}
                                    onApprovalChange={handleApprovalChange}
                                    onExtraChange={handleExtraChange}
                                    onManualProgressChange={handleManualProgressChange}
                                    onNotesChange={handleNotesChange}
                                    onManualAttachment={handleManualAttachment}
                                    onRemoveAttachment={handleRemoveManualAttachment}
                                    strategicObjectives={strategicObjectives}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-8 border-t break-avoid">
                <div className="flex justify-between text-sm text-gray-500 gap-8">
                    <div className="text-center w-1/3">
                        <p className="border-t border-gray-400 pt-2">Responsável (Assinatura)</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p className="border-t border-gray-400 pt-2">Gestão (Assinatura)</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p className="border-t border-gray-400 pt-2">Data</p>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { size: landscape; margin: 0.5cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    )
}

function HistoryRow({ issue, data, onApprovalChange, onExtraChange, onManualProgressChange, onNotesChange, onManualAttachment, onRemoveAttachment, strategicObjectives }: any) {
    const [isExpanded, setIsExpanded] = useState(false)

    const jiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : (issue.progress || 0)
    const finalProgress = (data.manualProgress !== null && data.manualProgress !== undefined) ? data.manualProgress : jiraProgress

    const getStatusColor = (category: string) => {
        switch (category) {
            case 'done': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200'
            case 'indeterminate': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200'
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200'
        }
    }

    const openInJira = (e: React.MouseEvent) => {
        e.stopPropagation()
        const baseUrl = localStorage.getItem("jira_url") || ""
        let url = baseUrl.trim()
        if (url && !url.startsWith('http')) url = `https://${url}`
        url = url.replace(/\/$/, "")
        if (url) window.open(`${url}/browse/${issue.key}`, '_blank')
    }

    return (
        <>
            <TableRow
                className={`cursor-pointer transition-colors ${data.isApproved ? "bg-green-50/30 dark:bg-green-900/5" : ""} ${isExpanded ? "bg-muted/50" : ""}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Checkbox
                        checked={data.isApproved}
                        onCheckedChange={(c: boolean) => onApprovalChange(issue.id, c)}
                    />
                </TableCell>
                <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Checkbox
                        checked={data.isExtra}
                        onCheckedChange={(c: boolean) => onExtraChange(issue.id, c)}
                    />
                </TableCell>
                <TableCell>
                    <div className="flex flex-col group">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded">
                                {issue.fields.parent?.key || issue.fields.customfield_10014 || "NO PARENT"}
                            </span>
                            <span className="font-medium flex items-center gap-1">
                                {issue.key}
                                <div onClick={openInJira} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-primary">
                                    <BarChart3 className="w-3 h-3 rotate-45" />
                                </div>
                            </span>
                            {data.isExtra && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-800 rounded font-bold border border-blue-200">EXTRA</span>}
                        </div>
                        <span className="text-sm font-semibold truncate max-w-[400px]">
                            {issue.fields.summary}
                        </span>

                        {/* Strategic Cross-Reference */}
                        {(() => {
                            const parentKey = issue.fields.parent?.key || issue.fields.customfield_10014
                            const relatedObj = strategicObjectives.find((o: StrategicObjective) => parentKey && o.epicKeys.includes(parentKey))
                            if (!relatedObj) return null
                            return (
                                <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 max-w-fit">
                                    <Target className="w-2.5 h-2.5" />
                                    OBJETIVO: {relatedObj.title.toUpperCase()}
                                </div>
                            )
                        })()}

                        {/* Mixed Evidence (Jira + Manual) */}
                        {data.isApproved && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {issue.fields.attachment?.slice(0, 3).map((att: any) => (
                                    <div key={att.id} className="w-20 h-20 border rounded overflow-hidden shadow-sm bg-muted/20">
                                        <img src={att.thumbnail || att.content} alt="Evidence" className="w-full h-full object-cover" />
                                    </div>
                                ))}

                                {data.manualAttachments?.map((base64: string, idx: number) => (
                                    <div key={idx} className="group/att w-20 h-20 border rounded overflow-hidden border-primary/40 relative shadow-sm">
                                        <img src={base64} alt="Manual Evidence" className="w-full h-full object-cover" />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRemoveAttachment(issue.id, idx); }}
                                            className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-bl opacity-0 group-hover/att:opacity-100 transition-opacity print:hidden shadow-lg"
                                        >
                                            <span className="text-xs">×</span>
                                        </button>
                                    </div>
                                ))}

                                {/* Upload Action Button (Hide in Print) */}
                                <label className="w-20 h-20 border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-all print:hidden group/upl">
                                    <Plus className="h-5 w-5 text-muted-foreground group-hover/upl:text-primary transition-colors" />
                                    <span className="text-[9px] font-bold text-muted-foreground group-hover/upl:text-primary mt-1 uppercase">Print</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => onManualAttachment(issue.id, reader.result as string);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusColor(issue.fields.status.statusCategory.key)}`}>
                        {issue.fields.status.name}
                    </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                    {jiraProgress}%
                </TableCell>
                <TableCell className="text-right" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Input
                        type="number"
                        min="0"
                        max="100"
                        className="w-16 h-8 text-right ml-auto print:hidden"
                        placeholder="-"
                        value={data.manualProgress === null ? "" : data.manualProgress}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onManualProgressChange(issue.id, e.target.value)}
                    />
                    <span className="hidden print:block">{data.manualProgress !== null ? `${data.manualProgress}%` : "-"}</span>
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                    {finalProgress}%
                </TableCell>
                <TableCell className="print:hidden" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Input
                        className="h-9 text-sm border-slate-300 focus:ring-1"
                        placeholder="Nota do Diretor..."
                        value={data.notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNotesChange(issue.id, e.target.value)}
                    />
                </TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/20 border-l-4 border-primary">
                    <TableCell colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground">Responsável</h4>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">
                                        {issue.fields.assignee?.displayName?.charAt(0) || "?"}
                                    </div>
                                    <span className="text-sm">{issue.fields.assignee?.displayName || "Sem responsável"}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground">Datas</h4>
                                <div className="text-sm flex flex-col">
                                    <span>Início: {new Date(issue.fields.created).toLocaleDateString()}</span>
                                    <span>Update: {new Date(issue.fields.updated).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Evidências Técnicas / Prints</h4>
                                <div className="flex flex-wrap gap-2">
                                    {issue.fields.attachment && issue.fields.attachment.length > 0 ? (
                                        issue.fields.attachment.map((att: any) => (
                                            <div
                                                key={att.id}
                                                className="group relative cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(att.content, '_blank');
                                                }}
                                            >
                                                {att.mimeType.startsWith('image/') ? (
                                                    <div className="w-12 h-12 rounded border bg-slate-100 flex items-center justify-center overflow-hidden hover:border-primary transition-all">
                                                        <img src={att.thumbnail || att.content} alt={att.filename} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded border bg-amber-50 flex items-center justify-center text-[10px] text-amber-700 font-bold hover:border-primary transition-all">
                                                        FILE
                                                    </div>
                                                )}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-slate-900 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                                    {att.filename}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground italic">Nenhum anexo encontrado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}
