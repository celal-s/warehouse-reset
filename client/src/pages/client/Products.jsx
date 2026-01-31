import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getClientProducts } from '../../api'
import { useClientNavigation } from '../../hooks/useClientNavigation'

export default function ClientProducts() {
  const { clientCode } = useParams()
  const { navItems, isStaffViewing } = useClientNavigation()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadProducts()
  }, [clientCode])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getClientProducts(clientCode)
      setProducts(data.products || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      product.title?.toLowerCase().includes(query) ||
      product.upc?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      product.asin?.toLowerCase().includes(query)
    )
  })

  return (
    <Layout
      title="Product Catalog"
      navItems={navItems}
      managerViewingClient={isStaffViewing ? clientCode : null}
    >
      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-blue-900">Product Catalog vs Inventory</h3>
            <p className="text-sm text-blue-700 mt-1">
              This page shows your product catalog (master data). The <strong>Inventory Qty</strong> column shows
              how many units are currently in the warehouse. Products with 0 inventory haven't been received yet.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, UPC, SKU, or ASIN..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900">No products found</h3>
          <p className="mt-1 text-gray-500">
            {searchQuery ? 'Try a different search term.' : 'No products in your catalog yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UPC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ASIN
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inventory Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.listing_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.display_image_url ? (
                        <img
                          src={product.display_image_url}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="font-medium text-gray-900 truncate max-w-xs">
                        {product.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    {product.upc || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    {product.sku || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">
                    {product.asin || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.inventory_quantity > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.inventory_quantity || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/client/${clientCode}/products/${product.product_id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!loading && filteredProducts.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      )}
    </Layout>
  )
}
