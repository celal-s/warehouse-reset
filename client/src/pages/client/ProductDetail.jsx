import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getClientProduct } from '../../api'

export default function ClientProductDetail() {
  const { clientCode, productId } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadProduct()
  }, [clientCode, productId])

  const loadProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getClientProduct(clientCode, productId)
      setProduct(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const navItems = [
    { to: `/client/${clientCode}`, label: 'Dashboard' },
    { to: `/client/${clientCode}/products`, label: 'Products' },
    { to: `/client/${clientCode}/inventory`, label: 'Inventory' }
  ]

  const getStatusBadge = (status) => {
    const styles = {
      awaiting_decision: 'bg-yellow-100 text-yellow-800',
      decision_made: 'bg-blue-100 text-blue-800',
      processed: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.replace(/_/g, ' ') || 'unknown'}
      </span>
    )
  }

  const getConditionBadge = (condition) => {
    const styles = {
      sellable: 'bg-green-100 text-green-800',
      damaged: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[condition] || 'bg-gray-100 text-gray-800'}`}>
        {condition}
      </span>
    )
  }

  if (loading) {
    return (
      <Layout title="Product Detail" backLink={`/client/${clientCode}/products`} navItems={navItems}>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading product...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="Product Detail" backLink={`/client/${clientCode}/products`} navItems={navItems}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Product Detail" backLink={`/client/${clientCode}/products`} navItems={navItems}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start gap-6">
              {/* Image */}
              <div className="flex-shrink-0">
                {product?.display_image_url ? (
                  <img
                    src={product.display_image_url}
                    alt={product.title}
                    className="w-32 h-32 object-cover rounded-lg border"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{product?.title}</h2>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">UPC</dt>
                    <dd className="font-mono text-gray-900">{product?.upc || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">SKU</dt>
                    <dd className="font-mono text-gray-900">{product?.sku || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">ASIN</dt>
                    <dd className="font-mono text-gray-900">{product?.asin || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">FNSKU</dt>
                    <dd className="font-mono text-gray-900">{product?.fnsku || 'N/A'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Photos Comparison */}
          {(product?.photos?.length > 0 || product?.listing_image_url) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Photos</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Listing Photo */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Listing Photo
                  </h4>
                  {product?.listing_image_url ? (
                    <img
                      src={product.listing_image_url}
                      alt="Listing"
                      className="w-full aspect-square object-cover rounded-lg border"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                      <p className="text-sm text-gray-400">No listing photo</p>
                    </div>
                  )}
                </div>

                {/* Warehouse Photo */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Warehouse Photo
                  </h4>
                  {product?.photos?.find(p => p.source === 'warehouse') ? (
                    <img
                      src={product.photos.find(p => p.source === 'warehouse').url}
                      alt="Warehouse"
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                  ) : product?.photos?.[0] ? (
                    <img
                      src={product.photos[0].url}
                      alt="Product"
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
                      <p className="text-sm text-gray-400">No warehouse photo</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Inventory Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Items</h3>
            {product?.inventory_items?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {product.inventory_items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 font-bold">{item.quantity}</td>
                        <td className="px-4 py-2">{getConditionBadge(item.condition)}</td>
                        <td className="px-4 py-2">{getStatusBadge(item.status)}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{item.location_label || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {item.received_at ? new Date(item.received_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            to={`/client/${clientCode}/inventory/${item.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-gray-500">No inventory items</p>
                <p className="text-xs text-gray-400 mt-1">Items will appear here after they're received at the warehouse</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Inventory Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">
                {product?.inventory_quantity || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Units in Warehouse</div>
            </div>
            {product?.inventory_items?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Sellable</dt>
                    <dd className="text-sm font-medium text-green-600">
                      {product.inventory_items.filter(i => i.condition === 'sellable').reduce((sum, i) => sum + i.quantity, 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Damaged</dt>
                    <dd className="text-sm font-medium text-red-600">
                      {product.inventory_items.filter(i => i.condition === 'damaged').reduce((sum, i) => sum + i.quantity, 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500">Awaiting Decision</dt>
                    <dd className="text-sm font-medium text-yellow-600">
                      {product.inventory_items.filter(i => i.status === 'awaiting_decision').reduce((sum, i) => sum + i.quantity, 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Warehouse Observations */}
          {(product?.warehouse_notes || product?.warehouse_condition) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Warehouse Observations</h3>
              {product.warehouse_condition && (
                <div className="mb-3">
                  <dt className="text-sm text-gray-500">Observed Condition</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {product.warehouse_condition.replace(/_/g, ' ')}
                    </span>
                  </dd>
                </div>
              )}
              {product.warehouse_notes && (
                <div>
                  <dt className="text-sm text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-700">{product.warehouse_notes}</dd>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
