import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getProductDetail, updateProductObservations } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/users', label: 'Users' }
]

export default function AdminProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

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
      const data = await getProductDetail(id)
      setProduct(data)
      setNotes(data.warehouse_observations?.notes || '')
      setCondition(data.warehouse_observations?.condition || '')
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
      setSuccess('Observations saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Product Detail" backLink="/admin/products" navItems={adminNavItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading product...</p>
        </div>
      </Layout>
    )
  }

  if (error && !product) {
    return (
      <Layout title="Product Detail" backLink="/admin/products" navItems={adminNavItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Product Detail" backLink="/admin/products" navItems={adminNavItems}>
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{product?.title}</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">UPC</dt>
                <dd className="font-mono text-gray-900">{product?.upc || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="text-gray-900">
                  {product?.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Two-Sided Photos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Photos</h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Listing Photos */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Listing Photos
                </h4>
                <p className="text-xs text-gray-500 mb-3">From client import/marketplace</p>
                {product?.photos?.listing?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {product.photos.listing.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={photo.url}
                          alt={`Listing ${idx + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                        {photo.client_code && (
                          <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {photo.client_code}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">No listing photos</p>
                  </div>
                )}
              </div>

              {/* Warehouse Photos */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Warehouse Photos
                </h4>
                <p className="text-xs text-gray-500 mb-3">Actual item photos</p>
                {product?.photos?.warehouse?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {product.photos.warehouse.map((photo, idx) => (
                      <img
                        key={photo.id || idx}
                        src={photo.url}
                        alt={`Warehouse ${idx + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">No warehouse photos</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Client Listings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Listings</h3>
            {product?.client_listings?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ASIN</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">FNSKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {product.client_listings.map((listing, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {listing.client_code}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-sm">{listing.sku || '-'}</td>
                        <td className="px-4 py-2 font-mono text-sm">{listing.asin || '-'}</td>
                        <td className="px-4 py-2 font-mono text-sm">{listing.fnsku || '-'}</td>
                        <td className="px-4 py-2 text-sm uppercase">{listing.marketplace || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No client listings found.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Warehouse Observations */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Warehouse Observations</h3>
            <form onSubmit={handleSaveObservations} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observed Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add warehouse observations..."
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Observations'}
              </button>
            </form>
          </div>

          {/* Inventory Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-blue-600">
                {product?.inventory_summary?.total_quantity || 0}
              </div>
              <div className="text-sm text-gray-500">Total Units</div>
            </div>
            {product?.inventory_summary?.by_client?.length > 0 ? (
              <div className="space-y-2">
                {product.inventory_summary.by_client.map((client, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{client.client_code}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold">{client.total_quantity}</div>
                      <div className="text-xs text-gray-500">
                        {client.sellable_count} sellable, {client.damaged_count} damaged
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">No inventory</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
