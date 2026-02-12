import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    trend?: {
        value: number
        isPositive: boolean
    }
    gradient?: "blue" | "purple" | "green" | "orange"
    className?: string
}

export function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    gradient = "blue",
    className
}: StatCardProps) {
    const gradientClasses = {
        blue: "bg-gradient-realestate-blue",
        purple: "bg-gradient-realestate-purple",
        green: "bg-gradient-realestate-green",
        orange: "bg-gradient-realestate-orange"
    }

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-xl p-6 text-white shadow-stat-card transition-all duration-300 hover:shadow-realestate-lg hover:scale-[1.02]",
                gradientClasses[gradient],
                className
            )}
        >
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

            {/* Icon */}
            <div className="absolute right-6 top-6 opacity-20">
                <Icon className="h-12 w-12" />
            </div>

            {/* Content */}
            <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
                    {title}
                </p>
                <div className="mt-2 flex items-end gap-2">
                    <h3 className="text-3xl font-bold tracking-tight">
                        {value}
                    </h3>
                    {trend && (
                        <div className={cn(
                            "mb-1 flex items-center gap-1 text-xs font-semibold",
                            trend.isPositive ? "text-white/90" : "text-white/70"
                        )}>
                            <span>{trend.isPositive ? "↑" : "↓"}</span>
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
