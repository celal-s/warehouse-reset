import { useMemo } from 'react'
import { Select } from '../ui'

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100]

/**
 * DataTablePagination - Pagination controls component
 * @param {Object} props
 * @param {number} props.page - Current page (1-indexed)
 * @param {number} props.pageSize - Items per page
 * @param {number} props.totalCount - Total number of items
 * @param {Function} props.onPageChange - Callback when page changes
 * @param {Function} props.onPageSizeChange - Callback when page size changes
 * @param {number[]} props.pageSizeOptions - Available page size options
 * @param {string} props.className - Additional CSS classes
 */
export default function DataTablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className = '',
}) {
  const totalPages = Math.ceil(totalCount / pageSize)

  // Calculate "Showing X to Y of Z results"
  const { from, to } = useMemo(() => {
    const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, totalCount)
    return { from, to }
  }, [page, pageSize, totalCount])

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else if (page <= 3) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i)
      }
    } else if (page >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      for (let i = page - 2; i <= page + 2; i++) {
        pages.push(i)
      }
    }

    return pages
  }, [page, totalPages])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      onPageChange(newPage)
    }
  }

  if (totalCount === 0) {
    return null
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Results info */}
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{from}</span> to{' '}
        <span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{totalCount.toLocaleString()}</span> results
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <Select
              value={pageSize}
              onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
              options={pageSizeOptions.map((size) => ({ value: size, label: size.toString() }))}
              className="w-20"
            />
          </div>
        )}

        {/* Pagination buttons */}
        <div className="flex items-center gap-1">
          {/* First page */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
            className="p-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            aria-label="First page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {/* Previous page */}
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="p-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page numbers */}
          {pageNumbers.map((pageNum) => (
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
          ))}

          {/* Next page */}
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className="p-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            aria-label="Next page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Last page */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={page === totalPages}
            className="p-2 border rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            aria-label="Last page"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
