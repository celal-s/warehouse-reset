import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect authenticated users to their appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin')
      } else if (user.role === 'employee') {
        navigate('/employee/scan')
      } else if (user.role === 'client' && user.client_code) {
        navigate(`/client/${user.client_code}`)
      }
    }
  }, [isAuthenticated, user, navigate])

  // Show login page for unauthenticated users
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ShipFifty Warehouse RESET</h1>
          <p className="mt-2 text-gray-600">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <Link
            to="/login"
            className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
