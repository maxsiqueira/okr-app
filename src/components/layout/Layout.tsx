import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex min-h-screen flex-col bg-background">
            <Header />
            <div className="flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 overflow-y-auto border-r md:sticky md:block">
                    <Sidebar />
                </aside>
                <main className="flex w-full flex-col overflow-hidden p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
