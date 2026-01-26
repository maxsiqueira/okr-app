
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

            if (apiKey && apiKey !== "") {
                // Version marker (v8 - Autodiscovery Mode)
                return await generateRealInsight(apiKey, context)
            } else {
                return generateHeuristicInsight(context)
            }
        } catch (error: any) {
            console.error("AI Service Error:", error)
            return `AI Error (v8): ${error.message}. Verifique sua chave no Google AI Studio (aistudio.google.com).`
        }
    }
}

async function generateRealInsight(apiKey: string, context: AnalysisContext): Promise<string> {
    const inputData = context.epics.map(e => ({
        key: e.key,
        summary: e.fields.summary,
        status: e.fields.status.name,
        progress: e.progress
    }));

    const prompt = `Analise os seguintes dados OKR da ION Sistemas e gere um relatório executivo PT-BR estruturado (1. Sumário, 2. Progresso Real, 3. Riscos). 
    Dados: Iniciativas Jira: ${JSON.stringify(inputData.slice(0, 30))}, Objetivos: ${JSON.stringify(context.strategicObjectives || [])}`;

    /**
     * ESTRATÉGIA DE AUTODESCORBERTA (v8)
     * Em vez de adivinhar o ID do modelo (que varia por região/conta),
     * primeiro perguntamos ao Google quais modelos esta chave PODE usar.
     */
    try {
        console.log("AI Service (v8): Iniciando autodescoberta de modelos...");
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (listRes.ok) {
            const listData = await listRes.json();
            const availableModels = listData.models || [];

            // Filtra modelos que suportam geração de conteúdo e prioriza Flash > Pro
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
            } else {
                console.warn("AI Service (v8): Nenhum modelo compatível encontrado na lista.");
            }
        } else {
            const errData = await listRes.json().catch(() => ({}));
            console.error("AI Service (v8): Falha ao listar modelos", errData);
        }
    } catch (e) {
        console.error("AI Service (v8): Erro durante autodescoberta", e);
    }

    // FALLBACK MANUAL (Se a autodescoberta falhar)
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
