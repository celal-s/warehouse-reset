import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getAdminDbTableData, getAdminDbTableSchema } from '../../api'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper
} from '@tanstack/react-table'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/system', label: 'System' },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/schema', label: 'Schema' },
  { to: '/admin/db-browser', label: 'DB Browser' },
  { to: '/admin/navigation', label: 'Routes' },
  { to: '/admin/api-docs', label: 'API Docs' }
]

export default function DbBrowserTable() {
  const { table } = useParams()
  const [data, setData] = useState([])
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0
  })
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      }
      const result = await getAdminDbTableData(table, params)
      setData(result.data || [])
      setPagination(prev => ({
        ...prev,
        totalCount: result.pagination?.totalCount || 0,
        totalPages: result.pagination?.totalPages || 0
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [table, pagination.page, pagination.limit, sortBy, sortOrder])

  const loadSchema = useCallback(async () => {
    try {
      const result = await getAdminDbTableSchema(table)
      setSchema(result)
    } catch (err) {
      // Schema load failure is not critical
    }
  }, [table])

  useEffect(() => {
    loadSchema()
    loadData()
  }, [loadSchema, loadData])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  // Get column names from schema or data
  const columns = schema?.columns?.map(c => c.column_name) || (data[0] ? Object.keys(data[0]) : [])

  // Render cell value
  const renderValue = (value) => {
    if (value === null) return <span className="text-gray-400 italic">null</span>
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (typeof value === 'object') return <span className="text-xs font-mono">{JSON.stringify(value).slice(0, 50)}...</span>
    const str = String(value)
    if (str.length > 100) return str.slice(0, 100) + '...'
    return str
  }

  return (
    <Layout
      title={`Browse: ${table}`}
     
      navItems={adminNavItems}
    >
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

      {/* Table Info */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {pagination.totalCount.toLocaleString()} total rows
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <select
            value={pagination.limit}
            onChange={(e) => {
              setPagination(prev => ({ ...prev, page: 1, limit: parseInt(e.target.value) }))
            }}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No data in this table
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        {sortBy === col && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {sortOrder === 'asc' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            )}
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, rowIndex) => (
                  <tr key={row.id || rowIndex} className="hover:bg-gray-50">
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                        {renderValue(row[col])}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      {row.id && (
                        <Link
                          to={`/admin/db-browser/${table}/${row.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button
              onClick={() => handlePageChange(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
