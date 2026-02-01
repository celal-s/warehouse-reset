import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getReturns, shipReturn } from '../../api'
import { employeeNavItems } from '../../config/employeeNav'

// Calculate urgency based on return_by_date
function getUrgency(returnByDate) {
  if (!returnByDate) return { color: 'gray', label: 'No deadline' }

  const now = new Date()
  const returnBy = new Date(returnByDate)
  const diffMs = returnBy - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { color: 'red', label: 'Overdue', days: diffDays }
  } else if (diffDays <= 2) {
    return { color: 'red', label: 'Urgent', days: diffDays }
  } else if (diffDays <= 7) {
    return { color: 'yellow', label: 'Soon', days: diffDays }
  } else {
    return { color: 'green', label: 'On track', days: diffDays }
  }
}

function UrgencyBadge({ returnByDate }) {
  const urgency = getUrgency(returnByDate)

  const colorClasses = {
    red: 'bg-red-100 text-red-800 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses[urgency.color]}`}>
      {urgency.days !== undefined && urgency.days < 0
        ? `${Math.abs(urgency.days)}d overdue`
        : urgency.days !== undefined
        ? `${urgency.days}d left`
        : urgency.label
      }
    </span>
  )
}

function StatusBadge({ status }) {
  const colorClasses = {
    pending: 'bg-yellow-100 text-yellow-800',
    matched: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

function TypeBadge({ isPreReceipt }) {
  return isPreReceipt ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
      Pre-receipt
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      Post-receipt
    </span>
  )
}

export default function EmployeeReturns() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  // Ship modal state
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shipping, setShipping] = useState(false)

  useEffect(() => {
    loadReturns()
  }, [statusFilter])

  const loadReturns = async () => {
    setLoading(true)
    setError(null)

    try {
      const filters = {}
      if (statusFilter) filters.status = statusFilter
      const data = await getReturns(filters)
      setReturns(data.returns || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openShipModal = (returnItem) => {
    setSelectedReturn(returnItem)
    setTrackingNumber(returnItem.tracking_number || '')
    setShipModalOpen(true)
  }

  const closeShipModal = () => {
    setShipModalOpen(false)
    setSelectedReturn(null)
    setTrackingNumber('')
  }

  const handleShip = async () => {
    if (!selectedReturn) return

    setShipping(true)
    setError(null)

    try {
      await shipReturn(selectedReturn.id, { tracking_number: trackingNumber })
      setSuccess(`Return marked as shipped with tracking: ${trackingNumber}`)
      closeShipModal()
      loadReturns()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setShipping(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Layout title="Returns" navItems={employeeNavItems}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-gray-900">Returns</h2>
          <span className="text-sm text-gray-500">
            Showing {returns.length} returns
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="shipped">Shipped</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={loadReturns}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>No pending returns</p>
            <p className="text-sm text-gray-400 mt-1">All returns have been processed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Return By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((item) => {
                  const urgency = getUrgency(item.return_by_date)
                  const rowBgClass = urgency.color === 'red'
                    ? 'bg-red-50'
                    : urgency.color === 'yellow'
                    ? 'bg-yellow-50'
                    : ''

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${rowBgClass}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="max-w-xs">
                            <div className="font-medium text-gray-900 truncate" title={item.product_name}>
                              {item.product_name || 'Unknown Product'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {item.client_code && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {item.client_code}
                                </span>
                              )}
                              <StatusBadge status={item.status} />
                            </div>
                            {item.product_fnsku && (
                              <div className="text-xs text-gray-500 mt-1">FNSKU: {item.product_fnsku}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity || 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(item.return_by_date)}</div>
                        <UrgencyBadge returnByDate={item.return_by_date} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TypeBadge isPreReceipt={item.return_type === 'pre_receipt'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.carrier || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.tracking_number ? (
                          <span className="font-mono text-sm text-gray-600">{item.tracking_number}</span>
                        ) : (
                          <span className="text-gray-400 text-sm">Not shipped</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {item.label_url && (
                            <a
                              href={item.label_url.includes('?') ? `${item.label_url}&fl_attachment` : `${item.label_url}?fl_attachment`}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Label
                            </a>
                          )}
                          {item.status !== 'shipped' && (
                            <button
                              onClick={() => openShipModal(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                              Ship
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ship Modal */}
      {shipModalOpen && selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Mark as Shipped</h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedReturn.product_name || 'Unknown Product'}
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tracking Number
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />

              {selectedReturn.carrier && (
                <p className="text-sm text-gray-500 mt-2">
                  Carrier: <span className="font-medium">{selectedReturn.carrier}</span>
                </p>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={closeShipModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShip}
                disabled={!trackingNumber.trim() || shipping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {shipping ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark Shipped
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
