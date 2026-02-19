import { useEffect, useState } from "react"
import { JiraService } from "@/services/jira-client"
import { JiraIssue } from "@/types/jira"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, Percent, BarChart3, GripHorizontal, Target, Plus, Download, Filter, Info, CheckCircle, Mail, Loader2 } from "lucide-react"
import { StrategicObjective } from "./StrategicObjectives"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts"
import { EmailService } from "@/services/email"
import { useAuth } from "@/contexts/AuthContext"

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
    const [isSendingEmail, setIsSendingEmail] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState("")
    const { user: currentUser } = useAuth()

    // Initialize recipient email
    useEffect(() => {
        if (currentUser?.email && !recipientEmail) {
            setRecipientEmail(currentUser.email)
        }
    }, [currentUser])

    // Effort Filter State
    const [minEffort, setMinEffort] = useState<string>("")
    const [maxEffort, setMaxEffort] = useState<string>("")

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

    const handleSendEmail = async () => {
        if (!recipientEmail) {
            alert("Por favor, informe o e-mail do destinatário.")
            return
        }

        if (filteredIssues.length === 0) {
            alert("Não há dados para enviar no relatório.")
            return
        }

        if (!confirm(`Deseja enviar o relatório para ${recipientEmail}?`)) return

        setIsSendingEmail(true)
        try {
            const reportDate = new Date().toLocaleDateString()
            const reportTime = new Date().toLocaleTimeString()
            const activeEpics = Array.from(new Set(issues.map(i => i.fields.parent?.key || i.fields.customfield_10014).filter(Boolean))).sort()
            const appUrl = "https://gen-lang-client-06714236-467f1.web.app"

            let html = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 0 auto; background-color: #ffffff; color: #1e293b; line-height: 1.5;">
                    <!-- Executive Header -->
                    <div style="background-color: #0f172a; padding: 40px; border-radius: 8px 8px 0 0; text-align: left; color: white;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Relatório Oficial de Apuração</h1>
                        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.8; font-weight: 300;">Ion Dashboard • Gestão de Performance de Resultados</p>
                    </div>

                    <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                        <!-- Report Info -->
                        <div style="margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
                            <div>
                                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Ciclo de Apuração</div>
                                <div style="font-size: 18px; font-weight: 700; color: #0f172a;">Planejamento Estratégico 2025</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 13px; color: #64748b;">Emitido em <b>${reportDate}</b> às <b>${reportTime}</b></div>
                                <div style="font-size: 13px; color: #64748b;">Responsável: <b>${currentUser?.displayName || currentUser?.email || "Solicitante"}</b></div>
                            </div>
                        </div>

                        <!-- Access Info Block -->
                        <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                            <div style="font-size: 14px; font-weight: 700; color: #0369a1; margin-bottom: 15px;">Acesso à Aplicação</div>
                            <div style="display: flex; gap: 20px;">
                                <div style="flex: 1;">
                                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">URL do Dashboard</div>
                                    <a href="${appUrl}" style="color: #0284c7; font-weight: 600; text-decoration: none; font-size: 14px;">${appUrl}</a>
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Instruções de Login</div>
                                    <div style="font-size: 13px; color: #1e293b;">Login: <b>[Seu E-mail]</b></div>
                                    <div style="font-size: 13px; color: #1e293b;">Senha: <b>[Solicitar ao Administrador]</b></div>
                                </div>
                            </div>
                        </div>

                        <!-- KPI Dashboard Row -->
                        <div style="margin: 40px 0; display: table; width: 100%; border-spacing: 12px 0; border-collapse: separate; margin-left: -12px; margin-right: -12px;">
                            <div style="display: table-cell; width: 25%; background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
                                <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Atingimento Global</div>
                                <div style="font-size: 28px; font-weight: 800; color: #0284c7;">${averageProgress}%</div>
                            </div>
                            <div style="display: table-cell; width: 25%; background-color: #ecfdf5; padding: 20px; border-radius: 12px; border: 1px solid #d1fae5; text-align: center;">
                                <div style="font-size: 11px; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Atingimento Alcançado</div>
                                <div style="font-size: 28px; font-weight: 800; color: #059669;">${reachedAverage}%</div>
                            </div>
                            <div style="display: table-cell; width: 25%; background-color: #f0f9ff; padding: 20px; border-radius: 12px; border: 1px solid #e0f2fe; text-align: center;">
                                <div style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Esforço Total</div>
                                <div style="font-size: 28px; font-weight: 800; color: #0284c7;">${totalEffortHours}h</div>
                            </div>
                            <div style="display: table-cell; width: 25%; background-color: #059669; padding: 20px; border-radius: 12px; text-align: center; color: white; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">
                                <div style="font-size: 11px; font-weight: 800; opacity: 0.9; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Esforço Aprovado</div>
                                <div style="font-size: 28px; font-weight: 800;">${approvedEffortHours}h</div>
                            </div>
                        </div>

                        <!-- Data Table -->
                        <h3 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 40px 0 20px 0; border-left: 4px solid #0284c7; padding-left: 12px;">Detalhamento por Item de Entrega</h3>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background-color: #f8fafc;">
                                    <th style="padding: 14px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700; width: 40px;">Ap.</th>
                                    <th style="padding: 14px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700; width: 80px;">Chave</th>
                                    <th style="padding: 14px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700;">Especificação da Entrega / Resultado</th>
                                    <th style="padding: 14px; text-align: center; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700; width: 70px;">Final</th>
                                    <th style="padding: 14px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700; width: 80px;">Esforço</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredIssues.map(issue => {
                const data = assessmentData[issue.id] || {}
                const jiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : (issue.progress || 0)
                const finalProgress = (data.manualProgress !== null && data.manualProgress !== undefined) ? data.manualProgress : jiraProgress
                const spent = ((issue.fields.timespent || 0) + (issue.subtasks?.reduce((s: number, b: any) => s + (b.fields.timespent || 0), 0) || 0)) / 3600
                const statusDot = data.isApproved ? "●" : "○"
                const statusColor = data.isApproved ? "#059669" : "#94a3b8"
                const rowBg = data.isApproved ? "#ffffff" : "#fcfdfe"

                return `
                                        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 14px; text-align: center; color: ${statusColor}; font-size: 20px;">${statusDot}</td>
                                            <td style="padding: 14px; font-family: monospace; font-weight: 600; color: #64748b;">${issue.key}</td>
                                            <td style="padding: 14px;">
                                                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">${issue.fields.summary}</div>
                                                ${data.notes ? `<div style="font-size: 11px; color: #64748b; font-style: italic; background-color: #f8fafc; padding: 6px 10px; border-radius: 4px; border-left: 2px solid #cbd5e1; margin-top: 6px;">Obs: ${data.notes}</div>` : ""}
                                            </td>
                                            <td style="padding: 14px; text-align: center; font-weight: 700; color: #0f172a; font-size: 14px;">${finalProgress}%</td>
                                            <td style="padding: 14px; text-align: right; font-weight: 600; color: #0284c7;">${spent.toFixed(1)}h</td>
                                        </tr>
                                    `
            }).join("")}
                            </tbody>
                        </table>

                        <!-- Data Sources Footer -->
                        <div style="margin-top: 40px; padding: 15px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">
                            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">Fontes de Dados (Epics)</div>
                            <div style="font-size: 11px; color: #64748b; font-family: monospace;">
                                ${activeEpics.join(", ")}
                            </div>
                        </div>

                        <!-- Official Signatures -->
                        <div style="margin-top: 60px; display: table; width: 100%; border-spacing: 40px 0; border-collapse: separate;">
                            <div style="display: table-cell; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center; width: 50%;">
                                <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">COORDENAÇÃO / GESTOR</div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Assinatura Digital</div>
                            </div>
                            <div style="display: table-cell; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center; width: 50%;">
                                <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">DIRETORIA DE OPERAÇÕES</div>
                                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Assinatura Digital</div>
                            </div>
                        </div>

                        <div style="margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                            <p>© 2025 Ion Sistemas - Inteligência Operacional. Este documento é para uso interno e restrito.</p>
                            <p style="margin-top: 5px;">Relatório id: ${Math.random().toString(36).substring(7).toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            `

            await EmailService.sendEmail({
                to: recipientEmail,
                subject: `Relatório de Apuração OKR - ${reportDate}`,
                text: `Relatório de Apuração gerado em ${reportDate}. Atingimento Alcançado: ${reachedAverage}%. Esforço Aprovado: ${approvedEffortHours}h.`,
                html: html
            })

            alert("Relatório enviado com sucesso para " + recipientEmail)
        } catch (error: any) {
            console.error("Erro ao enviar e-mail:", error)
            alert("Erro ao enviar e-mail: " + error.message)
        } finally {
            setIsSendingEmail(false)
        }
    }

    const handleExportCSV = () => {
        if (filteredIssues.length === 0) return

        const headers = ["Chave", "Resumo", "Status", "Progresso Jira", "Progresso Manual", "Progresso Final", "Esforço (h)", "Notas"]
        const dataRows = filteredIssues.map(issue => {
            const data = assessmentData[issue.id] || { manualProgress: null, notes: "" }
            const jiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : (issue.progress || 0)
            const finalProgress = (data.manualProgress !== null && data.manualProgress !== undefined) ? data.manualProgress : jiraProgress

            const issueSpent = issue.fields.timespent || 0
            const subtaskSpent = issue.subtasks?.reduce((sum: number, sub: JiraIssue) => sum + (sub.fields.timespent || 0), 0) || 0
            const effortHours = Math.round(((issueSpent + subtaskSpent) / 3600) * 10) / 10

            return [
                issue.key,
                `"${issue.fields.summary.replace(/"/g, '""')}"`,
                issue.fields.status.name,
                `${jiraProgress}%`,
                data.manualProgress !== null ? `${data.manualProgress}%` : "-",
                `${finalProgress}%`,
                effortHours.toString().replace(".", ","),
                `"${(data.notes || "").replace(/"/g, '""')}"`
            ]
        })

        const csvContent = "\uFEFF" + [headers, ...dataRows].map(e => e.join(";")).join("\n")
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `apuracao_okr_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Filter Logic
    const baseFilteredIssues = issues.filter((issue: JiraIssue) => {
        const issueSpent = issue.fields.timespent || 0
        const subtaskSpent = issue.subtasks?.reduce((sum: number, sub: JiraIssue) => sum + (sub.fields.timespent || 0), 0) || 0
        const effortHours = (issueSpent + subtaskSpent) / 3600

        if (minEffort !== "" && effortHours < parseFloat(minEffort)) return false
        if (maxEffort !== "" && effortHours > parseFloat(maxEffort)) return false

        return true
    })

    const filteredIssues = baseFilteredIssues.filter((issue: JiraIssue) => {
        if (filterOnlyApproved) {
            const data = assessmentData[issue.id]
            if (!data || !data.isApproved) return false
        }
        return true
    })

    // Calculations - USE baseFilteredIssues for global KPIs to remain stable
    const totalItems = baseFilteredIssues.length
    // Count approved only if explicitly marked approved
    const approvedCount = baseFilteredIssues.filter((e: JiraIssue) => assessmentData[e.id]?.isApproved).length

    // 1. Calculate Base Jira Progress (Ratio of issues Concluded)
    const issuesDoneCount = baseFilteredIssues.filter(i => i.fields.status.statusCategory.key === "done").length
    const jiraAverage = totalItems > 0 ? Math.round((issuesDoneCount / totalItems) * 100) : 0

    // 2. Calculate Final Adjusted Progress (Using manual overrides)
    const totalFinalSum = baseFilteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        const manual = data?.manualProgress
        const binaryJiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : 0
        const progress = (manual !== null && manual !== undefined) ? manual : binaryJiraProgress
        return sum + progress
    }, 0)
    const averageProgress = totalItems > 0 ? Math.round(totalFinalSum / totalItems) : 0

    // 3. Calculate "Atingimento Alcançado" (Contribution of Approved items to the total)
    const totalApprovedSum = baseFilteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        if (!data?.isApproved) return sum
        const manual = data?.manualProgress
        const binaryJiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : 0
        const progress = (manual !== null && manual !== undefined) ? manual : binaryJiraProgress
        return sum + progress
    }, 0)
    const reachedAverage = totalItems > 0 ? Math.round(totalApprovedSum / totalItems) : 0

    // 4. Calculate Total Effort Hours
    const totalEffortSeconds = baseFilteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const issueSpent = issue.fields.timespent || 0
        const subtaskSpent = issue.subtasks?.reduce((subSum: number, sub: JiraIssue) => subSum + (sub.fields.timespent || 0), 0) || 0
        return sum + issueSpent + subtaskSpent
    }, 0)
    const totalEffortHours = Math.round((totalEffortSeconds / 3600) * 10) / 10

    // 5. Calculate Approved Effort Hours (ONLY items marked as approved)
    const totalApprovedEffortSeconds = baseFilteredIssues.reduce((sum: number, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        if (!data?.isApproved) return sum

        const issueSpent = issue.fields.timespent || 0
        const subtaskSpent = issue.subtasks?.reduce((subSum: number, sub: JiraIssue) => subSum + (sub.fields.timespent || 0), 0) || 0
        return sum + issueSpent + subtaskSpent
    }, 0)
    const approvedEffortHours = Math.round((totalApprovedEffortSeconds / 3600) * 10) / 10

    // 6. Effort by Epic Chart Data (All Filtered)
    const effortByEpic = filteredIssues.reduce((acc: Record<string, number>, issue: JiraIssue) => {
        const parentKey = issue.fields.parent?.key || issue.fields.customfield_10014 || "Sem Epic"
        const issueSpent = issue.fields.timespent || 0
        const subtaskSpent = issue.subtasks?.reduce((sum: number, sub: JiraIssue) => sum + (sub.fields.timespent || 0), 0) || 0
        const totalHours = (issueSpent + subtaskSpent) / 3600

        acc[parentKey] = (acc[parentKey] || 0) + totalHours
        return acc
    }, {})

    const chartData = Object.entries(effortByEpic)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)

    // 7. Approved Effort by Epic Chart Data
    const approvedEffortByEpic = filteredIssues.reduce((acc: Record<string, number>, issue: JiraIssue) => {
        const data = assessmentData[issue.id]
        if (!data?.isApproved) return acc

        const parentKey = issue.fields.parent?.key || issue.fields.customfield_10014 || "Sem Epic"
        const issueSpent = issue.fields.timespent || 0
        const subtaskSpent = issue.subtasks?.reduce((sum: number, sub: JiraIssue) => sum + (sub.fields.timespent || 0), 0) || 0
        const totalHours = (issueSpent + subtaskSpent) / 3600

        acc[parentKey] = (acc[parentKey] || 0) + totalHours
        return acc
    }, {})

    const approvedChartData = Object.entries(approvedEffortByEpic)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)

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
                    <div className="flex items-center gap-1 px-3 py-1 border rounded-md bg-muted/20">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <Input
                            type="number"
                            placeholder="Min h"
                            className="w-16 h-7 text-xs border-none bg-transparent"
                            value={minEffort}
                            onChange={e => setMinEffort(e.target.value)}
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                            type="number"
                            placeholder="Max h"
                            className="w-16 h-7 text-xs border-none bg-transparent"
                            value={maxEffort}
                            onChange={e => setMaxEffort(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setFilterOnlyApproved(!filterOnlyApproved)}>
                        {filterOnlyApproved ? "Mostrar Todos" : "Apenas Aprovados"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="mr-2 h-4 w-4" />
                        Excel
                    </Button>
                    <div className="flex items-center gap-1 border rounded-md p-1 bg-blue-50/50 border-blue-100">
                        <Input
                            type="email"
                            placeholder="E-mail do destinatário"
                            className="w-48 h-8 text-xs bg-transparent border-none focus-visible:ring-0"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                        />
                        <Button variant="ghost" size="sm" onClick={handleSendEmail} disabled={isSendingEmail} className="h-8 text-blue-600 hover:bg-blue-100">
                            {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            Enviar
                        </Button>
                    </div>
                    <Button size="sm" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </div>

            {/* Print Header Only */}
            <div className="hidden print:block mb-8 text-center border-b pb-4">
                <h1 className="text-2xl font-bold">Relatório Oficial de Apuração de Resultados - 2025</h1>
                <p className="text-sm text-gray-500">Gerado em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-7 print:grid-cols-4">
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
                <Card className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">Esforço Total</CardTitle>
                        <Target className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{totalEffortHours}h</div>
                        <p className="text-xs text-muted-foreground print:hidden">
                            Filtro atual
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Esforço Aprovado</CardTitle>
                        <CheckCircle className="h-4 w-4 opacity-80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{approvedEffortHours}h</div>
                        <p className="text-[10px] opacity-80 mt-1 uppercase font-bold">
                            Resultante das aprovações
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Effort Charts Section */}
            <div className="grid gap-4 md:grid-cols-2 print:hidden">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-slate-400" />
                            Esforço por Epic (Geral)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={20}>
                                        {chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill="#94a3b8" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-200 bg-emerald-50/10 dark:bg-emerald-900/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                            BOARD: Esforço Resultante (Aprovado)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={approvedChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tickLine={false} axisLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={20}>
                                        {approvedChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill="#10b981" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <div className="rounded-md border bg-white dark:bg-slate-950 print:border-none print:shadow-none">
                <Table className="print:text-black">
                    <TableHeader className="print:bg-slate-100">
                        <TableRow>
                            <TableHead className="w-[80px] print:w-[60px] print:text-black">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground print:text-black">Aprov.</span>
                                    <Checkbox
                                        className="print:hidden h-3 w-3"
                                        checked={filteredIssues.length > 0 && filteredIssues.every(i => assessmentData[i.id]?.isApproved)}
                                        onCheckedChange={(c: boolean) => handleBulkApproval(c)}
                                    />
                                </div>
                            </TableHead>
                            <TableHead className="w-[80px] print:w-[50px] print:text-black">Extra</TableHead>
                            <TableHead className="print:text-black">OKR / História (KR)</TableHead>
                            <TableHead className="w-[120px] print:w-[100px] print:text-black">Status Real</TableHead>
                            <TableHead className="w-[100px] text-right print:hidden">% Jira</TableHead>
                            <TableHead className="w-[120px] text-right print:hidden">Novo %</TableHead>
                            <TableHead className="w-[100px] text-right font-bold print:w-[80px] print:text-black">Final</TableHead>
                            <TableHead className="w-[90px] text-right print:w-[70px] print:text-black">Esforço</TableHead>
                            <TableHead className="print:w-[200px] print:text-black">Observações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    Carregando dados...
                                </TableCell>
                            </TableRow>
                        ) : filteredIssues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
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
            <div className="hidden print:block mt-8 pt-6 border-t break-avoid">
                {/* Data Sources Section */}
                <div className="mb-8 p-3 bg-slate-50 border rounded text-[10px] text-slate-500">
                    <div className="font-bold uppercase mb-1">Fontes de Dados (Epics Consultados):</div>
                    <div className="font-mono">
                        {Array.from(new Set(issues.map(i => i.fields.parent?.key || i.fields.customfield_10014).filter(Boolean))).sort().join(", ")}
                    </div>
                </div>

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
                    @page { size: portrait; margin: 1cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    .print\\:hidden { display: none !important; }
                    
                    /* Reset container for print */
                    main, .layout-container, .content-wrapper { padding: 0 !important; margin: 0 !important; }
                    
                    /* Dashboard Cards refinement for print */
                    .print\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; }
                    .card { border: 1px solid #e2e8f0 !important; box-shadow: none !important; break-inside: avoid; }
                    .card-title { color: #64748b !important; font-size: 10px !important; }
                    .card-content div { font-size: 18px !important; }
                    
                    /* Table refinement for print */
                    table { font-size: 11px !important; }
                    th { background-color: #f8fafc !important; color: #0f172a !important; font-weight: bold !important; border-bottom: 2px solid #e2e8f0 !important; }
                    td { border-bottom: 1px solid #f1f5f9 !important; padding: 6px 4px !important; }
                    
                    .text-emerald-600 { color: #059669 !important; }
                    .bg-emerald-600 { background-color: #059669 !important; color: white !important; }
                    .text-blue-600 { color: #0284c7 !important; }
                    .bg-primary\\/5 { background-color: #f0f9ff !important; border-color: #e0f2fe !important; }
                }
            `}</style>
        </div>
    )
}

