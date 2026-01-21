import { useEffect, useState } from "react"
import { Bug, X, ChevronDown, ChevronUp, Clock, Activity } from "lucide-react"
import { debugLogs } from "@/services/jira"

export function DebugOverlay() {
    const [isOpen, setIsOpen] = useState(false)
    const [logs, setLogs] = useState(debugLogs)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const checkVisible = () => setIsVisible(localStorage.getItem("debug_mode") === "true")
        checkVisible()

        const handleLog = () => {
            setLogs([...debugLogs])
            // Auto open on first log if closed
            if (!isOpen && debugLogs.length > 0) {
                // setIsOpen(true) // Optional: avoid annoying popups
            }
        }

        window.addEventListener('jira-debug-log', handleLog)
        window.addEventListener('storage', checkVisible)

        // Interval to check visibility (since storage event only fires from other tabs)
        const interval = setInterval(checkVisible, 1000)

        return () => {
            window.removeEventListener('jira-debug-log', handleLog)
            window.removeEventListener('storage', checkVisible)
            clearInterval(interval)
        }
    }, [isOpen])

    if (!isVisible) return null

    return (
        <div className={`fixed bottom-4 right-4 z-[9999] flex flex-col transition-all duration-300 ${isOpen ? "w-[500px] h-[400px]" : "w-auto h-auto"
            }`}>
            <div className={`bg-slate-950 text-slate-100 border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden h-full ${!isOpen && "hover:bg-slate-900"
                }`}>
                {/* Header */}
                <div
                    className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span className="text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                            Debug Engine
                            {logs.length > 0 && <span className="bg-amber-500 text-slate-950 px-1.5 rounded-full text-[10px]">{logs.length}</span>}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        <button onClick={(e) => {
                            e.stopPropagation()
                            localStorage.setItem("debug_mode", "false")
                            setIsVisible(false)
                        }} className="hover:text-red-400">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {isOpen && (
                    <div className="flex-grow overflow-auto p-4 space-y-4 font-mono text-[10px]">
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic space-y-2">
                                <Activity className="w-8 h-8 opacity-20" />
                                <p>Awaiting JQL activity...</p>
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="border-b border-slate-800/50 pb-3 last:border-0 hover:bg-slate-900/50 p-2 rounded transition-colors group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold px-1 rounded ${log.type.includes('ERROR') ? 'bg-red-900/50 text-red-400' :
                                                log.type === 'JQL_SEARCH' ? 'bg-blue-900/50 text-blue-400' : 'bg-emerald-900/50 text-emerald-400'
                                                }`}>
                                                {log.type}
                                            </span>
                                            <span className="text-slate-500">
                                                [{log.timestamp.split('T')[1].split('.')[0]}]
                                            </span>
                                        </div>
                                        {log.duration && (
                                            <div className="flex items-center gap-1 text-amber-400">
                                                <Clock size={10} />
                                                {log.duration}ms
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-slate-300 break-all">{log.message}</div>
                                    {log.jql && (
                                        <div className="mt-2 p-2 bg-black/40 rounded border border-slate-800 text-indigo-300 text-[9px] relative group-hover:border-indigo-500 transition-colors">
                                            <span className="absolute -top-2 left-2 px-1 bg-slate-950 text-slate-500 text-[8px uppercase font-bold]">JQL Query</span>
                                            {log.jql}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
