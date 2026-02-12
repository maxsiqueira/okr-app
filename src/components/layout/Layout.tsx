import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

import { AutoRefreshHandler } from "@/components/AutoRefreshHandler"

export function Layout({ children }: { children?: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="relative flex min-h-screen flex-col bg-background">
            <AutoRefreshHandler />
            <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <div className="flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
                {/* Backdrop for mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Fixed sidebar for mobile, sticky for desktop */}
                <aside className={`fixed top-14 left-0 z-50 h-[calc(100vh-3.5rem)] w-[240px] border-r bg-background transition-transform md:sticky md:top-14 md:block md:w-full md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <Sidebar onItemClick={() => setIsSidebarOpen(false)} />
                </aside>

                <main className="flex w-full flex-col overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6">
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    )
}
