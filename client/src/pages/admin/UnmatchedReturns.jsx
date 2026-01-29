import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { getUnmatchedReturns, assignReturnProduct, searchProducts } from '../../api'

const adminNavItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/import', label: 'Import' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/returns', label: 'Returns' }
]

export default function UnmatchedReturns() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Search state per return (keyed by return id)
  const [searchQueries, setSearchQueries] = useState({})
  const [searchResults, setSearchResults] = useState({})
  const [searchLoading, setSearchLoading] = useState({})
  const [selectedProducts, setSelectedProducts] = useState({})
  const [assigningReturn, setAssigningReturn] = useState(null)

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getUnmatchedReturns()
      setReturns(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (returnId, query) => {
    setSearchQueries(prev => ({ ...prev, [returnId]: query }))

    // Clear selection when query changes
    setSelectedProducts(prev => ({ ...prev, [returnId]: null }))

    // Clear results if query is empty
    if (!query.trim()) {
      setSearchResults(prev => ({ ...prev, [returnId]: [] }))
      return
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(returnId, query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }

  const performSearch = async (returnId, query) => {
    if (!query.trim()) return

    setSearchLoading(prev => ({ ...prev, [returnId]: true }))

    try {
      const results = await searchProducts(query)
      setSearchResults(prev => ({ ...prev, [returnId]: results }))
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults(prev => ({ ...prev, [returnId]: [] }))
    } finally {
      setSearchLoading(prev => ({ ...prev, [returnId]: false }))
    }
  }

  const handleSelectProduct = (returnId, product) => {
    setSelectedProducts(prev => ({ ...prev, [returnId]: product }))
    setSearchResults(prev => ({ ...prev, [returnId]: [] }))
    setSearchQueries(prev => ({ ...prev, [returnId]: product.title }))
  }

  const handleAssignProduct = async (returnId) => {
    const product = selectedProducts[returnId]
    if (!product) return

    setAssigningReturn(returnId)
    setError(null)
    setSuccessMessage(null)

    try {
      await assignReturnProduct(returnId, product.id)

      // Remove the return from the list
      setReturns(prev => prev.filter(r => r.id !== returnId))

      // Clear search state for this return
      setSearchQueries(prev => ({ ...prev, [returnId]: '' }))
      setSearchResults(prev => ({ ...prev, [returnId]: [] }))
      setSelectedProducts(prev => ({ ...prev, [returnId]: null }))

      setSuccessMessage(`Product "${product.title}" assigned successfully. Return moved to pending.`)

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigningReturn(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const getUrgencyColor = (returnByDate) => {
    if (!returnByDate) return 'text-gray-500'

    const today = new Date()
    const deadline = new Date(returnByDate)
    const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))

    if (daysUntil < 0) return 'text-red-600 font-semibold' // Past due
    if (daysUntil <= 3) return 'text-red-500' // Urgent
    if (daysUntil <= 7) return 'text-orange-500' // Soon
    return 'text-gray-600' // Normal
  }

  const getUrgencyBadge = (returnByDate) => {
    if (!returnByDate) return null

    const today = new Date()
    const deadline = new Date(returnByDate)
    const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))

    if (daysUntil < 0) {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          OVERDUE
        </span>
      )
    }
    if (daysUntil <= 3) {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          {daysUntil} days
        </span>
      )
    }
    if (daysUntil <= 7) {
      return (
        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
          {daysUntil} days
        </span>
      )
    }
    return null
  }

  return (
    <Layout title="Unmatched Returns" backLink="/admin/returns" navItems={adminNavItems}>
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Returns Requiring Manual Matching</h2>
          <p className="text-sm text-gray-500 mt-1">
            These returns could not be automatically matched to products. Search and assign products manually.
          </p>
        </div>
        <Link
          to="/admin/returns"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Returns
        </Link>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : returns.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Unmatched Returns</h3>
          <p className="text-gray-500 mb-4">All returns have been matched to products.</p>
          <Link
            to="/admin/returns"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View All Returns
          </Link>
        </div>
      ) : (
        /* Returns List */
        <div className="space-y-4">
          {returns.map((returnItem) => (
            <div key={returnItem.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                {/* Return Info Header */}
                <div className="flex flex-wrap gap-6 mb-4">
                  {/* Source Identifier */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      {returnItem.source_identifier?.length === 10 ? 'ASIN' : 'Order #'}
                    </div>
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {returnItem.source_identifier || '-'}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Quantity
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {returnItem.quantity || 1}
                    </div>
                  </div>

                  {/* Carrier */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Carrier
                    </div>
                    <div className="text-sm text-gray-900">
                      {returnItem.carrier || '-'}
                    </div>
                  </div>

                  {/* Return By Date */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Return By
                    </div>
                    <div className={`text-sm ${getUrgencyColor(returnItem.return_by_date)}`}>
                      {formatDate(returnItem.return_by_date)}
                      {getUrgencyBadge(returnItem.return_by_date)}
                    </div>
                  </div>

                  {/* Original Filename */}
                  {returnItem.original_filename && (
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Source File
                      </div>
                      <div className="text-sm text-gray-600 truncate" title={returnItem.original_filename}>
                        {returnItem.original_filename}
                      </div>
                    </div>
                  )}
                </div>

                {/* Parsed Product Name */}
                {returnItem.parsed_product_name && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Parsed Product Name
                    </div>
                    <div className="text-sm text-gray-900">
                      {returnItem.parsed_product_name}
                    </div>
                  </div>
                )}

                {/* Product Search */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search and Assign Product
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={searchQueries[returnItem.id] || ''}
                          onChange={(e) => handleSearchChange(returnItem.id, e.target.value)}
                          placeholder="Search by title, UPC, SKU, or ASIN..."
                          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {searchLoading[returnItem.id] && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          </div>
                        )}
                      </div>

                      {/* Search Results Dropdown */}
                      {searchResults[returnItem.id]?.length > 0 && !selectedProducts[returnItem.id] && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {searchResults[returnItem.id].map((product) => (
                            <button
                              key={product.id}
                              onClick={() => handleSelectProduct(returnItem.id, product)}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                            >
                              {product.photos && product.photos.length > 0 ? (
                                <img
                                  src={product.photos[0].url}
                                  alt=""
                                  className="w-10 h-10 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {product.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {product.upc && <span className="mr-3">UPC: {product.upc}</span>}
                                  {product.client_listings?.[0]?.asin && (
                                    <span>ASIN: {product.client_listings[0].asin}</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assign Button */}
                    <button
                      onClick={() => handleAssignProduct(returnItem.id)}
                      disabled={!selectedProducts[returnItem.id] || assigningReturn === returnItem.id}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      {assigningReturn === returnItem.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Assigning...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Assign Product
                        </>
                      )}
                    </button>
                  </div>

                  {/* Selected Product Preview */}
                  {selectedProducts[returnItem.id] && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-blue-900 truncate">
                          {selectedProducts[returnItem.id].title}
                        </div>
                        <div className="text-xs text-blue-700">
                          Click "Assign Product" to link this product to the return
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProducts(prev => ({ ...prev, [returnItem.id]: null }))
                          setSearchQueries(prev => ({ ...prev, [returnItem.id]: '' }))
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count Footer */}
      {!loading && returns.length > 0 && (
        <div className="mt-6 text-sm text-gray-500 text-center">
          {returns.length} unmatched return{returns.length !== 1 ? 's' : ''} requiring attention
        </div>
      )}
    </Layout>
  )
}
