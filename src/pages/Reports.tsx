import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileBarChart, Printer, Target, LayoutDashboard, BarChart3, ChevronRight, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StrategicReport } from "@/components/objectives/StrategicReport"
import { ExecutiveReport } from "@/components/objectives/ExecutiveReport"
import { collection, query, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { JiraService } from "@/services/jira-client"
import { EmailService } from "@/services/email"
import { useAuth } from "@/contexts/AuthContext"

export default function Reports() {
    const { t } = useTranslation()
    const [objectives, setObjectives] = useState<any[]>([])
    const [epicData, setEpicData] = useState<Record<string, any>>({})
    const [dashboardData, setDashboardData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showStrategicReport, setShowStrategicReport] = useState(false)
    const [showExecutiveReport, setShowExecutiveReport] = useState(false)
    const { user } = useAuth()
    const [sendingEmail, setSendingEmail] = useState(false)
    const [emailModal, setEmailModal] = useState<{ open: boolean, reportType: 'strategic' | 'executive', defaultEmails: string }>({ open: false, reportType: 'strategic', defaultEmails: '' })
    const [recipients, setRecipients] = useState("")
    const [ccRecipients, setCcRecipients] = useState("")
    const [appAccessLink, setAppAccessLink] = useState(window.location.origin)
    const [accessCredentials, setAccessCredentials] = useState("Login: okr@ionsistemas.com.br | Senha: okr2025")

    useEffect(() => {
        const q = query(collection(db, "strategic_objectives"))
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const objs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
            setObjectives(objs)

            // Fetch progress and children for all related epics
            const allEpicKeys = Array.from(new Set(objs.flatMap(obj => obj.epicKeys || [])))
            if (allEpicKeys.length > 0) {
                const progressMap: Record<string, any> = {}
                const epics = await JiraService.getEpicsByKeys(allEpicKeys)
                epics.forEach(epic => {
                    progressMap[epic.key] = {
                        progress: epic.progress || 0,
                        hours: (epic as any).totalHours || (epic as any).hours || 0,
                        children: (epic as any).children || [],
                        summary: epic.fields?.summary || ""
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

        // 1. Scan for all epics in the project
        const epics = await JiraService.getEpics(pk, "ALL", false);
        const activeEpicsBase = epics.filter(e => !e.fields.status.name.toLowerCase().includes("cancel"))
        const keys = activeEpicsBase.map(e => e.key);

        // 2. Fetch full detail (with children) for these epics
        // This ensures we have the tickets (children) for the quarterly calculation
        const activeEpics = await JiraService.getEpicsByKeys(keys, "ALL", false);

        const totalInitiatives = activeEpics.length
        const totalProgress = activeEpics.reduce((acc, e) => acc + (e.progress ?? 0), 0)
        const avgProgress = totalInitiatives > 0 ? Math.round(totalProgress / totalInitiatives) : 0

        // Real count per quarter for 2025 (TICKETS based, as requested)
        const year = 2025;
        const stats = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

        activeEpics.forEach(epic => {
            const children = (epic as any).children || [];
            children.forEach((issue: any) => {
                const isDone = issue.fields.status.statusCategory.key === 'done' || (issue.fields.status.name || "").toLowerCase().includes("finalizado");
                const dStr = issue.fields.resolutiondate || issue.fields.updated;
                if (isDone && dStr) {
                    const d = new Date(dStr);
                    if (d.getFullYear() === year) {
                        const m = d.getMonth();
                        if (m <= 2) stats.Q1++;
                        else if (m <= 5) stats.Q2++;
                        else if (m <= 8) stats.Q3++;
                        else stats.Q4++;
                    }
                }
            });
        });

        const qData = [
            { quarter: 'Q1', count: stats.Q1, color: '#001540' },
            { quarter: 'Q2', count: stats.Q2, color: '#FF4200' },
            { quarter: 'Q3', count: stats.Q3, color: '#10B981' },
            { quarter: 'Q4', count: stats.Q4, color: '#8B5CF6' },
        ];

        setDashboardData({
            totalInitiatives,
            avgProgress,
            q4Deliveries: stats.Q4,
            successRate: avgProgress > 90 ? "98%" : avgProgress > 50 ? "85%" : "60%",
            quarterlyData: qData,
            year
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
    const handleEmailReport = async () => {
        if (!user?.email) {
            alert("Erro: E-mail do usuário não encontrado.")
            return
        }
        setEmailModal({ open: true, reportType: 'strategic', defaultEmails: user.email })
        setRecipients(user.email)
    }

    const executeSendStrategicEmail = async (targetEmails: string, ccEmails: string = "") => {
        console.log("[Reports] Triggering Strategic Email Report to:", targetEmails)

        // Ensure auth token is fresh to avoid "User must be authenticated" errors
        try {
            const { auth } = await import("@/lib/firebase");
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }
        } catch (e) {
            console.warn("Auth token refresh failed, proceeding anyway:", e);
        }

        setSendingEmail(true)
        try {
            const today = new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const totalEffort = objectives.reduce((acc, obj) => acc + (obj.epicKeys || []).reduce((eAcc: number, key: string) => eAcc + (epicData[key]?.hours || 0), 0), 0).toFixed(0);
            const jiraBaseUrl = (user?.jiraUrl || "").replace(/\/$/, "");

            // Generate high-fidelity HTML template mirroring the "State of the Art" UI
            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #001540; margin: 0;">
                <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 40px; overflow: hidden; box-shadow: 0 40px 100px -20px rgba(0, 21, 64, 0.15); border: 1px solid #f1f5f9;">
                    
                    <!-- Top Branding Bar -->
                    <div style="background-color: #001540; padding: 15px 40px; color: white; font-size: 10px; font-weight: 900; letter-spacing: 0.3em; text-transform: uppercase;">
                        ION SISTEMAS • STRATEGY REPORT 2025
                    </div>

                    <!-- Header Segment -->
                    <div style="padding: 40px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <h1 style="margin: 0; font-size: 32px; font-weight: 950; letter-spacing: -0.04em; text-transform: uppercase; line-height: 0.9;">
                                APURAÇÃO <span style="color: #FF4200;">ESTRATÉGICA</span>
                            </h1>
                            <p style="margin: 8px 0 0; font-size: 14px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                                Performance & Roadmaps • ${today}
                            </p>
                        </div>
                    </div>

                    <!-- ACCESS CREDENTIALS (NEW TOP SECTION) -->
                    ${appAccessLink ? `
                    <div style="padding: 25px 40px; background-color: #f8fafc; border-bottom: 1px solid #f1f5f9; text-align: center;">
                        <div style="margin-bottom: 15px;">
                            <a href="${appAccessLink}" style="display: inline-block; padding: 14px 35px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 14px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s; box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.3);">
                                Acessar Dashboard Completo
                            </a>
                        </div>
                        ${accessCredentials ? `
                        <div style="font-size: 12px; color: #475569; font-weight: 800; background: #ffffff; border: 1.5px dashed #cbd5e1; padding: 12px 20px; border-radius: 12px; display: inline-block; font-family: 'Courier New', Courier, monospace;">
                            ${accessCredentials}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}

                    <!-- KPI Grid (3 Cards) -->
                    <div style="padding: 20px 40px; display: table; width: 100%; border-spacing: 15px; border-collapse: separate;">
                        <div style="display: table-row;">
                            <!-- Card 1: Objectives -->
                            <div style="display: table-cell; background-color: #ffffff; border: 1px solid #f1f5f9; padding: 25px; border-radius: 30px; width: 33%; vertical-align: middle;">
                                <p style="margin: 0 0 10px; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em;">Objetivos</p>
                                <div style="font-size: 48px; font-weight: 900; color: #001540; line-height: 1;">${objectives.length}</div>
                            </div>
                            <!-- Card 2: Percentage (Highlight) -->
                            <div style="display: table-cell; background-color: #FF4200; padding: 25px; border-radius: 30px; width: 33%; color: white; vertical-align: middle; box-shadow: 0 20px 40px -10px rgba(255, 66, 0, 0.3);">
                                <p style="margin: 0 0 10px; font-size: 9px; font-weight: 900; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.2em;">Progresso</p>
                                <div style="font-size: 60px; font-weight: 950; line-height: 1;">${avgProgress}%</div>
                            </div>
                            <!-- Card 3: Effort -->
                            <div style="display: table-cell; background-color: #ffffff; border: 1px solid #f1f5f9; padding: 25px; border-radius: 30px; width: 33%; vertical-align: middle;">
                                <p style="margin: 0 0 10px; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em;">Investimento</p>
                                <div style="font-size: 42px; font-weight: 900; color: #001540; line-height: 1;">${totalEffort}<span style="font-size: 20px; color: #94a3b8; margin-left: 2px;">h</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Table Header -->
                    <div style="padding: 0 40px;">
                        <div style="background-color: #001540; color: white; padding: 15px 25px; border-radius: 20px 20px 0 0; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; display: table; width: 100%; box-sizing: border-box;">
                            <div style="display: table-cell; width: 50%;">Objetivo / Tickets</div>
                            <div style="display: table-cell; width: 15%; text-align: center;">Horas</div>
                            <div style="display: table-cell; width: 20%; text-align: center;">Progresso</div>
                            <div style="display: table-cell; width: 15%; text-align: right;">Status</div>
                        </div>
                    </div>

                    <!-- Items List -->
                    <div style="padding: 0 40px 40px;">
                        <div style="border: 1px solid #f1f5f9; border-top: none; border-radius: 0 0 20px 20px; overflow: hidden;">
                            ${objectives.map(obj => {
                const progSum = (obj.epicKeys || []).reduce((eAcc: number, eKey: string) => eAcc + (epicData[eKey]?.progress || 0), 0)
                const jiraProg = (obj.epicKeys || []).length > 0 ? Math.round(progSum / obj.epicKeys.length) : 0
                const actualProg = obj.suggestedProgress != null ? obj.suggestedProgress : jiraProg
                const isManual = obj.suggestedProgress != null
                const hours = (obj.epicKeys || []).reduce((eAcc: number, eKey: string) => eAcc + (epicData[eKey]?.hours || 0), 0)

                // Get tickets for this objective
                const tickets = (obj.epicKeys || []).flatMap((key: string) => {
                    const info = epicData[key];
                    if (!info || !info.children) return [];
                    return info.children.map((c: any) => ({ key: c.key, done: c.fields?.status?.statusCategory?.key === 'done' }));
                }).sort((a: any, b: any) => a.key.localeCompare(b.key));

                return `
                                <div style="padding: 25px; border-bottom: 1px solid #f1f5f9; display: table; width: 100%; box-sizing: border-box;">
                                    <!-- Objective & Tickets -->
                                    <div style="display: table-cell; width: 50%; vertical-align: top;">
                                        <div style="font-weight: 900; font-size: 15px; margin-bottom: 4px; text-transform: uppercase; color: #001540;">${obj.title}</div>
                                        <div style="font-size: 11px; color: #94a3b8; font-weight: 500; margin-bottom: 12px; line-height: 1.4;">
                                            ${obj.description || 'Sem descrição cadastrada.'}
                                        </div>
                                        
                                        <!-- Tickets Row -->
                                        <div style="display: block; font-size: 0;">
                                            ${tickets.map((t: any) => `
                                                <a href="${jiraBaseUrl}/browse/${t.key}" target="_blank" style="display: inline-block; text-decoration: none; margin-bottom: 4px;">
                                                    <span style="display: inline-block; padding: 3px 7px; margin: 0 4px 0 0; background-color: ${t.done ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${t.done ? '#d1fae5' : '#f1f5f9'}; border-radius: 6px; font-size: 9px; font-weight: 900; color: ${t.done ? '#059669' : '#64748b'};">
                                                        ${t.key}
                                                    </span>
                                                </a>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Hours -->
                                    <div style="display: table-cell; width: 15%; vertical-align: top; text-align: center; font-weight: 900; font-size: 16px; color: #001540; padding-top: 5px;">
                                        ${hours.toFixed(1)}h
                                    </div>

                                    <!-- Progress -->
                                    <div style="display: table-cell; width: 20%; vertical-align: top; text-align: center; padding-top: 5px;">
                                        <div style="font-size: 24px; font-weight: 950; color: ${actualProg === 100 ? '#FF4200' : '#001540'}; line-height: 1.1;">
                                            ${actualProg}%
                                        </div>
                                        ${isManual ? '<div style="font-size: 8px; font-weight: 900; background-color: #001540; color: white; display: inline-block; padding: 2px 6px; border-radius: 4px; margin-top: 4px;">MANUAL</div>' : ''}
                                    </div>

                                    <!-- Status -->
                                    <div style="display: table-cell; width: 15%; vertical-align: top; text-align: right; padding-top: 5px;">
                                        <div style="display: inline-block; padding: 6px 12px; border-radius: 100px; font-size: 9px; font-weight: 900; text-transform: uppercase; background-color: ${actualProg >= 100 ? '#E6FFFA' : (actualProg > 0 ? '#FFFAF0' : '#f1f5f9')}; color: ${actualProg >= 100 ? '#2D3748' : (actualProg > 0 ? '#FF4200' : '#94a3b8')};">
                                            ${actualProg >= 100 ? 'Feito' : (actualProg > 0 ? 'WIP' : 'Pendente')}
                                        </div>
                                    </div>
                                </div>
                                `
            }).join('')}
                        </div>
                    </div>

                    <!-- Final Footer Section -->
                    <div style="padding: 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
                        <p style="margin: 0; font-size: 10px; font-weight: 900; color: #cbd5e1; letter-spacing: 0.4em; text-transform: uppercase;">
                            Intelligence & Analytics Unit • 2025
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `;

            // Clean and prepare recipients
            const clean = (emails: string) => emails
                .split(/[,;\n]/)
                .map(e => e.trim())
                .filter(e => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return e.length > 0 && emailRegex.test(e);
                })
                .join(', ');

            const cleanedRecipients = clean(targetEmails);
            const cleanedCc = clean(ccEmails);

            if (!cleanedRecipients) {
                alert("Nenhum endereço de e-mail válido foi informado.");
                setSendingEmail(false);
                return;
            }

            await EmailService.sendEmail({
                to: cleanedRecipients,
                cc: cleanedCc || undefined,
                subject: `Relatório Estratégico ION - ${today}`,
                text: `Relatório de Performance: ${avgProgress}% de progresso médio nos ${objectives.length} objetivos.`,
                html: emailHtml
            });

            alert(`Sucesso! O relatório foi enviado para: ${cleanedRecipients}`)
            setEmailModal({ ...emailModal, open: false })
        } catch (error: any) {
            console.error("Failed to send email:", error)
            alert(`Falha no envio: ${error.message || 'Erro desconhecido'}`)
        } finally {
            setSendingEmail(false)
        }
    }


    const executeSendExecutiveReportEmail = async (targetEmails: string, ccEmails: string = "") => {
        console.log("[Reports] Triggering Executive Snapshot Email to:", targetEmails)

        // Ensure auth token is fresh
        try {
            const { auth } = await import("@/lib/firebase");
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }
        } catch (e) {
            console.warn("Auth token refresh failed, proceeding anyway:", e);
        }

        setSendingEmail(true)
        try {
            if (!dashboardData) return;

            const today = new Date().toLocaleDateString('pt-BR')

            const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div style="background-color: #001540; padding: 40px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em;">Snapshot Executivo</h1>
                        <p style="color: #3b82f6; margin-top: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Performance & Entregas • ${today}</p>
                    </div>

                    <!-- ACCESS CREDENTIALS (NEW TOP SECTION) -->
                    ${appAccessLink ? `
                    <div style="padding: 25px 40px; background-color: #f8fafc; border-bottom: 1px solid #f1f5f9; text-align: center;">
                        <div style="margin-bottom: 15px;">
                            <a href="${appAccessLink}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s;">
                                Visualizar no Sistema
                            </a>
                        </div>
                        ${accessCredentials ? `
                        <div style="font-size: 12px; color: #475569; font-weight: 800; background: #ffffff; border: 1.5px dashed #cbd5e1; padding: 10px 20px; border-radius: 12px; display: inline-block; font-family: 'Courier New', Courier, monospace;">
                            ${accessCredentials}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <div style="padding: 40px;">
                        <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 24px; margin-bottom: 30px;">
                            <div style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.2em;">Alcanço Médio</div>
                            <div style="font-size: 56px; font-weight: 900; color: #3b82f6; line-height: 1; margin: 10px 0;">${dashboardData.avgProgress}%</div>
                        </div>

                        <div>
                            <h3 style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 20px; letter-spacing: 0.1em;">Performance Trimestral (${dashboardData.year})</h3>
                            <div style="display: flex; gap: 8px; align-items: flex-end; height: 120px; background: #f8fafc; padding: 20px; border-radius: 20px;">
                                ${dashboardData.quarterlyData.map((q: any) => `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                        <div style="width: 100%; background: ${q.color}; height: ${Math.max(10, (q.count / Math.max(...dashboardData.quarterlyData.map((d: any) => d.count), 1)) * 100)}%; border-radius: 6px 6px 0 0;"></div>
                                        <div style="font-size: 11px; font-weight: 900; margin-top: 8px; color: #001540;">${q.count}</div>
                                        <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${q.quarter}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div style="padding: 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9;">
                        <div style="font-size: 10px; color: #cbd5e1; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase;">
                            ION DASHBOARD • STRATEGY ANALYTICS
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            // Clean and prepare recipients
            const clean = (emails: string) => emails
                .split(/[,;\n]/)
                .map(e => e.trim())
                .filter(e => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return e.length > 0 && emailRegex.test(e);
                })
                .join(', ');

            const cleanedRecipients = clean(targetEmails);
            const cleanedCc = clean(ccEmails);

            await EmailService.sendEmail({
                to: cleanedRecipients,
                cc: cleanedCc || undefined,
                subject: `Snapshot Executivo ION - ${today}`,
                text: `Alcanço de Performance: ${dashboardData.avgProgress}% médio em ${dashboardData.totalInitiatives} iniciativas.`,
                html: emailHtml
            });

            alert(`Sucesso! O resumo executivo foi enviado para: ${targetEmails}`)
            setEmailModal({ ...emailModal, open: false })
        } catch (error: any) {
            alert(`Falha no envio: ${error.message}`)
        } finally {
            setSendingEmail(false)
        }
    }

    const handleEmailExecutiveReport = async () => {
        if (!user?.email) return
        setEmailModal({ open: true, reportType: 'executive', defaultEmails: user.email })
        setRecipients(user.email)
    }

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
                                disabled={sendingEmail}
                                className="w-full justify-between font-black bg-[#001540] hover:bg-[#001540]/90 text-white dark:bg-[#FF4200] dark:hover:bg-[#FF4200]/90 h-14 rounded-2xl px-6 group-hover:scale-[1.02] transition-transform"
                            >
                                {sendingEmail ? 'ENVIANDO...' : 'GERAR RELATÓRIO'} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
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
                    onEmail={handleEmailReport}
                    jiraUrl={user?.jiraUrl || ""}
                />
            )}

            {/* Executive Report Overlay */}
            {showExecutiveReport && dashboardData && (
                <ExecutiveReport
                    data={dashboardData}
                    onClose={() => setShowExecutiveReport(false)}
                    onEmail={handleEmailExecutiveReport}
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

            {/* Email Modal */}
            {emailModal.open && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden border-none shadow-2xl">
                        <CardHeader className="bg-[#001540] text-white p-8">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Destinatários</CardTitle>
                            <CardDescription className="text-blue-200">Informe os e-mails para envio (separados por vírgula).</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Para: (Recipientes Principais)</label>
                                <textarea
                                    className="w-full h-24 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FF4200] transition-all"
                                    placeholder="email@empresa.com, email2@empresa.com"
                                    value={recipients}
                                    onChange={(e) => setRecipients(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cc: (Cópia para)</label>
                                <Input
                                    className="bg-slate-50 border-slate-100 rounded-xl h-12 text-sm font-medium"
                                    placeholder="email-copia@empresa.com"
                                    value={ccRecipients}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCcRecipients(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link de Acesso (App)</label>
                                <Input
                                    className="bg-slate-50 border-slate-100 rounded-xl h-11 text-xs font-medium text-blue-600"
                                    placeholder="https://..."
                                    value={appAccessLink}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppAccessLink(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credenciais de Acesso</label>
                                <Input
                                    className="bg-slate-50 border-slate-100 rounded-xl h-11 text-xs font-medium"
                                    placeholder="Login: user | Senha: pas..."
                                    value={accessCredentials}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccessCredentials(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200"
                                    onClick={() => setEmailModal({ ...emailModal, open: false })}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 h-12 rounded-xl font-black bg-[#001540] hover:bg-[#001540]/90 text-white uppercase text-[10px] tracking-widest shadow-lg shadow-blue-950/20"
                                    disabled={sendingEmail}
                                    onClick={() => {
                                        if (emailModal.reportType === 'strategic') executeSendStrategicEmail(recipients, ccRecipients);
                                        else executeSendExecutiveReportEmail(recipients, ccRecipients);
                                    }}
                                >
                                    {sendingEmail ? 'ENVIANDO...' : 'DISPARAR AGORA'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
