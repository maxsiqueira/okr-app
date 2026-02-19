import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import { lazy, Suspense } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Layout } from "@/components/layout/Layout"
import { DebugOverlay } from "@/components/DebugOverlay"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { SettingsProvider } from "./contexts/SettingsContext"
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
const Reports = lazy(() => import("@/pages/Reports"))
const Login = lazy(() => import("@/pages/Login"))
const Unauthorized = lazy(() => import("@/pages/Unauthorized"))

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  </div>
)

// Landing Redirect Logic
const LandingRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // God Mode
  if (user.role === 'admin') return <Navigate to="/strategic" replace />;

  // Find first allowed panel
  const allowedPanels = user.allowedPanels || [];

  // Ordered priority (same as sidebar)
  const routes: Record<string, string> = {
    'strategic': '/strategic',
    'strategic-objectives': '/strategic-objectives',
    'okr': '/okr',
    'analysis': '/epic-analysis',
    'extra-analysis': '/extra-analysis',
    'assessment': '/assessment',
    'manual-okrs': '/manual-okrs',
    'reports': '/reports',
    'settings': '/settings'
  };

  for (const [panelId, path] of Object.entries(routes)) {
    if (allowedPanels.includes(panelId)) {
      return <Navigate to={path} replace />;
    }
  }

  // Fallback: If user is authenticated but has no panels (should be fixed by AuthContext, but just in case)
  // Redirect to Strategic Dashboard as a safe default instead of Unauthorized
  return <Navigate to="/strategic" replace />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ion-ui-theme">
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<LandingRedirect />} />

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

                  <Route path="/reports" element={
                    <ProtectedRoute requiredPanel="reports">
                      <Reports />
                    </ProtectedRoute>
                  } />
                </Route>
              </Routes>
            </Suspense>
            <DebugOverlay />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
