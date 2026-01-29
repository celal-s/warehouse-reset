import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getAdminDbRecord } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

export default function DbBrowserRecord() {
  const { table, id } = useParams()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRecord()
  }, [table, id])

  const loadRecord = async () => {
    try {
      const data = await getAdminDbRecord(table, id)
      setRecord(data.record)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderValue = (key, value) => {
    if (value === null) {
      return <span className="text-gray-400 italic">null</span>
    }
    if (typeof value === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {value ? 'true' : 'false'}
        </span>
      )
    }
    if (typeof value === 'object') {
      return (
        <pre className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto max-w-xl">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    // Check for URL
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {value}
        </a>
      )
    }
    // Check for date
    if (key.includes('_at') || key.includes('date')) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return (
          <span>
            {date.toLocaleString()}
            <span className="text-xs text-gray-500 ml-2">({value})</span>
          </span>
        )
      }
    }
    // Long text
    if (typeof value === 'string' && value.length > 500) {
      return (
        <div className="max-w-xl">
          <div className="bg-gray-50 p-2 rounded text-sm font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {value}
          </div>
        </div>
      )
    }
    return <span className="break-all">{String(value)}</span>
  }

  return (
    <Layout
      title={`${table} #${id}`}
      navItems={adminNavItems}
    >
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <Link to="/admin/db-browser" className="hover:text-blue-600">Tables</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link to={`/admin/db-browser/${table}`} className="hover:text-blue-600 font-mono">{table}</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">Record #{id}</span>
      </div>

      {/* Read-only Banner */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-blue-700">Read-only mode - data cannot be modified</span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : record ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">
              Record Details
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {Object.entries(record).map(([key, value]) => (
              <div key={key} className="px-6 py-4 flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                <div className="md:w-48 flex-shrink-0">
                  <span className="font-mono text-sm font-medium text-gray-700">{key}</span>
                </div>
                <div className="flex-1 text-sm text-gray-900">
                  {renderValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          Record not found
        </div>
      )}

      {/* Back Button */}
      <div className="mt-6">
        <Link
          to={`/admin/db-browser/${table}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to table
        </Link>
      </div>
    </Layout>
  )
}
