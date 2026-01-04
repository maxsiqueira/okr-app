import { BarChart3, LayoutDashboard, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation()
    const pathname = location.pathname

    return (
        <div className={cn("pb-12", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Dashboard
                    </h2>
                    <div className="space-y-1">
                        <Link to="/strategic">
                            <button className={cn(
                                "w-full flex items-center rounded-md px-4 py-2 font-medium transition-colors hover:bg-secondary/50",
                                pathname === "/strategic" || pathname === "/" ? "bg-secondary" : "border-transparent"
                            )}>
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Strategic Overview
                            </button>
                        </Link>
                        <Link to="/okr">
                            <button className={cn(
                                "w-full flex items-center rounded-md px-4 py-2 font-medium transition-colors hover:bg-secondary/50",
                                pathname === "/okr" ? "bg-secondary" : "border-transparent"
                            )}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                OKR Tracking
                            </button>
                        </Link>
                        <Link to="/epic-analysis">
                            <button className={cn(
                                "w-full flex items-center rounded-md px-4 py-2 font-medium transition-colors hover:bg-secondary/50 text-left",
                                pathname === "/epic-analysis" ? "bg-secondary" : "border-transparent"
                            )}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Epic Analysis
                            </button>
                        </Link>
                        <Link to="/settings">
                            <button className={cn(
                                "w-full flex items-center rounded-md px-4 py-2 font-medium transition-colors hover:bg-secondary/50 text-left",
                                pathname === "/settings" ? "bg-secondary" : "border-transparent"
                            )}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
