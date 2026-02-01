import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getReturn, updateReturn, shipReturn, completeReturn } from '../../api'
import { managerNavItems } from '../../config/managerNav'

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function ManagerReturnDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [returnItem, setReturnItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  // Ship modal state
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')

  useEffect(() => {
    loadReturn()
  }, [id])

  const loadReturn = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getReturn(id)
      setReturnItem(data)
      setTrackingNumber(data.tracking_number || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleShip = async () => {
    setActionLoading('ship')
    setError(null)
    try {
      await shipReturn(id, { tracking_number: trackingNumber })
      setSuccess('Return marked as shipped')
      setShipModalOpen(false)
      loadReturn()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async () => {
    if (!confirm('Mark this return as completed?')) return

    setActionLoading('complete')
    setError(null)
    try {
      await completeReturn(id)
      setSuccess('Return marked as completed')
      loadReturn()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this return? This action cannot be undone.')) return

    setActionLoading('cancel')
    setError(null)
    try {
      await updateReturn(id, { status: 'cancelled' })
      setSuccess('Return has been cancelled')
      loadReturn()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Calculate urgency
  const getUrgency = () => {
    if (!returnItem?.return_by_date) return null
    const returnBy = new Date(returnItem.return_by_date)
    const now = new Date()
    const daysUntilDue = Math.ceil((returnBy - now) / (1000 * 60 * 60 * 24))

    if (daysUntilDue < 0) return { color: 'red', label: `${Math.abs(daysUntilDue)} days overdue` }
    if (daysUntilDue <= 2) return { color: 'red', label: `${daysUntilDue} days left - Urgent` }
    if (daysUntilDue <= 7) return { color: 'yellow', label: `${daysUntilDue} days left` }
    return { color: 'green', label: `${daysUntilDue} days left` }
  }

  if (loading) {
    return (
      <Layout title="Return Detail" navItems={managerNavItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading return...</p>
        </div>
      </Layout>
    )
  }

  if (error && !returnItem) {
    return (
      <Layout title="Return Detail" navItems={managerNavItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  const urgency = getUrgency()
  const isActive = returnItem && !['completed', 'cancelled'].includes(returnItem.status)

  return (
    <Layout title="Return Detail" navItems={managerNavItems}>
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Return #{returnItem.id}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Created {formatDate(returnItem.created_at)}
                </p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[returnItem.status] || 'bg-gray-100 text-gray-800'}`}>
                {returnItem.status}
              </span>
            </div>

            {/* Urgency Warning */}
            {urgency && isActive && (
              <div className={`p-3 rounded-lg mb-4 ${
                urgency.color === 'red' ? 'bg-red-50 border border-red-200' :
                urgency.color === 'yellow' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-center gap-2">
                  <svg className={`w-5 h-5 ${
                    urgency.color === 'red' ? 'text-red-500' :
                    urgency.color === 'yellow' ? 'text-yellow-500' :
                    'text-green-500'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className={`font-medium ${
                    urgency.color === 'red' ? 'text-red-700' :
                    urgency.color === 'yellow' ? 'text-yellow-700' :
                    'text-green-700'
                  }`}>
                    {urgency.label}
                  </span>
                </div>
              </div>
            )}

            {/* Product Info */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Product Information</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Product Name</span>
                  <p className="font-medium text-gray-900">{returnItem.product_name || 'Unknown Product'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {returnItem.product_sku && (
                    <div>
                      <span className="text-sm text-gray-500">SKU</span>
                      <p className="font-mono text-sm">{returnItem.product_sku}</p>
                    </div>
                  )}
                  {returnItem.product_fnsku && (
                    <div>
                      <span className="text-sm text-gray-500">FNSKU</span>
                      <p className="font-mono text-sm">{returnItem.product_fnsku}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-500">Quantity</span>
                    <p className="font-medium">{returnItem.quantity || 1}</p>
                  </div>
                  {returnItem.client_code && (
                    <div>
                      <span className="text-sm text-gray-500">Client</span>
                      <p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {returnItem.client_code}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
                {returnItem.product_id && (
                  <div>
                    <Link
                      to={`/manager/products/${returnItem.product_id}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View Product Details
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Return Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Return Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Return Type</span>
                <p className="font-medium">
                  {returnItem.return_type === 'pre_receipt' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      Pre-receipt
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Post-receipt
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Return By Date</span>
                <p className="font-medium">{formatShortDate(returnItem.return_by_date)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Carrier</span>
                <p className="font-medium">{returnItem.carrier || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Tracking Number</span>
                <p className="font-mono text-sm">{returnItem.tracking_number || '-'}</p>
              </div>
              {returnItem.shipped_at && (
                <div>
                  <span className="text-sm text-gray-500">Shipped At</span>
                  <p className="font-medium">{formatDate(returnItem.shipped_at)}</p>
                </div>
              )}
              {returnItem.completed_at && (
                <div>
                  <span className="text-sm text-gray-500">Completed At</span>
                  <p className="font-medium">{formatDate(returnItem.completed_at)}</p>
                </div>
              )}
            </div>

            {returnItem.notes && (
              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-gray-500">Notes</span>
                <p className="mt-1 text-gray-700 whitespace-pre-wrap">{returnItem.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Actions & Label */}
        <div className="space-y-6">
          {/* Actions */}
          {isActive && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Actions</h3>
              <div className="space-y-3">
                {returnItem.status !== 'shipped' && (
                  <button
                    onClick={() => setShipModalOpen(true)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Mark as Shipped
                  </button>
                )}

                {returnItem.status === 'shipped' && (
                  <button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === 'complete' ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark as Completed
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'cancel' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Return
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Return Label */}
          {returnItem.label_url && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-4">Return Label</h3>
              <a
                href={returnItem.label_url.includes('?') ? `${returnItem.label_url}&fl_attachment` : `${returnItem.label_url}?fl_attachment`}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Label (PDF)
              </a>
              <a
                href={returnItem.label_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View in Browser
              </a>
            </div>
          )}

          {/* Source Info */}
          {returnItem.source_identifier && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Source Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500">Source Identifier</span>
                  <p className="font-mono text-sm break-all">{returnItem.source_identifier}</p>
                </div>
                {returnItem.original_filename && (
                  <div>
                    <span className="text-xs text-gray-500">Original Filename</span>
                    <p className="text-sm break-all">{returnItem.original_filename}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ship Modal */}
      {shipModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Mark as Shipped</h3>
              <p className="text-sm text-gray-500 mt-1">
                {returnItem.product_name || 'Unknown Product'}
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

              {returnItem.carrier && (
                <p className="text-sm text-gray-500 mt-2">
                  Carrier: <span className="font-medium">{returnItem.carrier}</span>
                </p>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setShipModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShip}
                disabled={!trackingNumber.trim() || actionLoading === 'ship'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {actionLoading === 'ship' ? (
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
