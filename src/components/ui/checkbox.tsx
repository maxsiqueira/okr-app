import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, onCheckedChange, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (onCheckedChange) {
                onCheckedChange(e.target.checked)
            }
            if (onChange) {
                onChange(e)
            }
        }

        return (
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    className={cn(
                        "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                        className
                    )}
                    ref={ref}
                    onChange={handleChange}
                    {...props}
                />
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
