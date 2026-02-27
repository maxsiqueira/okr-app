import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, TrendingUp, Calendar, Printer, X, Mail, Sparkles } from 'lucide-react';
import { StrategicObjective } from '@/pages/StrategicObjectives';
import { Button } from '@/components/ui/button';

interface StrategicReportProps {
    objectives: StrategicObjective[];
    epicData: Record<string, any>;
    avgProgress: number;
    onClose: () => void;
    onEmail?: () => void;
    jiraUrl?: string;
}

export const StrategicReport: React.FC<StrategicReportProps> = ({ objectives, epicData, avgProgress, onClose, onEmail, jiraUrl }) => {
    const today = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-white dark:bg-slate-950 overflow-y-auto print:p-0 font-poppins">
            {/* Toolbar - Hidden on Print */}
            <div className="sticky top-0 z-10 bg-[#001540] text-white p-4 flex justify-between items-center shadow-lg print:hidden">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                        <Target className="text-white" size={18} />
                    </div>
                    <span className="font-bold tracking-tight text-sm">RELATÓRIO ESTRATÉGICO</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={onEmail} className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2 rounded-lg border">
                        <Mail size={16} /> Enviar por E-mail
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/10 border-white/20 hover:bg-white/20 text-white gap-2 rounded-lg border">
                        <Printer size={16} /> Imprimir / PDF
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                        <X size={20} />
                    </Button>
                </div>
            </div>

            {/* Report Content */}
            <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6 print:p-0 print:m-0 print:w-full print:max-w-none">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-8 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#FF4200] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-200 dark:shadow-none">
                            <Target size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-[#001540] dark:text-white tracking-tighter uppercase leading-none">
                                APURAÇÃO <span className="text-[#FF4200]">ESTRATÉGICA</span>
                            </h1>
                            <p className="text-slate-400 font-bold text-lg mt-1">Consolidado de Performance & OKRs</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">
                            <Calendar size={12} className="text-[#FF4200]" /> DATA DE EMISSÃO
                        </div>
                        <p className="text-2xl font-black text-[#001540] dark:text-slate-300">{today}</p>
                    </div>
                </div>

                {/* KPI Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">OBJETIVOS ANALISADOS</p>
                        <h2 className="text-7xl font-black text-[#001540] dark:text-white leading-none">9</h2>
                    </div>

                    <div className="bg-[#FF4200] p-8 rounded-[40px] text-white shadow-2xl shadow-orange-200 dark:shadow-none flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-2 relative z-10">PERCENTUAL APURADO</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <h2 className="text-8xl font-black leading-none">{avgProgress}%</h2>
                            <TrendingUp className="text-white/50" size={32} />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">METAS NO CÁLCULO</p>
                        <h2 className="text-7xl font-black text-[#001540] dark:text-white leading-none">8</h2>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center">
                            <TrendingUp className="text-[#FF4200]" size={18} />
                        </div>
                        <h3 className="text-xl font-black text-[#001540] dark:text-white uppercase tracking-tight">
                            DETALHAMENTO DE PERFORMANCE
                        </h3>
                    </div>

                    <div className="overflow-hidden rounded-[30px] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50">
                        <Table>
                            <TableHeader className="bg-[#001540]">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="py-5 font-black text-white/60 uppercase text-[10px] tracking-widest pl-8">OBJETIVO ESTRATÉGICO</TableHead>
                                    <TableHead className="py-5 font-black text-white/60 uppercase text-[10px] tracking-widest text-center">INICIATIVAS</TableHead>
                                    <TableHead className="py-5 font-black text-white/60 uppercase text-[10px] tracking-widest text-center">ESFORÇO (HORAS)</TableHead>
                                    <TableHead className="py-5 font-black text-white/60 uppercase text-[10px] tracking-widest">PROGRESSO</TableHead>
                                    <TableHead className="py-5 text-right font-black text-white/60 uppercase text-[10px] tracking-widest pr-8">STATUS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {objectives.map((obj) => {
                                    const progSum = obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.progress || 0), 0);
                                    const jiraProg = obj.epicKeys.length > 0 ? Math.round(progSum / obj.epicKeys.length) : 0;
                                    const totalProg = obj.suggestedProgress != null ? obj.suggestedProgress : jiraProg;
                                    const isManual = obj.suggestedProgress != null;

                                    return (
                                        <TableRow key={obj.id} className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50 transition-colors">
                                            <TableCell className="py-8 pl-8 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <p className="font-black text-[#001540] dark:text-white text-lg leading-tight uppercase">{obj.title}</p>
                                                    <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-md">{obj.description}</p>

                                                    {/* Tickets / Stories Section */}
                                                    <div className="flex flex-wrap gap-1.5 mt-3 max-w-xl">
                                                        {obj.epicKeys.flatMap(key => {
                                                            const epicInfo = epicData[key];
                                                            if (!epicInfo || !epicInfo.children) return [];
                                                            return epicInfo.children.map((child: any) => ({
                                                                key: child.key,
                                                                summary: child.fields.summary,
                                                                status: child.fields.status?.name,
                                                                statusColor: child.fields.status?.statusCategory?.key === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                                                            }));
                                                        }).sort((a: any, b: any) => a.key.localeCompare(b.key)).map((ticket: any) => (
                                                            <a
                                                                key={ticket.key}
                                                                href={jiraUrl ? `https://${jiraUrl.replace('https://', '').replace(/\/$/, '')}/browse/${ticket.key}` : '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold transition-all hover:scale-105 active:scale-95 border ${ticket.statusColor} print:border-slate-200 print:text-black`}
                                                                title={ticket.summary}
                                                            >
                                                                {ticket.key}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center py-8 align-top">
                                                <Badge className="bg-[#F0F4F8] text-[#4A5568] border-none font-bold text-[10px] px-3 py-1 rounded-full uppercase">
                                                    {obj.epicKeys.length} PROJETOS
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center py-8 align-top">
                                                <span className="text-xl font-black text-[#001540] dark:text-slate-300">
                                                    {obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.hours || 0), 0).toFixed(1)}h
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-8 align-top">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`text-4xl font-black ${totalProg === 100 ? 'text-[#FF4200]' : 'text-[#001540] dark:text-slate-300'}`}>
                                                        {totalProg}%
                                                    </span>
                                                    {isManual && (
                                                        <Badge className="bg-[#001540] text-white text-[8px] font-black border-none px-2 py-0.5 rounded-full">MANUAL</Badge>
                                                    )}
                                                </div>
                                                <div className="w-48 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                                    <div className={`h-full bg-[#001540] transition-all duration-1000 ease-out shadow-lg`} style={{ width: `${totalProg}%` }} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-8 pr-8 align-top">
                                                <Badge className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-none ${totalProg >= 100
                                                    ? 'bg-[#E6FFFA] text-[#2D3748]'
                                                    : totalProg > 0
                                                        ? 'bg-[#FFFAF0] text-[#FF4200]'
                                                        : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    {totalProg >= 100 ? 'CONCLUÍDO' : totalProg > 0 ? 'EM ANDAMENTO' : 'PENDENTE'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 text-slate-300 gap-4 pb-10">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-[#FF4200] rounded-full flex items-center justify-center">
                            <Sparkles size={10} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">ION SISTEMAS • STRATEGY 2025</span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {today} • Intelligence & Analytics
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .print\\:hidden { display: none !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:m-0 { margin: 0 !important; }
                    .print\\:w-full { width: 100% !important; max-width: none !important; }
                    .rounded-\\[40px\\] { border-radius: 20px !important; }
                    .shadow-2xl, .shadow-xl { box-shadow: none !important; border: 1px solid #f1f5f9 !important; }
                    #001540 { color: #000 !important; }
                    #FF4200 { color: #FF4200 !important; }
                }
            `}} />
        </div>
    );
};
