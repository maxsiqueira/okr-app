import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, TrendingUp, Calendar, Printer, X, Mail } from 'lucide-react';
import { StrategicObjective } from '@/pages/StrategicObjectives';
import { Button } from '@/components/ui/button';

interface StrategicReportProps {
    objectives: StrategicObjective[];
    epicData: Record<string, any>;
    avgProgress: number;
    onClose: () => void;
    onEmail?: () => void;
}

export const StrategicReport: React.FC<StrategicReportProps> = ({ objectives, epicData, avgProgress, onClose, onEmail }) => {
    const today = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-white dark:bg-slate-950 overflow-y-auto print:p-0">
            {/* Toolbar - Hidden on Print */}
            <div className="sticky top-0 z-10 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg print:hidden">
                <div className="flex items-center gap-2">
                    <Target className="text-emerald-400" />
                    <span className="font-bold tracking-tight">RELATÓRIO ESTRATÉGICO</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={onEmail} className="bg-emerald-600/20 border-emerald-500/30 hover:bg-emerald-600/40 text-emerald-100 gap-2">
                        <Mail size={16} /> Enviar por E-mail
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/10 border-white/20 hover:bg-white/20 text-white gap-2">
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-emerald-500 pb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <Target size={28} />
                            </div>
                            <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">
                                Apuração <span className="text-emerald-600">Estratégica</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-medium text-lg">Consolidado de Entrega e Performance de Objetivos</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-400 font-bold uppercase text-xs tracking-widest mb-1">
                            <Calendar size={14} /> Data de Emissão
                        </div>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{today}</p>
                    </div>
                </div>

                {/* KPI Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Objetivos Analisados</p>
                        <h2 className="text-5xl font-black text-slate-800 dark:text-white">{objectives.length}</h2>
                    </div>
                    <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl shadow-emerald-200 dark:shadow-none flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100 mb-2 relative z-10">Percentual Apurado</p>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <h2 className="text-6xl font-black">{avgProgress}%</h2>
                            <TrendingUp className="text-emerald-200" size={24} />
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Metas Inclusas no Cálculo</p>
                        <h2 className="text-5xl font-black text-slate-800 dark:text-white">{objectives.filter(o => !o.excludeFromCalculation).length}</h2>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
                        <TrendingUp className="text-emerald-500" /> Detalhamento de Performance
                    </h3>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                <TableRow>
                                    <TableHead className="w-[40%] font-black text-slate-600 uppercase text-[10px] tracking-widest pl-6">Objetivo Estratégico</TableHead>
                                    <TableHead className="w-[15%] font-black text-slate-600 uppercase text-[10px] tracking-widest text-center">Iniciativas</TableHead>
                                    <TableHead className="w-[25%] font-black text-slate-600 uppercase text-[10px] tracking-widest">Progresso</TableHead>
                                    <TableHead className="w-[20%] text-right font-black text-slate-600 uppercase text-[10px] tracking-widest pr-6">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {objectives.map((obj) => {
                                    const progSum = obj.epicKeys.reduce((acc, key) => acc + (epicData[key]?.progress || 0), 0);
                                    const jiraProg = obj.epicKeys.length > 0 ? Math.round(progSum / obj.epicKeys.length) : 0;
                                    const totalProg = obj.suggestedProgress != null ? obj.suggestedProgress : jiraProg;
                                    const isManual = obj.suggestedProgress != null;

                                    return (
                                        <TableRow key={obj.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="py-6 pl-6 align-top">
                                                <p className="font-bold text-slate-800 dark:text-white text-base mb-2 leading-tight">{obj.title}</p>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{obj.description}</p>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-slate-600 dark:text-slate-400 py-6 align-top pt-8">
                                                <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                                                    {obj.epicKeys.length} PROJETOS
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-6 align-top pt-7">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`text-2xl font-black ${totalProg === 100 ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {totalProg}%
                                                    </span>
                                                    {isManual && (
                                                        <Badge className="text-[8px] font-black bg-slate-100 text-slate-500 border-none px-1.5 py-0">MANUAL</Badge>
                                                    )}
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div className={`h-full ${totalProg === 100 ? 'bg-emerald-500' : 'bg-emerald-600'} transition-all shadow-lg`} style={{ width: `${totalProg}%` }} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-6 pr-6 align-top pt-8">
                                                {obj.excludeFromCalculation ? (
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase text-rose-500 border-rose-200 bg-rose-50">Excluído do Cálculo</Badge>
                                                ) : (
                                                    <Badge className={`text-[10px] font-black uppercase px-3 py-1 ${totalProg >= 100 ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : totalProg > 0 ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        {totalProg >= 100 ? 'Concluído' : totalProg > 0 ? 'Em Andamento' : 'Iniciado'}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 text-slate-400 gap-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-center md:text-left">
                        Ion Dashboard • Intelligence & Strategy
                    </div>
                    <div className="text-[10px] font-medium italic text-center md:text-right">
                        Relatório gerado automaticamente para fins de auditoria e acompanhamento.
                    </div>
                </div>
            </div>

            {/* Print specific adjustments */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { 
                        size: A4 landscape; 
                        margin: 10mm; 
                    }
                    body { 
                        background: white !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print\:hidden { display: none !important; }
                    .print\:p-0 { padding: 0 !important; }
                    .print\:m-0 { margin: 0 !important; }
                    .print\:w-full { width: 100% !important; max-width: none !important; }
                }
            `}} />
        </div>
    );
};
