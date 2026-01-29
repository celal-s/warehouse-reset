import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { getAdminApiDocs } from '../../api'

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

export default function AdminApiDocs() {
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedEndpoint, setExpandedEndpoint] = useState(null)

  useEffect(() => {
    loadDocs()
  }, [])

  const loadDocs = async () => {
    try {
      const data = await getAdminApiDocs()
      setDocs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleEndpoint = (key) => {
    setExpandedEndpoint(prev => prev === key ? null : key)
  }

  return (
    <Layout title="API Documentation" backLink="/admin" navItems={adminNavItems}>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : docs && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900">{docs.title}</h1>
            <p className="mt-2 text-gray-600">{docs.description}</p>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-gray-500">Version: <span className="font-medium">{docs.version}</span></span>
              <span className="text-sm text-gray-500">Base URL: <code className="bg-gray-100 px-2 py-0.5 rounded">{docs.baseUrl}</code></span>
            </div>
          </div>

          {/* Authentication */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Authentication</h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span> {docs.authentication?.type}
              </p>
              <p className="text-sm text-gray-600">{docs.authentication?.description}</p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Login Endpoint</p>
                <code className="text-sm text-gray-800">
                  POST {docs.authentication?.endpoints?.login?.path}
                </code>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Request Body:</p>
                  <pre className="text-xs font-mono bg-gray-100 p-2 rounded mt-1">
                    {JSON.stringify(docs.authentication?.endpoints?.login?.body, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">User Roles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(docs.roles || {}).map(([role, description]) => (
                <div key={role} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${ROLE_COLORS[role] || 'bg-gray-100 text-gray-800'}`}>
                    {role}
                  </span>
                  <span className="text-sm text-gray-600">{description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Endpoints</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {Object.entries(docs.endpoints || {}).map(([section, endpoints]) => (
                <div key={section}>
                  <div className="px-6 py-3 bg-gray-100">
                    <h3 className="text-sm font-medium text-gray-900 uppercase tracking-wider">{section}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(endpoints).map(([endpoint, details]) => {
                      const [method, path] = endpoint.split(' ')
                      const key = `${section}-${endpoint}`
                      const isExpanded = expandedEndpoint === key

                      return (
                        <div key={endpoint}>
                          <button
                            onClick={() => toggleEndpoint(key)}
                            className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                method === 'GET' ? 'bg-green-100 text-green-800' :
                                method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                method === 'PATCH' ? 'bg-orange-100 text-orange-800' :
                                method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {method}
                              </span>
                              <span className="font-mono text-sm text-gray-900">{path}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-gray-500 hidden md:block">{details.description}</span>
                              <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-6 py-4 bg-gray-50 border-t">
                              <p className="text-sm text-gray-600 mb-3">{details.description}</p>
                              {details.auth && (
                                <div className="mb-3">
                                  <span className="text-xs font-medium text-gray-500 uppercase">Authorization: </span>
                                  <span className="text-sm text-gray-700">{details.auth}</span>
                                </div>
                              )}
                              {details.params && (
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Parameters</p>
                                  <pre className="text-xs font-mono bg-white p-2 rounded border">
                                    {JSON.stringify(details.params, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {details.body && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Request Body</p>
                                  <pre className="text-xs font-mono bg-white p-2 rounded border">
                                    {typeof details.body === 'string' ? details.body : JSON.stringify(details.body, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
