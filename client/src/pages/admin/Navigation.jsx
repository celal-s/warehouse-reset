import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { getAdminNavigation } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-purple-100 text-purple-800',
  employee: 'bg-blue-100 text-blue-800',
  client: 'bg-green-100 text-green-800'
}

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  PATCH: 'bg-orange-100 text-orange-800',
  DELETE: 'bg-red-100 text-red-800'
}

export default function AdminNavigation() {
  const [navigation, setNavigation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('frontend')

  useEffect(() => {
    loadNavigation()
  }, [])

  const loadNavigation = async () => {
    try {
      const data = await getAdminNavigation()
      setNavigation(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="Route Map" backLink="/admin" navItems={adminNavItems}>
      {/* Tab Toggle */}
      <div className="mb-6 flex bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('frontend')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'frontend' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Frontend Routes
        </button>
        <button
          onClick={() => setTab('api')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'api' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          API Endpoints
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : navigation && (
        <div className="space-y-6">
          {tab === 'frontend' ? (
            // Frontend Routes
            navigation.routes?.map((section) => (
              <div key={section.section} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">{section.section}</h2>
                    {section.roles && (
                      <div className="flex gap-1">
                        {section.roles.map((role) => (
                          <span
                            key={role}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-800'}`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {section.routes?.map((route, index) => (
                    <div key={index} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[route.method] || 'bg-gray-100'}`}>
                          {route.method}
                        </span>
                        <span className="font-mono text-sm text-gray-900">{route.path}</span>
                      </div>
                      <span className="text-sm text-gray-500">{route.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            // API Endpoints
            navigation.api?.map((section) => (
              <div key={section.section} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                  <h2 className="text-lg font-medium text-gray-900">{section.section}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {section.routes?.map((route, index) => (
                    <div key={index} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${METHOD_COLORS[route.method] || 'bg-gray-100'}`}>
                          {route.method}
                        </span>
                        <span className="font-mono text-sm text-gray-900">{route.path}</span>
                      </div>
                      <span className="text-sm text-gray-500">{route.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  )
}
