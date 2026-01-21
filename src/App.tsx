import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { Layout } from "@/components/layout/Layout"
import { StrategicDashboard } from "@/pages/StrategicDashboard"
import { OkrTracking } from "@/pages/OkrTracking"
import { SettingsPage } from "@/pages/SettingsPage"
import { EpicAnalysis } from "@/pages/EpicAnalysis"
import { DebugOverlay } from "@/components/DebugOverlay"

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ion-ui-theme">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/strategic" replace />} />
            <Route path="/strategic" element={<StrategicDashboard />} />
            <Route path="/okr" element={<OkrTracking />} />
            <Route path="/epic-analysis" element={<EpicAnalysis />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
        <DebugOverlay />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
