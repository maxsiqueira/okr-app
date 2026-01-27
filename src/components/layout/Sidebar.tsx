import { BarChart3, LayoutDashboard, Settings, Percent, Target, Edit3, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onItemClick?: () => void
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
    const location = useLocation()
    const pathname = location.pathname

    const NavLink = ({ to, children, active }: { to: string, children: React.ReactNode, active: boolean }) => (
        <Link
            to={to}
            onClick={onItemClick}
            className={cn(
                "w-full flex items-center rounded-md px-4 py-2 font-medium transition-colors hover:bg-secondary/50",
                active ? "bg-secondary" : "transparent"
            )}
        >
            {children}
        </Link>
    )

    return (
        <div className={cn("pb-12 h-full", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                        Dashboard
                    </h2>
                    <div className="space-y-1">
                        <NavLink to="/strategic" active={pathname === "/strategic" || pathname === "/"}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Strategic Overview
                        </NavLink>
                        <NavLink to="/strategic-objectives" active={pathname === "/strategic-objectives"}>
                            <Target className="mr-2 h-4 w-4" />
                            Strategic Objectives
                        </NavLink>
                        <NavLink to="/okr" active={pathname === "/okr"}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            OKR Tracking
                        </NavLink>
                        <NavLink to="/epic-analysis" active={pathname === "/epic-analysis"}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Epic Analysis
                        </NavLink>
                        <NavLink to="/extra-analysis" active={pathname === "/extra-analysis"}>
                            <Layers className="mr-2 h-4 w-4" />
                            Extra Initiatives
                        </NavLink>
                        <NavLink to="/assessment" active={pathname === "/assessment"}>
                            <Percent className="mr-2 h-4 w-4" />
                            Results Assessment
                        </NavLink>
                        <NavLink to="/manual-okrs" active={pathname === "/manual-okrs"}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            Manual OKRs
                        </NavLink>
                        <NavLink to="/settings" active={pathname === "/settings"}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </NavLink>
                    </div>
                </div>
            </div>
        </div>
    )
}
