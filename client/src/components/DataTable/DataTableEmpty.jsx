import { Button } from '../ui'

/**
 * DataTableEmpty - Empty state component for data tables
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Custom icon element
 * @param {string} props.title - Title text (default: "No results found")
 * @param {string} props.description - Description text
 * @param {Object} props.action - Action button config { label, onClick, variant }
 * @param {string} props.className - Additional CSS classes
 */
export default function DataTableEmpty({
  icon,
  title = 'No results found',
  description,
  action,
  className = '',
}) {
  const defaultIcon = (
    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  )

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="mb-4">
        {icon || defaultIcon}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant || 'primary'}
          size="sm"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
