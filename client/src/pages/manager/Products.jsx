import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { DataTable, DataTableToolbar, useDataTable } from '../../components/DataTable'
import { Button, Alert, Badge } from '../../components/ui'
import { getManagerProducts, searchProducts } from '../../api'
import { managerNavItems } from '../../config/managerNav'

export default function ManagerProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

  // Use the DataTable hook for state management with URL sync
  const {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = useDataTable({
    defaultPageSize: 25,
    syncWithUrl: true,
  })

  // Load products when page changes (not when searching)
  useEffect(() => {
    if (!search) {
      loadProducts()
    }
  }, [page, pageSize])

  // Handle search when search value changes
  useEffect(() => {
    if (search) {
      handleSearch()
    } else if (isSearching) {
      // Clear search, reload normal data
      setIsSearching(false)
      loadProducts()
    }
  }, [search])

  const loadProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getManagerProducts(page, pageSize)
      setProducts(data.products || data)
      setTotalCount(data.total || data.length)
      setIsSearching(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async () => {
    if (!search.trim()) {
      return
    }

    setLoading(true)
    setError(null)
    setIsSearching(true)

    try {
      const results = await searchProducts(search)
      setProducts(results)
      setTotalCount(results.length)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search])

  // Define columns using @tanstack/react-table format
  const columns = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Product',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.photos?.[0] ? (
            <img
              src={row.original.photos[0].url}
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
          <div>
            <div className="font-medium text-gray-900 truncate max-w-md" title={row.original.title}>
              {row.original.title}
            </div>
            {row.original.description && (
              <div className="text-sm text-gray-500 truncate max-w-md" title={row.original.description}>
                {row.original.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'upc',
      header: 'UPC',
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-gray-600">
          {getValue() || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'client_listings',
      header: 'Client Listings',
      enableSorting: false,
      cell: ({ getValue }) => {
        const listings = getValue()
        if (!listings || listings.length === 0) {
          return <span className="text-gray-400 text-sm">None</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {listings.map((listing, idx) => (
              <Badge
                key={idx}
                variant="purple"
                size="sm"
                rounded="default"
                title={`SKU: ${listing.sku || 'N/A'}, Market: ${listing.marketplace?.toUpperCase() || 'N/A'}`}
              >
                {listing.client_code}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'photos',
      header: 'Photos',
      enableSorting: false,
      cell: ({ row }) => {
        const photoCount = row.original.photos?.length || row.original.photo_count || 0
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
            photoCount > 0
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {photoCount}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          to={`/manager/products/${row.original.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          View
        </Link>
      ),
    },
  ], [])

  // Toolbar component
  const toolbar = (
    <DataTableToolbar
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by title, UPC, or SKU..."
    />
  )

  // Empty state configuration
  const emptyState = {
    icon: (
      <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'No products found',
    description: isSearching ? `No results for "${search}"` : undefined,
    action: isSearching ? (
      <Button variant="ghost" onClick={() => setSearch('')}>
        Clear search
      </Button>
    ) : undefined,
  }

  return (
    <Layout title="Products" navItems={managerNavItems}>
      {/* Header with Add Button */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900">Product Catalog</h2>
        <Link to="/manager/products/new">
          <Button
            leftIcon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Product
          </Button>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* Results Info */}
      {!loading && (
        <div className="mb-4 text-sm text-gray-600">
          {isSearching ? (
            <span>Found {totalCount} products matching "{search}"</span>
          ) : (
            <span>Showing {products.length} of {totalCount} products</span>
          )}
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        error={null} // We handle error separately above
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={isSearching ? undefined : setPage}
        onPageSizeChange={isSearching ? undefined : setPageSize}
        pageSizeOptions={pageSizeOptions}
        toolbar={toolbar}
        emptyState={emptyState}
        getRowId={(row) => row.id}
      />
    </Layout>
  )
}
