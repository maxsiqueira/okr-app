
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface AnalysisContext {
    epics: any[]
    strategicObjectives?: any[]
    manualOkrs?: any[]
    metrics?: any
}

export const AiService = {
    generateInsights: async (context: AnalysisContext): Promise<string> => {
        try {
            const rawKey = localStorage.getItem("gemini_api_key")
            const apiKey = rawKey?.trim()

            const prompt = `Analise os seguintes dados OKR da ION Sistemas e gere um relatório executivo PT-BR estruturado (1. Sumário, 2. Progresso Real, 3. Riscos). 
            Dados: Iniciativas Jira: ${JSON.stringify(context.epics.slice(0, 30).map(e => ({ key: e.key, summary: e.fields.summary, status: e.fields.status.name, progress: e.progress })))}, Objetivos: ${JSON.stringify(context.strategicObjectives || [])}`;

            if (apiKey && apiKey !== "") {
                return await callGemini(apiKey, prompt)
            } else {
                return generateHeuristicInsight(context)
            }
        } catch (error: any) {
            console.error("AI Service Error:", error)
            return `AI Error (v8): ${error.message}. Verifique sua chave no Google AI Studio (aistudio.google.com).`
        }
    },

    processAndSaveIA: async (userPrompt: string): Promise<string> => {
        try {
            const rawKey = localStorage.getItem("gemini_api_key")
            const apiKey = rawKey?.trim()

            if (!apiKey) throw new Error("Chave Gemini não configurada.");

            // 1. Chame a API do Gemini para gerar a análise
            const result = await callGemini(apiKey, userPrompt);

            // 2. Salve imediatamente no Firestore
            await addDoc(collection(db, "historico_ia"), {
                prompt: userPrompt,
                resposta: result,
                timestamp: serverTimestamp(),
                autor: "Maximilian"
            });

            console.log("Dado gravado com sucesso no banco remoto do Google Cloud (gen-lang-client-06714236-467f1).");
            return result;
        } catch (e) {
            console.error("Erro ao processar e salvar IA:", e);
            throw e;
        }
    },

    saveAnalysisResult: async (analiseTexto: string) => {
        try {
            await addDoc(collection(db, "historico_gemini"), {
                prompt_resultado: analiseTexto,
                data_criacao: serverTimestamp(),
                usuario: "Maximilian",
                contexto: "Análise de OKRs Ponto Ion"
            });
            console.log("Análise salva no Firestore!");
        } catch (e) {
            console.error("Erro ao salvar no banco:", e);
        }
    }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
    /**
     * ESTRATÉGIA DE AUTODESCORBERTA (v8)
     */
    try {
        console.log("AI Service (v8): Iniciando autodescoberta de modelos...");
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (listRes.ok) {
            const listData = await listRes.json();
            const availableModels = listData.models || [];

            const bestModel = availableModels.find((m: any) => m.name.includes("gemini-1.5-flash") && m.supportedGenerationMethods.includes("generateContent"))
                || availableModels.find((m: any) => m.name.includes("gemini-1.5-pro") && m.supportedGenerationMethods.includes("generateContent"))
                || availableModels.find((m: any) => m.supportedGenerationMethods.includes("generateContent"));

            if (bestModel) {
                console.log(`AI Service (v8): Modelo selecionado automaticamente: ${bestModel.name}`);
                const url = `https://generativelanguage.googleapis.com/v1beta/${bestModel.name}:generateContent?key=${apiKey}`;
                const genRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                if (genRes.ok) {
                    const data = await genRes.json();
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro na resposta do modelo.";
                }
            }
        }
    } catch (e) {
        console.error("AI Service (v8): Erro durante autodescoberta", e);
    }

    // FALLBACK MANUAL
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro no fallback.";
    }

    const finalErr = await res.json().catch(() => ({}));
    throw new Error(`Acesso Negado ou Modelo Indisponível. ${finalErr.error?.message || res.statusText}`);
}

function generateHeuristicInsight(context: AnalysisContext): string {
    const total = context.epics.length
    if (total === 0) return "Nenhuma iniciativa ativa encontrada."
    const done = context.epics.filter(e => e.fields.status.statusCategory.key === 'done').length
    return `**Modo Simulação local**\n\n• Iniciativas entregues: ${done}/${total}.`
}
