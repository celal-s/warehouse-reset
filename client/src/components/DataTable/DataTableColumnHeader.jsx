/**
 * DataTableColumnHeader - Sortable column header component
 * @param {Object} props
 * @param {Object} props.column - Column object from @tanstack/react-table
 * @param {string} props.title - Column title to display
 * @param {boolean} props.sortable - Whether the column is sortable (default: true)
 * @param {string} props.className - Additional CSS classes
 */
export default function DataTableColumnHeader({
  column,
  title,
  sortable = true,
  className = '',
}) {
  if (!sortable || !column.getCanSort()) {
    return (
      <div className={`flex items-center ${className}`}>
        {title}
      </div>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${className}`}
    >
      {title}
      <span className="flex flex-col ml-1">
        {sorted === 'asc' ? (
          // Sort ascending - up arrow
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : sorted === 'desc' ? (
          // Sort descending - down arrow
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          // Unsorted - up-down arrows
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    </button>
  )
}
