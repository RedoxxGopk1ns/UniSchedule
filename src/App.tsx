import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/layout/AdminRoute'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { ToastProvider } from './components/ui/Toast'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AuthCallback } from './pages/AuthCallback'
import { Dashboard } from './pages/Dashboard'
import { LandingPage } from './pages/LandingPage'
import { Privacy } from './pages/Privacy'
import { SelectCourses } from './pages/SelectCourses'
import { useAuthStore } from './store/authStore'

/** Routes per §7. */
function AppRoutes() {
  const initialise = useAuthStore((s) => s.initialise)

  useEffect(() => initialise(), [initialise])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/select-courses"
        element={
          <ProtectedRoute>
            <SelectCourses mode="select" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/edit-schedule"
        element={
          <ProtectedRoute>
            <SelectCourses mode="edit" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  )
}
