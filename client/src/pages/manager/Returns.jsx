import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getReturns, completeReturn } from '../../api'

const managerNavItems = [
  { to: '/manager', label: 'Dashboard' },
  { to: '/manager/import', label: 'Import' },
  { to: '/manager/locations', label: 'Locations' },
  { to: '/manager/products', label: 'Products' },
  { to: '/manager/users', label: 'Users' },
  { to: '/manager/returns', label: 'Returns' }
]

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  matched: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  unmatched: 'bg-red-100 text-red-800'
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Check if return is urgent (due within 3 days or overdue)
const isUrgent = (returnItem) => {
  if (!returnItem.return_by_date) return false
  const returnBy = new Date(returnItem.return_by_date)
  const now = new Date()
  const daysUntilDue = Math.ceil((returnBy - now) / (1000 * 60 * 60 * 24))
  return daysUntilDue <= 3
}

// Get urgency color for the row
const getUrgencyRowClass = (returnItem) => {
  if (!returnItem.return_by_date || returnItem.status === 'completed' || returnItem.status === 'cancelled') {
    return ''
  }
  const returnBy = new Date(returnItem.return_by_date)
  const now = new Date()
  const daysUntilDue = Math.ceil((returnBy - now) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'bg-red-50' // Overdue
  if (daysUntilDue <= 3) return 'bg-orange-50' // Urgent
  if (daysUntilDue <= 7) return 'bg-yellow-50' // Warning
  return ''
}

export default function ManagerReturns() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [urgentOnly, setUrgentOnly] = useState(searchParams.get('urgent') === 'true')
  const [clientFilter, setClientFilter] = useState(searchParams.get('client_id') || '')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 50

  useEffect(() => {
    loadReturns()
  }, [page, statusFilter, urgentOnly, clientFilter])

  const loadReturns = async () => {
    setLoading(true)
    setError(null)

    try {
      const filters = {
        page,
        limit
      }
      if (statusFilter) filters.status = statusFilter
      if (clientFilter) filters.client_id = clientFilter
      if (urgentOnly) filters.urgent = 'true'

      const data = await getReturns(filters)
      setReturns(data.returns || data)
      setTotalPages(data.totalPages || Math.ceil((data.total || data.length) / limit))
      setTotalCount(data.total || data.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (status) => {
    setStatusFilter(status)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (status) {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    setSearchParams(params)
  }

  const handleUrgentToggle = () => {
    const newValue = !urgentOnly
    setUrgentOnly(newValue)
    setPage(1)
    const params = new URLSearchParams(searchParams)
    if (newValue) {
      params.set('urgent', 'true')
    } else {
      params.delete('urgent')
    }
    setSearchParams(params)
  }

  const handleComplete = async (returnId) => {
    if (!confirm('Mark this return as completed?')) return

    setCompleting(returnId)
    try {
      await completeReturn(returnId)
      loadReturns()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompleting(null)
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <Layout title="Returns Management" backLink="/" navItems={managerNavItems}>
      {/* Header with Actions */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-lg font-medium text-gray-900">All Returns</h2>
        <div className="flex gap-2">
          <Link
            to="/manager/returns/import"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import Labels
          </Link>
          <Link
            to="/manager/returns/unmatched"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Unmatched Returns
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="shipped">Shipped</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </div>

        {/* Urgent Toggle */}
        <button
          onClick={handleUrgentToggle}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            urgentOnly
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Urgent Only
        </button>

        {/* Client Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Client ID:</label>
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value)
              setPage(1)
            }}
            placeholder="Filter by client..."
            className="border rounded-lg px-3 py-2 text-sm w-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Results Info */}
      {!loading && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {returns.length} of {totalCount} returns
          {statusFilter && ` (${statusFilter})`}
          {urgentOnly && ' - Urgent only'}
        </div>
      )}

      {/* Returns Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No returns found</p>
            {(statusFilter || urgentOnly || clientFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('')
                  setUrgentOnly(false)
                  setClientFilter('')
                  setSearchParams({})
                }}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipped
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((returnItem) => (
                  <tr key={returnItem.id} className={`hover:bg-gray-50 ${getUrgencyRowClass(returnItem)}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-600">
                        #{returnItem.id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-w-xs">
                        <div className="font-medium text-gray-900 truncate" title={returnItem.product_name}>
                          {returnItem.product_name || 'Unknown Product'}
                        </div>
                        {returnItem.product_sku && (
                          <div className="text-sm text-gray-500 font-mono">
                            SKU: {returnItem.product_sku}
                          </div>
                        )}
                        {returnItem.tracking_number && (
                          <div className="text-xs text-gray-400 truncate" title={returnItem.tracking_number}>
                            {returnItem.tracking_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {returnItem.client_code || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {returnItem.quantity || 1}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[returnItem.status] || 'bg-gray-100 text-gray-800'}`}>
                        {returnItem.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {isUrgent(returnItem) && returnItem.status !== 'completed' && returnItem.status !== 'cancelled' && (
                          <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className="text-sm text-gray-600">
                          {formatDate(returnItem.return_by_date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(returnItem.shipped_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {returnItem.status === 'shipped' && (
                          <button
                            onClick={() => handleComplete(returnItem.id)}
                            disabled={completing === returnItem.id}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {completing === returnItem.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            ) : (
                              'Complete'
                            )}
                          </button>
                        )}
                        <Link
                          to={`/admin/returns/${returnItem.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={page === 1}
              className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
