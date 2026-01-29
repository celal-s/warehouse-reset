import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getProductDetail, getProductInventory, getProductHistory, updateProductObservations } from '../../api'

const managerNavItems = [
  { to: '/manager', label: 'Dashboard' },
  { to: '/manager/import', label: 'Import' },
  { to: '/manager/locations', label: 'Locations' },
  { to: '/manager/products', label: 'Products' },
  { to: '/manager/users', label: 'Users' },
  { to: '/manager/returns', label: 'Returns' }
]

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect fill="#f3f4f6" width="200" height="200"/>
    <path fill="#d1d5db" d="M80 70h40v30H80zM70 100h60v30H70z"/>
    <circle fill="#d1d5db" cx="100" cy="55" r="15"/>
  </svg>
`)

export default function ManagerProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [inventory, setInventory] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [activeTab, setActiveTab] = useState('inventory')
  const [editingObservations, setEditingObservations] = useState(false)

  // Observation form state
  const [notes, setNotes] = useState('')
  const [condition, setCondition] = useState('')

  useEffect(() => {
    loadProduct()
  }, [id])

  const loadProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const [productData, inventoryData, historyData] = await Promise.all([
        getProductDetail(id),
        getProductInventory(id),
        getProductHistory(id).catch(() => [])
      ])
      setProduct(productData)
      setInventory(inventoryData)
      setHistory(historyData)
      setNotes(productData.warehouse_observations?.notes || '')
      setCondition(productData.warehouse_observations?.condition || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveObservations = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await updateProductObservations(id, {
        notes: notes || null,
        condition: condition || null
      })
      setSuccess('Observations saved')
      setEditingObservations(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getDisplayImage = () => {
    const warehousePhotos = product?.photos?.warehouse || []
    if (warehousePhotos.length > 0) {
      return warehousePhotos[0].url
    }
    return null
  }

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
      'return': 'Return',
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

  if (loading) {
    return (
      <Layout title="Product Detail" backLink="/admin/products" navItems={managerNavItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading product...</p>
        </div>
      </Layout>
    )
  }

  if (error && !product) {
    return (
      <Layout title="Product Detail" backLink="/admin/products" navItems={managerNavItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  const displayImage = getDisplayImage()

  return (
    <Layout title="Product Detail" backLink="/admin/products" navItems={managerNavItems}>
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel - Fixed width */}
        <div className="lg:w-2/5 space-y-4">
          {/* Product Image */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={product?.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">No warehouse photo</p>
                  </div>
                </div>
              )}
            </div>

            {/* Product Info */}
            <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{product?.title}</h2>

            {product?.upc && (
              <div className="mb-3">
                <span className="text-xs text-gray-500">UPC</span>
                <p className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">{product.upc}</p>
              </div>
            )}
          </div>

          {/* Warehouse Observations */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Warehouse Observations</h3>
              {!editingObservations && (
                <button
                  onClick={() => setEditingObservations(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>

            {editingObservations ? (
              <form onSubmit={handleSaveObservations} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Not assessed</option>
                    <option value="new">New</option>
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="acceptable">Acceptable</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Add observations..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingObservations(false)
                      setNotes(product.warehouse_observations?.notes || '')
                      setCondition(product.warehouse_observations?.condition || '')
                    }}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500">Condition</span>
                  <p className="text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${getConditionColor(condition)}`}>
                      {formatCondition(condition)}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Notes</span>
                  <p className="text-sm text-gray-700">{notes || 'No notes'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Inventory Summary */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-3">Inventory Summary</h3>
            <div className="text-center mb-3">
              <div className="text-3xl font-bold text-blue-600">
                {product?.inventory_summary?.total_quantity || 0}
              </div>
              <div className="text-sm text-gray-500">Total Units</div>
            </div>
            {product?.inventory_summary?.by_client?.length > 0 && (
              <div className="space-y-1">
                {product.inventory_summary.by_client.map((client, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                    <span className="font-medium">{client.client_code}</span>
                    <span>{client.total_quantity} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Tabbed */}
        <div className="lg:w-3/5">
          <div className="bg-white rounded-lg shadow">
            {/* Tabs */}
            <div className="border-b">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'inventory'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Inventory ({inventory.length})
                </button>
                <button
                  onClick={() => setActiveTab('listings')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'listings'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Client Listings ({product?.client_listings?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === 'history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  History
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {/* Inventory Tab */}
              {activeTab === 'inventory' && (
                <div>
                  {inventory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Decision</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {inventory.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {item.client_code}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm font-medium">{item.quantity}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.location_label || '-'}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${getConditionColor(item.condition)}`}>
                                  {formatCondition(item.condition)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${getStatusColor(item.status)}`}>
                                  {formatStatus(item.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-600">{formatDecision(item.client_decision)}</td>
                              <td className="px-3 py-2">
                                <Link
                                  to={`/admin/inventory/${item.id}`}
                                  className="text-blue-600 hover:text-blue-700 text-sm"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <p>No inventory items for this product</p>
                    </div>
                  )}
                </div>
              )}

              {/* Client Listings Tab */}
              {activeTab === 'listings' && (
                <div>
                  {product?.client_listings?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ASIN</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">FNSKU</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {product.client_listings.map((listing, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  {listing.client_code}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-sm">{listing.sku || '-'}</td>
                              <td className="px-3 py-2 font-mono text-sm">{listing.asin || '-'}</td>
                              <td className="px-3 py-2 font-mono text-sm">{listing.fnsku || '-'}</td>
                              <td className="px-3 py-2 text-sm uppercase">{listing.marketplace || '-'}</td>
                              <td className="px-3 py-2">
                                {listing.amazon_url ? (
                                  <a
                                    href={listing.amazon_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-sm"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Amazon
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p>No client listings for this product</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  {history.length > 0 ? (
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
                              {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-xs text-gray-500">
                              by {entry.actor_name} ({entry.actor_type}) - {new Date(entry.created_at).toLocaleString()}
                            </p>
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <p className="text-xs text-gray-400 mt-1 font-mono">
                                {JSON.stringify(entry.metadata)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No activity history for this product</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
