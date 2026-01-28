import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getClients } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getClients()
      .then(setClients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ShipFifty Warehouse RESET</h1>
          <p className="mt-2 text-gray-600">
            {isAuthenticated ? `Welcome, ${user?.name}` : 'Sign in to continue'}
          </p>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Employee */}
          <Link
            to="/employee/scan"
            className="block w-full p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Warehouse Employee</h2>
                <p className="text-sm text-gray-500">Scan items, manage inventory</p>
              </div>
            </div>
          </Link>

          {/* Admin */}
          <Link
            to="/admin"
            className="block w-full p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-green-500"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Admin</h2>
                <p className="text-sm text-gray-500">Import products, manage locations</p>
              </div>
            </div>
          </Link>

          {/* Clients - only show if authenticated and user has access */}
          {isAuthenticated && (user?.role === 'admin' || user?.role === 'employee') && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Client Portals</h3>
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {clients.map((client) => (
                    <Link
                      key={client.id}
                      to={`/client/${client.client_code}`}
                      className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-purple-500 text-center"
                    >
                      <div className="text-lg font-bold text-purple-600">{client.client_code}</div>
                      <div className="text-xs text-gray-500">{client.name}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Client user - show their own client portal */}
          {isAuthenticated && user?.role === 'client' && user?.client_code && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Your Portal</h3>
              <Link
                to={`/client/${user.client_code}`}
                className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-transparent hover:border-purple-500 text-center"
              >
                <div className="text-lg font-bold text-purple-600">{user.client_code}</div>
                <div className="text-xs text-gray-500">View Inventory</div>
              </Link>
            </div>
          )}

          {/* Login link for unauthenticated users */}
          {!isAuthenticated && (
            <div className="pt-4 border-t">
              <Link
                to="/login"
                className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
