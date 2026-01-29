import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getInventoryItem, getInventoryHistory, getInventoryPhotos } from '../../api'

const managerNavItems = [
  { to: '/manager', label: 'Dashboard' },
  { to: '/manager/import', label: 'Import' },
  { to: '/manager/locations', label: 'Locations' },
  { to: '/manager/products', label: 'Products' },
  { to: '/manager/users', label: 'Users' },
  { to: '/manager/returns', label: 'Returns' }
]

const formatCondition = (cond) => {
  const labels = {
    'new': 'New',
    'like_new': 'Like New',
    'good': 'Good',
    'acceptable': 'Acceptable',
    'damaged': 'Damaged',
    'sellable': 'Sellable',
    'refurbished': 'Refurbished',
    'defective': 'Defective'
  }
  return labels[cond] || cond || 'Not assessed'
}

const formatStatus = (status) => {
  const labels = {
    'awaiting_decision': 'Awaiting Decision',
    'decision_made': 'Decision Made',
    'processed': 'Processed'
  }
  return labels[status] || status
}

const formatDecision = (decision) => {
  const labels = {
    'ship_to_fba': 'Ship to FBA',
    'return': 'Return to Client',
    'dispose': 'Dispose',
    'keep_in_stock': 'Keep in Stock',
    'other': 'Other'
  }
  return labels[decision] || decision || '-'
}

const getStatusColor = (status) => {
  switch (status) {
    case 'awaiting_decision': return 'bg-yellow-100 text-yellow-800'
    case 'decision_made': return 'bg-blue-100 text-blue-800'
    case 'processed': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

const getConditionColor = (cond) => {
  switch (cond) {
    case 'sellable':
    case 'new':
    case 'like_new': return 'bg-green-100 text-green-800'
    case 'good':
    case 'acceptable':
    case 'refurbished': return 'bg-yellow-100 text-yellow-800'
    case 'damaged':
    case 'defective': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export default function ManagerInventoryDetail() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [history, setHistory] = useState([])
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadItem()
  }, [id])

  const loadItem = async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemData, historyData, photosData] = await Promise.all([
        getInventoryItem(id),
        getInventoryHistory(id).catch(() => []),
        getInventoryPhotos(id).catch(() => [])
      ])
      setItem(itemData)
      setHistory(historyData)
      setPhotos(photosData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Inventory Item" navItems={managerNavItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading item...</p>
        </div>
      </Layout>
    )
  }

  if (error && !item) {
    return (
      <Layout title="Inventory Item" navItems={managerNavItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Inventory Item" navItems={managerNavItems}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Photos & Product Info */}
        <div className="space-y-6">
          {/* Photos Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Photos</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Listing Photo */}
              <div>
                <h4 className="text-xs font-medium text-purple-700 mb-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Listing
                </h4>
                {item?.listing_image_url ? (
                  <img
                    src={item.listing_image_url}
                    alt="Listing"
                    className="w-full aspect-square object-cover rounded-lg border"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-400">No listing photo</span>
                  </div>
                )}
              </div>

              {/* Warehouse Photo */}
              <div>
                <h4 className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Warehouse
                </h4>
                {photos.length > 0 ? (
                  <img
                    src={photos[0].url}
                    alt="Warehouse"
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-400">No warehouse photo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional photos */}
            {photos.length > 1 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Additional Photos</h4>
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(1).map((photo, idx) => (
                    <img
                      key={photo.id || idx}
                      src={photo.url}
                      alt={`Photo ${idx + 2}`}
                      className="w-full aspect-square object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Product Details</h3>
              {item?.product_id && (
                <Link
                  to={`/manager/products/${item.product_id}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View Product
                </Link>
              )}
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-4">{item?.product_title || 'Unknown Product'}</h2>

            <dl className="space-y-3">
              {item?.upc && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">UPC</dt>
                  <dd className="text-sm font-mono text-gray-900">{item.upc}</dd>
                </div>
              )}
              {item?.sku && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">SKU</dt>
                  <dd className="text-sm font-mono text-gray-900">{item.sku}</dd>
                </div>
              )}
              {item?.asin && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">ASIN</dt>
                  <dd className="text-sm font-mono text-gray-900">{item.asin}</dd>
                </div>
              )}
              {item?.fnsku && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">FNSKU</dt>
                  <dd className="text-sm font-mono text-gray-900">{item.fnsku}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Right Column - Item Details & Status */}
        <div className="space-y-6">
          {/* Item Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-gray-900 mb-4">Item Information</h3>

            <dl className="space-y-4">
              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Client</dt>
                <dd>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    {item?.client_code || '-'}
                  </span>
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Quantity</dt>
                <dd className="text-sm font-medium text-gray-900">{item?.quantity || 0}</dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Location</dt>
                <dd className="text-sm text-gray-900">{item?.location_label || '-'}</dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Condition</dt>
                <dd>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${getConditionColor(item?.condition)}`}>
                    {formatCondition(item?.condition)}
                  </span>
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${getStatusColor(item?.status)}`}>
                    {formatStatus(item?.status)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Decision Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-gray-900 mb-4">Client Decision</h3>

            <dl className="space-y-4">
              <div className="flex justify-between items-center">
                <dt className="text-sm text-gray-500">Decision</dt>
                <dd className="text-sm font-medium text-gray-900">{formatDecision(item?.decision || item?.client_decision)}</dd>
              </div>

              {item?.decision_notes && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Notes</dt>
                  <dd className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{item.decision_notes}</dd>
                </div>
              )}

              {item?.shipping_label_url && (
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">Shipping Label</dt>
                  <dd>
                    <a
                      href={item.shipping_label_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </dd>
                </div>
              )}

              {item?.decision_at && (
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-gray-500">Decision Date</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(item.decision_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-medium text-gray-900 mb-4">Timeline</h3>

            <dl className="space-y-3">
              {item?.received_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Received</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(item.received_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
              {item?.created_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
              {item?.updated_at && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(item.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      {history.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="font-medium text-gray-900 mb-4">Activity History</h3>
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-gray-500">
                    {entry.changed_at && new Date(entry.changed_at).toLocaleString()}
                  </p>
                  {entry.reason && (
                    <p className="text-xs text-gray-400 mt-1">{entry.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
