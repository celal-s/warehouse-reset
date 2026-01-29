import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role permissions if allowedRoles is specified
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on user's actual role
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin" replace />
      case 'manager':
        return <Navigate to="/manager" replace />
      case 'employee':
        return <Navigate to="/employee/scan" replace />
      case 'client':
        return <Navigate to={`/client/${user.client_code}`} replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  return children
}
