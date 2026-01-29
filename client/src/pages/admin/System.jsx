import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import { getAdminServerStatus } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  parts.push(`${secs}s`)

  return parts.join(' ')
}

export default function AdminSystem() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const loadStatus = useCallback(async () => {
    try {
      const data = await getAdminServerStatus()
      setStatus(data)
      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    let interval
    if (autoRefresh) {
      interval = setInterval(loadStatus, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, loadStatus])

  const heapUsedPercent = status?.process
    ? ((status.process.heapUsed / status.process.heapTotal) * 100).toFixed(1)
    : 0

  const memoryUsedPercent = status?.server
    ? (((status.server.totalMemory - status.server.freeMemory) / status.server.totalMemory) * 100).toFixed(1)
    : 0

  return (
    <Layout title="System Status" navItems={adminNavItems}>
      {/* Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto-refresh (5s)</span>
          </label>
        </div>
        {lastRefresh && (
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading && !status ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : status && (
        <div className="space-y-6">
          {/* Server Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              Server
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Uptime</p>
                <p className="font-medium text-gray-900">{formatUptime(status.server.uptime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Node Version</p>
                <p className="font-medium text-gray-900">{status.server.nodeVersion}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Environment</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  status.server.environment === 'production'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {status.server.environment}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Platform</p>
                <p className="font-medium text-gray-900">{status.server.platform} ({status.server.arch})</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CPUs</p>
                <p className="font-medium text-gray-900">{status.server.cpus} cores</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Hostname</p>
                <p className="font-medium text-gray-900 truncate" title={status.server.hostname}>
                  {status.server.hostname}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">PID</p>
                <p className="font-medium text-gray-900">{status.process.pid}</p>
              </div>
            </div>
          </div>

          {/* Memory */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Memory
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Heap Memory */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Heap Memory</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatBytes(status.process.heapUsed)} / {formatBytes(status.process.heapTotal)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      heapUsedPercent > 90 ? 'bg-red-500' :
                      heapUsedPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${heapUsedPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{heapUsedPercent}% used</p>
              </div>

              {/* System Memory */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">System Memory</span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatBytes(status.server.totalMemory - status.server.freeMemory)} / {formatBytes(status.server.totalMemory)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      memoryUsedPercent > 90 ? 'bg-red-500' :
                      memoryUsedPercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${memoryUsedPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{memoryUsedPercent}% used</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500">RSS</p>
                <p className="font-medium text-gray-900">{formatBytes(status.process.rss)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">External</p>
                <p className="font-medium text-gray-900">{formatBytes(status.process.external)}</p>
              </div>
            </div>
          </div>

          {/* Database */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Database
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">Latency</p>
                <p className={`font-medium ${
                  status.database.latency < 10 ? 'text-green-600' :
                  status.database.latency < 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {status.database.latency}ms
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Size</p>
                <p className="font-medium text-gray-900">{status.database.sizeFormatted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Connections</p>
                <p className="font-medium text-gray-900">{status.database.activeConnections}</p>
              </div>
            </div>

            {/* Top Tables */}
            {status.database.topTables && status.database.topTables.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top Tables by Row Count</h3>
                <div className="space-y-2">
                  {status.database.topTables.slice(0, 5).map((table) => (
                    <div key={table.table_name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-mono">{table.table_name}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {parseInt(table.row_count).toLocaleString()} rows
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
