import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BackButton from './BackButton'

export default function Layout({ children, title, navItems = [], managerViewingClient = null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Manager Viewing Banner */}
      {managerViewingClient && (
        <div className="bg-purple-600 text-white px-4 py-2 text-sm flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Viewing <strong>{managerViewingClient}</strong> as Manager</span>
          <Link to="/manager" className="ml-2 underline hover:no-underline">
            Return to Dashboard
          </Link>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-[minmax(280px,_1fr)_auto_minmax(60px,_1fr)] items-center gap-4">
            {/* Left: Back Button + Title */}
            <div className="flex items-center gap-4 min-w-0">
              <BackButton />
              <h1 className="text-xl font-semibold text-gray-900 truncate" title={title}>{title}</h1>
            </div>

            {/* Center: Navigation */}
            <div className="flex justify-center">
              {navItems.length > 0 && (
                <nav className="flex gap-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                        location.pathname === item.to
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>

            {/* Right: Sign Out Icon */}
            <div className="flex justify-end">
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
