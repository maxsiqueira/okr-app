
interface AnalysisContext {
    epics: any[]
    metrics?: any
}

export const AiService = {
    generateInsights: async (context: AnalysisContext): Promise<string> => {
        const apiKey = localStorage.getItem("gemini_api_key")

        if (apiKey && apiKey.trim() !== "") {
            return await generateRealInsight(apiKey, context)
        } else {
            return generateHeuristicInsight(context)
        }
    }
}

async function generateRealInsight(apiKey: string, context: AnalysisContext): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    // Prepare a concise prompt
    const totalEpics = context.epics.length
    const doneEpics = context.epics.filter(e => e.fields.status.statusCategory.key === 'done').length
    const prompt = `
        You are an elite agile project manager. Analyze the following project data and give 3 bullet points of strategic advice.
        Data:
        - Total Initiatives: ${totalEpics}
        - Completed: ${doneEpics}
        - Detailed items: ${JSON.stringify(context.epics.map(e => ({ key: e.key, summary: e.fields.summary, status: e.fields.status.name })))}
        
        Keep it concise, professional, and actionable. Max 100 words.
    `

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status}`)
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return text || "AI could not generate a response.";
    } catch (error: any) {
        console.error("AI Generation Failed:", error)
        return `Failed to connect to AI Analyst: ${error.message}. Switching to manual analysis.`
    }
}

function generateHeuristicInsight(context: AnalysisContext): string {
    const total = context.epics.length
    if (total === 0) return "No active initiatives found. Consider planning your next quarter goals."

    const done = context.epics.filter(e => e.fields.status.statusCategory.key === 'done').length
    const progress = (done / total) * 100

    let insight = "**Simulation Mode (No API Key)**\n\n"

    if (progress < 20) {
        insight += "• **Early Stage**: Most initiatives are just starting. Focus on removing blockers.\n"
        insight += "• **Risk**: Low delivery rate suggests potential bottlenecks in the pipeline.\n"
    } else if (progress < 70) {
        insight += "• **Execution Phase**: The team is in the flow. Ensure quality benchmarks are met.\n"
        insight += "• **Focus**: Monitor Cycle Time to prevent scope creep.\n"
    } else {
        insight += "• **Closing Phase**: High completion rate. Start planning the next roadmap.\n"
        insight += "• **Win**: Celebrate the delivered value!\n"
    }

    insight += `• **Throughput**: ${done}/${total} initiatives delivered. Maintain this velocity.`

    return insight
}
