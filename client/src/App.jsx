import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { getFlatRoutes } from './routes/config'

function App() {
  const routes = getFlatRoutes()

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {routes.map((route) => {
            const RouteComponent = route.component

            // Public routes (no roles required)
            if (!route.roles) {
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<RouteComponent />}
                />
              )
            }

            // Protected routes (roles required)
            return (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <ProtectedRoute allowedRoles={route.roles}>
                    <RouteComponent />
                  </ProtectedRoute>
                }
              />
            )
          })}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
