
interface AnalysisContext {
    epics: any[]
    metrics?: any
}

export const AiService = {
    generateInsights: async (context: AnalysisContext): Promise<string> => {
        try {
            const rawKey = localStorage.getItem("gemini_api_key")
            const apiKey = rawKey?.trim()

            if (apiKey && apiKey !== "") {
                // Version marker to confirm user is running NEW code (v4)
                return await generateRealInsight(apiKey, context)
            } else {
                return generateHeuristicInsight(context)
            }
        } catch (error: any) {
            console.error("AI Service Error:", error)
            // Unique prefix to distinguish from old cached error message
            return `AI Error (v4): ${error.message}. Please check your API key.`
        }
    }
}

async function generateRealInsight(apiKey: string, context: AnalysisContext): Promise<string> {
    const totalEpics = context.epics.length
    const doneEpics = context.epics.filter(e => e.fields.status.statusCategory.key === 'done').length

    // Safety check for payload size
    const epicSummary = context.epics.slice(0, 10).map(e => ({
        key: e.key,
        summary: e.fields.summary,
        status: e.fields.status.name
    }))

    const prompt = `
        Analyze this Jira project:
        - Total Initiatives: ${totalEpics}
        - Completed: ${doneEpics}
        - Details: ${JSON.stringify(epicSummary)}
        
        Provide 3 strategic agile advice points. Max 100 words.
    `

    // Primary: Gemini 1.5 Flash (Most compatible across all tiers in 2026/2025)
    // Secondary: Gemini 1.5 Pro
    const models = [
        { id: 'gemini-1.5-flash', ver: 'v1' },
        { id: 'gemini-1.5-pro', ver: 'v1' }
    ]

    let finalError = ""

    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/${model.ver}/models/${model.id}:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
            } else {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData.error?.message || response.statusText;
                finalError = `[${model.id}] ${response.status} ${msg}`;

                if (response.status === 404) {
                    console.warn(`Model ${model.id} not found, trying fallback...`);
                    continue;
                }
                throw new Error(finalError);
            }
        } catch (e: any) {
            if (e.message.includes('404')) continue;
            throw e;
        }
    }

    throw new Error(finalError || "Model not found. Ensure your API key has access to Gemini 1.5 Flash.");
}

function generateHeuristicInsight(context: AnalysisContext): string {
    const total = context.epics.length
    if (total === 0) return "No active initiatives found. Consider planning your next quarter goals."
    const done = context.epics.filter(e => e.fields.status.statusCategory.key === 'done').length
    const progress = (done / total) * 100
    let insight = "**Simulation Mode (No API Key)**\n\n"
    if (progress < 20) {
        insight += "• **Early Stage**: Focus on removing blockers.\n"
    } else if (progress < 70) {
        insight += "• **Execution Phase**: Monitor Cycle Time.\n"
    } else {
        insight += "• **Closing Phase**: Plan next roadmap.\n"
    }
    insight += `• **Throughput**: ${done}/${total} delivered.`
    return insight
}