function HistoryRow({ issue, data, onApprovalChange, onExtraChange, onManualProgressChange, onNotesChange, onManualAttachment, onRemoveAttachment, strategicObjectives }: any) {
    const [isExpanded, setIsExpanded] = useState(false)

    const jiraProgress = issue.fields.status.statusCategory.key === "done" ? 100 : (issue.progress || 0)
    const finalProgress = (data.manualProgress !== null && data.manualProgress !== undefined) ? data.manualProgress : jiraProgress

    // Calculate effort hours (issue + subtasks)
    const issueHours = Math.round(((issue.fields.timespent || 0) / 3600) * 10) / 10
    const subtaskHours = Math.round(((issue.subtasks?.reduce((sum: number, sub: JiraIssue) => sum + (sub.fields.timespent || 0), 0) || 0) / 3600) * 10) / 10
    const effortHours = Math.round((issueHours + subtaskHours) * 10) / 10

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
                className={`cursor-pointer transition-colors ${data.isApproved ? "bg-green-50/30 dark:bg-green-900/5" : ""} ${isExpanded ? "bg-muted/50" : ""} print:bg-white print:hover:bg-white`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()} className="print:text-center">
                    <div className="print:hidden">
                        <Checkbox

                            checked={data.isApproved}
                            onCheckedChange={(c: boolean) => onApprovalChange(issue.id, c)}
                        />
                    </div>
                    <span className="hidden print:inline text-lg font-bold">
                        {data.isApproved ? "☑" : "☐"}
                    </span>
                </TableCell>
                <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()} className="print:text-center">
                    <div className="print:hidden">
                        <Checkbox
                            checked={data.isExtra}
                            onCheckedChange={(c: boolean) => onExtraChange(issue.id, c)}
                        />
                    </div>
                    <span className="hidden print:inline text-xs">
                        {data.isExtra ? "S" : "N"}
                    </span>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col group">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded print:bg-slate-100 print:text-black">
                                {issue.fields.parent?.key || issue.fields.customfield_10014 || "NO PARENT"}
                            </span>
                            <span className="font-medium flex items-center gap-1 print:text-black print:text-sm">
                                {issue.key}
                                <div onClick={openInJira} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-primary print:hidden">
                                    <BarChart3 className="w-3 h-3 rotate-45" />
                                </div>
                            </span>
                            {data.isExtra && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-800 rounded font-bold border border-blue-200 print:hidden">EXTRA</span>}
                        </div>
                        <span className="text-sm font-semibold truncate max-w-[400px] print:whitespace-normal print:max-w-none print:text-[12px]">
                            {issue.fields.summary}
                        </span>
                        {data.notes && <div className="hidden print:block text-[10px] text-gray-500 italic mt-1 bg-slate-50 p-1 border-l-2 border-slate-300">Obs: {data.notes}</div>}

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
                <TableCell className="text-right">
                    <div className="relative group/effort inline-block ml-auto cursor-help">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center justify-end gap-1">
                            {effortHours > 0 ? `${effortHours}h` : "0h"}
                            <Info className="w-3 h-3 opacity-30 group-hover/effort:opacity-100 transition-opacity print:hidden" />
                        </span>

                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover/effort:opacity-100 pointer-events-none transition-all duration-200 z-50">
                            <div className="bg-slate-900 text-white text-[10px] rounded p-2 shadow-xl border border-slate-700 w-32">
                                <div className="flex justify-between border-b border-slate-700 pb-1 mb-1 font-bold italic">
                                    <span>Origem</span>
                                    <span>Horas</span>
                                </div>
                                <div className="flex justify-between opacity-80">
                                    <span>História</span>
                                    <span>{issueHours}h</span>
                                </div>
                                <div className="flex justify-between opacity-80">
                                    <span>Subtasks</span>
                                    <span>{subtaskHours}h</span>
                                </div>
                                <div className="mt-1 pt-1 border-t border-slate-700 flex justify-between font-bold text-blue-300">
                                    <span>Total</span>
                                    <span>{effortHours}h</span>
                                </div>
                            </div>
                            <div className="w-2 h-2 bg-slate-900 absolute top-full right-3 -translate-y-1 rotate-45 border-r border-b border-slate-700" />
                        </div>
                    </div>
                </TableCell>
                <TableCell className="print:w-[200px]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Input
                        className="h-9 text-sm border-slate-300 focus:ring-1 print:hidden"
                        placeholder="Nota do Diretor..."
                        value={data.notes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNotesChange(issue.id, e.target.value)}
                    />
                    <span className="hidden print:inline text-[10px] italic">{data.notes}</span>
                </TableCell>
            </TableRow>
            {isExpanded && (
                <TableRow className="bg-muted/20 border-l-4 border-primary">
                    <TableCell colSpan={9} className="p-4">
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
