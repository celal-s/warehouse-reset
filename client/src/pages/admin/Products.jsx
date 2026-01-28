import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getAdminProducts, searchProducts } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/users', label: 'Users' }
]

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const limit = 20

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (!searchQuery) {
      loadProducts()
    }
  }, [page])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getAdminProducts(page, limit)
      setProducts(data.products || data)
      setTotalPages(data.totalPages || Math.ceil((data.total || data.length) / limit))
      setTotalCount(data.total || data.length)
      setIsSearching(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setPage(1)
      loadProducts()
      return
    }

    setLoading(true)
    setError(null)
    setIsSearching(true)

    try {
      const results = await searchProducts(searchQuery)
      setProducts(results)
      setTotalPages(1)
      setTotalCount(results.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    handleSearch()
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setPage(1)
    loadProducts()
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <Layout title="Products" backLink="/" navItems={adminNavItems}>
      {/* Header with Add Button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Product Catalog</h2>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Product
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, UPC, or SKU..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {isSearching && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
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
          {isSearching ? (
            <span>Found {totalCount} products matching "{searchQuery}"</span>
          ) : (
            <span>Showing {products.length} of {totalCount} products</span>
          )}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p>No products found</p>
            {isSearching && (
              <button
                onClick={handleClearSearch}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
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
                  Client Listings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Photos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.photos && product.photos.length > 0 ? (
                        <img
                          src={product.photos[0].url}
                          alt=""
                          className="w-12 h-12 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="max-w-md">
                        <div className="font-medium text-gray-900 truncate" title={product.title}>
                          {product.title}
                        </div>
                        {product.description && (
                          <div className="text-sm text-gray-500 truncate" title={product.description}>
                            {product.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-600">
                      {product.upc || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.client_listings && product.client_listings.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.client_listings.map((listing, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                            title={`SKU: ${listing.sku || 'N/A'}, Market: ${listing.marketplace?.toUpperCase() || 'N/A'}`}
                          >
                            {listing.client_code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      (product.photos?.length || product.photo_count || 0) > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {product.photos?.length || product.photo_count || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/admin/products/${product.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isSearching && totalPages > 1 && (
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
