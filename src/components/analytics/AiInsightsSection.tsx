import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { AiService } from "@/services/ai";

interface AiInsightsSectionProps {
    epics: any[];
    strategicObjectives: any[];
    manualOkrs?: any[];
}

export function AiInsightsSection({ epics, strategicObjectives, manualOkrs = [] }: AiInsightsSectionProps) {
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);

    useEffect(() => {
        // Check global toggle from localStorage
        const checkToggle = () => {
            const enabled = localStorage.getItem("ion_enable_ai") !== "false";
            setIsEnabled(enabled);
        };

        checkToggle();
        window.addEventListener("ion-config-change", checkToggle);

        const q = query(collection(db, "historico_gemini"), orderBy("data_criacao", "desc"), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("AI Snapshot Update:", snapshot.size, "docs");
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setInsight(data.prompt_resultado);
            } else {
                console.log("AI Snapshot Empty - Clearing Insight");
                setInsight(null);
            }
        });

        return () => {
            unsubscribe();
            window.removeEventListener("ion-config-change", checkToggle);
        };
    }, []);

    const handleGenerate = async () => {
        setLoading(true);
        const result = await AiService.generateInsights({
            epics,
            strategicObjectives,
            manualOkrs
        });
        setInsight(result);
        await AiService.saveAnalysisResult(result);
        setLoading(false);
    };

    const handleClear = async () => {
        if (!confirm("Isso apagará a análise permanentemente do banco de dados para todos os usuários. Continuar?")) return;

        // Optimistic update: Clear UI immediately
        setInsight(null);
        setLoading(true);

        try {
            console.log("Clearing AI analysis from Firestore...");
            await AiService.clearGlobalAnalysis();
            console.log("AI analysis cleared successfully");
        } catch (error) {
            console.error("Error clearing AI analysis:", error);
            alert("Erro ao limpar análise. Verifique o console para detalhes.");
            // If it failed, we might want to reload or check snapshot, 
            // but for now keeping it cleared is safer than showing stale data stuck.
        } finally {
            setLoading(false);
        }
    };

    if (!isEnabled) return null;

    return (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-100 dark:border-indigo-900 border-2 overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 space-y-2 sm:space-y-0">
                <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-300 uppercase font-black">
                        <Sparkles className="h-5 w-5" /> AI Strategic Analyst
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground font-medium">
                        Análise de impacto e tendências baseada no Gemini 1.5 Flash.
                    </p>
                </div>
                {!insight && (
                    <Button
                        onClick={handleGenerate}
                        disabled={loading || epics.length === 0}
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 shadow-md font-bold uppercase text-[10px] tracking-widest px-6"
                    >
                        {loading ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : null}
                        {loading ? "Processando..." : "Gerar Insights"}
                    </Button>
                )}
            </CardHeader>
            {insight && (
                <CardContent className="pt-2">
                    <div className="prose dark:prose-invert text-xs max-w-none bg-white/60 dark:bg-black/40 p-5 rounded-2xl border border-indigo-100/50 shadow-inner">
                        {insight.split('\n').map((line, i) => {
                            if (!line.trim()) return <div key={i} className="h-2" />

                            const parts = line.split(/(\*\*.*?\*\*)/g)
                            const content = parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="text-indigo-900 dark:text-indigo-200">{part.slice(2, -2)}</strong>
                                }
                                return part
                            })

                            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                                return <p key={i} className="pl-4 mb-2 flex items-start gap-2 leading-relaxed"><span>•</span><span className="flex-1">{content}</span></p>
                            }

                            if (line.match(/^\d\./)) {
                                return <p key={i} className="font-black text-sm mt-6 mb-3 text-indigo-800 dark:text-indigo-400 border-b-2 border-indigo-100 dark:border-indigo-900/50 pb-2 flex items-center gap-2 uppercase tracking-wide">{content}</p>
                            }

                            return <p key={i} className="mb-3 leading-relaxed opacity-90">{content}</p>
                        })}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={loading}
                            className="text-[10px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 uppercase font-black tracking-widest"
                        >
                            Limpar Base de Dados
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerate}
                            disabled={loading}
                            className="text-[10px] uppercase font-black tracking-widest border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            {loading ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                            Recalcular
                        </Button>
                    </div>
                </CardContent>
            )}

            {/* Manual Test Section (Optional, only for Admin or specifically requested?) */}
            {/* Keeping it simple for now, but following the user's current logic in StrategicObjectives */}
        </Card>
    );
}
