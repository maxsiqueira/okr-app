import { Moon, Sun, Menu, LogOut, Search, Bell, Maximize, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import { useAuth } from "@/contexts/AuthContext"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

interface HeaderProps {
    onToggleSidebar?: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
    const { theme, setTheme } = useTheme()
    const { user } = useAuth()
    const { i18n, t } = useTranslation()
    const navigate = useNavigate()

    const handleLogout = async () => {
        if (!window.confirm(t('header.logout_confirm', "Tem certeza que deseja sair?"))) return

        try {
            await signOut(auth)
            navigate("/login")
        } catch (error) {
            console.error("Erro ao fazer logout:", error)
            alert(t('header.logout_error', "Erro ao fazer logout. Tente novamente."))
        }
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
        } else {
            document.exitFullscreen()
        }
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-slate-900 shadow-sm">
            <div className="px-4 flex h-16 items-center justify-between gap-4">
                {/* Left side - Menu and Search */}
                <div className="flex items-center gap-3 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={onToggleSidebar}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    {/* Search Bar */}
                    <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder={t('common.search', "Search...")}
                                className="pl-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            />
                        </div>
                    </div>
                </div>

                {/* Right side - Actions and User */}
                <div className="flex items-center gap-2">
                    {/* Action Icons */}
                    <div className="hidden lg:flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 dark:text-slate-400"
                            onClick={toggleFullscreen}
                        >
                            <Maximize className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 dark:text-slate-400"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                            {theme === 'dark' ? (
                                <Sun className="h-4 w-4" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-600 dark:text-slate-400 relative"
                        >
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-realestate-primary-500 rounded-full" />
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 gap-2 px-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <Languages className="h-4 w-4" />
                                    <span className="text-[10px] uppercase tracking-wider">{i18n.language.split('-')[0]}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 p-1">
                                <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400 tracking-widest px-2 py-1.5">Idioma / Language</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => i18n.changeLanguage('pt')}
                                    className={cn("flex items-center gap-2 cursor-pointer p-2 rounded-lg text-xs font-bold", i18n.language.startsWith('pt') ? "bg-slate-100" : "")}
                                >
                                    <span className="text-base">🇧🇷</span> Português (BR)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => i18n.changeLanguage('en')}
                                    className={cn("flex items-center gap-2 cursor-pointer p-2 rounded-lg text-xs font-bold", i18n.language.startsWith('en') ? "bg-slate-100" : "")}
                                >
                                    <span className="text-base">🇺🇸</span> English (US)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Mobile Theme Toggle */}
                    <div className="lg:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        >
                            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        </Button>
                    </div>

                    {/* User Menu */}
                    {user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 gap-2 px-2">
                                    <div className="h-7 w-7 rounded-full bg-gradient-realestate-blue flex items-center justify-center text-white text-xs font-bold">
                                        {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                                    </div>
                                    <span className="hidden md:inline text-sm font-medium">
                                        {user.displayName || "User"}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user.displayName || t('common.user', "Usuário")}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user.email}
                                        </p>
                                        <p className="text-xs leading-none text-muted-foreground mt-1">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${user.role === 'admin'
                                                ? 'bg-gradient-realestate-purple text-white'
                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 cursor-pointer">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>{t('header.logout', "Sair")}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    )
}

