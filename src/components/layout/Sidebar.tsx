import { BarChart3, LayoutDashboard, Settings, Percent, Target, Edit3, Layers, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Badge } from "@/components/ui/badge"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onItemClick?: () => void
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
    const location = useLocation()
    const pathname = location.pathname
    const { user } = useAuth()

    const canAccess = (panelId: string) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return user.allowedPanels?.includes(panelId);
    }

    const NavLink = ({
        to,
        children,
        active,
        badge
    }: {
        to: string,
        children: React.ReactNode,
        active: boolean,
        badge?: { text: string, variant: "new" | "hot" | "info" }
    }) => (
        <Link
            to={to}
            onClick={onItemClick}
            className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                    ? "bg-realestate-primary-500/10 text-realestate-primary-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
        >
            {/* Active indicator */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-realestate-primary-500 rounded-r-full" />
            )}

            <div className="flex items-center gap-3 flex-1">
                {children}
            </div>

            {badge && (
                <Badge variant={badge.variant} size="sm" className="ml-auto">
                    {badge.text}
                </Badge>
            )}
        </Link>
    )

    if (!user) return null;

    return (
        <div className={cn("pb-12 h-full bg-gradient-sidebar", className)}>
            {/* Logo Section */}
            <div className="px-6 py-6 border-b border-white/10">
                <Link to="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-realestate-primary-500">
                        <Home className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-bold text-white">Ion Dashboard</span>
                        <span className="text-xs text-slate-400">Strategic OKR</span>
                    </div>
                </Link>
            </div>

            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Dashboard
                    </h2>
                    <div className="space-y-1">
                        {canAccess('strategic') && (
                            <NavLink to="/strategic" active={pathname === "/strategic" || pathname === "/"}>
                                <LayoutDashboard className="h-4 w-4" />
                                <span>Strategic Overview</span>
                            </NavLink>
                        )}
                        {canAccess('strategic-objectives') && (
                            <NavLink to="/strategic-objectives" active={pathname === "/strategic-objectives"}>
                                <Target className="h-4 w-4" />
                                <span>Strategic Objectives</span>
                            </NavLink>
                        )}
                        {canAccess('okr') && (
                            <NavLink to="/okr" active={pathname === "/okr"}>
                                <BarChart3 className="h-4 w-4" />
                                <span>OKR Tracking</span>
                            </NavLink>
                        )}
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="px-3 py-2 border-t border-white/10 pt-4">
                    <h2 className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Analysis
                    </h2>
                    <div className="space-y-1">
                        {canAccess('analysis') && (
                            <NavLink
                                to="/epic-analysis"
                                active={pathname === "/epic-analysis"}
                                badge={{ text: "NEW", variant: "new" }}
                            >
                                <BarChart3 className="h-4 w-4" />
                                <span>Epic Analysis</span>
                            </NavLink>
                        )}
                        {canAccess('extra-analysis') && (
                            <NavLink to="/extra-analysis" active={pathname === "/extra-analysis"}>
                                <Layers className="h-4 w-4" />
                                <span>Extra Initiatives</span>
                            </NavLink>
                        )}
                        {canAccess('assessment') && (
                            <NavLink to="/assessment" active={pathname === "/assessment"}>
                                <Percent className="h-4 w-4" />
                                <span>Results Assessment</span>
                            </NavLink>
                        )}
                    </div>
                </div>

                {/* Management Section */}
                <div className="px-3 py-2 border-t border-white/10 pt-4">
                    <h2 className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Management
                    </h2>
                    <div className="space-y-1">
                        {canAccess('manual-okrs') && (
                            <NavLink to="/manual-okrs" active={pathname === "/manual-okrs"}>
                                <Edit3 className="h-4 w-4" />
                                <span>Manual OKRs</span>
                            </NavLink>
                        )}
                        {canAccess('settings') && (
                            <NavLink to="/settings" active={pathname === "/settings"}>
                                <Settings className="h-4 w-4" />
                                <span>Settings</span>
                            </NavLink>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

