import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { lazy, Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Layout } from "@/components/layout/Layout"
import { DebugOverlay } from "@/components/DebugOverlay"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"

// Lazy load all page components for better performance
const StrategicDashboard = lazy(() => import("@/pages/StrategicDashboard").then(m => ({ default: m.StrategicDashboard })))
const OkrTracking = lazy(() => import("@/pages/OkrTracking").then(m => ({ default: m.OkrTracking })))
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })))
const EpicAnalysis = lazy(() => import("@/pages/EpicAnalysis").then(m => ({ default: m.EpicAnalysis })))
const OkrAssessment = lazy(() => import("@/pages/OkrAssessment").then(m => ({ default: m.OkrAssessment })))
const StrategicObjectives = lazy(() => import("@/pages/StrategicObjectives").then(m => ({ default: m.StrategicObjectives })))
const ManualOkrs = lazy(() => import("@/pages/ManualOkrs").then(m => ({ default: m.ManualOkrs })))
const ExtraEpicAnalysis = lazy(() => import("@/pages/ExtraEpicAnalysis").then(m => ({ default: m.ExtraEpicAnalysis })))
const Login = lazy(() => import("@/pages/Login"))

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  </div>
)


function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ion-ui-theme">
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<Navigate to="/strategic" replace />} />

                <Route path="/strategic" element={
                  <ProtectedRoute requiredPanel="strategic">
                    <StrategicDashboard />
                  </ProtectedRoute>
                } />

                <Route path="/okr" element={
                  <ProtectedRoute requiredPanel="okr">
                    <OkrTracking />
                  </ProtectedRoute>
                } />

                <Route path="/epic-analysis" element={
                  <ProtectedRoute requiredPanel="analysis">
                    <EpicAnalysis />
                  </ProtectedRoute>
                } />

                <Route path="/assessment" element={
                  <ProtectedRoute requiredPanel="assessment">
                    <OkrAssessment />
                  </ProtectedRoute>
                } />

                <Route path="/strategic-objectives" element={
                  <ProtectedRoute requiredPanel="strategic-objectives">
                    <StrategicObjectives />
                  </ProtectedRoute>
                } />

                <Route path="/manual-okrs" element={
                  <ProtectedRoute requiredPanel="manual-okrs">
                    <ManualOkrs />
                  </ProtectedRoute>
                } />

                <Route path="/extra-analysis" element={
                  <ProtectedRoute requiredPanel="extra-analysis">
                    <ExtraEpicAnalysis />
                  </ProtectedRoute>
                } />

                <Route path="/settings" element={
                  <ProtectedRoute requiredPanel="settings">
                    <SettingsPage />
                  </ProtectedRoute>
                } />
              </Route>
            </Routes>
          </Suspense>
          <DebugOverlay />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
