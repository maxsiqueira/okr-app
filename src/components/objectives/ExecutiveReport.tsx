import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Printer, X, Rocket, Zap, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutiveReportProps {
    data: {
        totalInitiatives: number;
        avgProgress: number;
        q4Deliveries: number;
        successRate: string;
        quarterlyData: any[];
    };
    onClose: () => void;
}

export const ExecutiveReport: React.FC<ExecutiveReportProps> = ({ data, onClose }) => {
    const today = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    return (
        <div className="fixed inset-0 z-[10000] bg-white dark:bg-slate-950 overflow-y-auto print:p-0">
            {/* Toolbar */}
            <div className="sticky top-0 z-10 bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg print:hidden">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="text-blue-400" />
                    <span className="font-bold tracking-tight">RESUMO EXECUTIVO</span>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white/10 border-white/20 hover:bg-white/20 text-white gap-2">
                        <Printer size={16} /> Imprimir / PDF
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
                        <X size={20} />
                    </Button>
                </div>
            </div>

            {/* Report Content */}
            <div className="max-w-[210mm] mx-auto p-4 md:p-8 space-y-8 print:p-0 print:m-0 print:w-full print:max-w-none">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-blue-500 pb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <LayoutDashboard size={28} />
                            </div>
                            <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">
                                Report <span className="text-blue-600">Executivo</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-medium text-lg">Visão Macro de Performance e Entregas Estratégicas</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-1">Data de Emissão</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{today}</p>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <Rocket className="text-blue-500 mb-4" size={24} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Iniciativas</p>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white">{data.totalInitiatives}</h2>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <Target className="text-purple-500 mb-4" size={24} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Alcanço Médio</p>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white">{data.avgProgress}%</h2>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <Zap className="text-emerald-500 mb-4" size={24} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Entrega Q4</p>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white">{data.q4Deliveries}</h2>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <TrendingUp className="text-orange-500 mb-4" size={24} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Taxa de Sucesso</p>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white">{data.successRate}</h2>
                    </div>
                </div>

                {/* Quarterly Performance Section */}
                <div className="bg-slate-900 text-white rounded-[40px] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="space-y-4 max-w-sm">
                            <Badge className="bg-blue-500/20 text-blue-300 border-none px-3 py-1 font-black uppercase tracking-widest text-[10px]">Análise Temporal</Badge>
                            <h3 className="text-3xl font-black tracking-tight">Performance por Trimestre</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">Acompanhamento de volume de entregas concluídas em cada período do ano fiscal corrente.</p>
                        </div>
                        <div className="flex-1 w-full flex items-end justify-between gap-4 h-48">
                            {data.quarterlyData.map((q, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4">
                                    <div
                                        className="w-full rounded-t-2xl transition-all duration-1000"
                                        style={{
                                            height: `${(q.count / Math.max(...data.quarterlyData.map(d => d.count), 1)) * 100}%`,
                                            backgroundColor: q.color || '#3B82F6',
                                            opacity: 0.8
                                        }}
                                    />
                                    <div className="text-center">
                                        <p className="text-xl font-black">{q.count}</p>
                                        <p className="text-[10px] font-black uppercase text-slate-500">{q.quarter}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 text-slate-400">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em]">
                        Ion Dashboard • Intelligence & Strategy
                    </div>
                    <div className="text-[10px] font-medium italic">
                        Visão consolidada para apresentação em comitês executivos.
                    </div>
                </div>
            </div>

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
