import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: "text-foreground",
                success:
                    "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
                warning:
                    "border-transparent bg-amber-500 text-white hover:bg-amber-600",
                info:
                    "border-transparent bg-finlab-blue-500 text-white hover:bg-finlab-blue-600",
                finlab:
                    "border-transparent bg-gradient-finlab text-white shadow-finlab hover:shadow-finlab-lg",
                new:
                    "border-transparent bg-gradient-to-r from-finlab-pink-500 to-finlab-purple-500 text-white animate-pulse-slow",
                hot:
                    "border-transparent bg-gradient-to-r from-amber-500 to-red-500 text-white",
            },
            size: {
                sm: "px-2 py-0.5 text-[10px]",
                md: "px-2.5 py-0.5 text-xs",
                lg: "px-3 py-1 text-sm",
            }
        },
        defaultVariants: {
            variant: "default",
            size: "md",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
