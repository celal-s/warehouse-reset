const variants = {
  gray: 'bg-gray-100 text-gray-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  pink: 'bg-pink-100 text-pink-800',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export default function Badge({
  children,
  variant = 'gray',
  size = 'md',
  rounded = 'full',
  className = '',
  ...props
}) {
  return (
    <span
      className={`
        inline-flex items-center font-medium
        ${variants[variant]}
        ${sizes[size]}
        ${rounded === 'full' ? 'rounded-full' : 'rounded'}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </span>
  )
}

// Status badge helper for common status patterns
const statusConfig = {
  // General statuses
  active: { variant: 'green', label: 'Active' },
  inactive: { variant: 'red', label: 'Inactive' },
  pending: { variant: 'yellow', label: 'Pending' },
  completed: { variant: 'green', label: 'Completed' },
  cancelled: { variant: 'gray', label: 'Cancelled' },

  // Return statuses
  matched: { variant: 'blue', label: 'Matched' },
  shipped: { variant: 'purple', label: 'Shipped' },
  unmatched: { variant: 'red', label: 'Unmatched' },

  // Inventory statuses
  awaiting_decision: { variant: 'yellow', label: 'Awaiting Decision' },
  decision_made: { variant: 'blue', label: 'Decision Made' },
  processed: { variant: 'green', label: 'Processed' },

  // Decision statuses
  ship_to_fba: { variant: 'blue', label: 'Ship to FBA' },
  return_to_client: { variant: 'purple', label: 'Return' },
  dispose: { variant: 'red', label: 'Dispose' },
  keep_in_stock: { variant: 'green', label: 'Keep in Stock' },

  // Conditions
  sellable: { variant: 'green', label: 'Sellable' },
  damaged: { variant: 'red', label: 'Damaged' },

  // User roles
  admin: { variant: 'purple', label: 'Admin' },
  manager: { variant: 'orange', label: 'Manager' },
  employee: { variant: 'blue', label: 'Employee' },
  client: { variant: 'green', label: 'Client' },

  // Location types
  pallet: { variant: 'blue', label: 'Pallet' },
  box: { variant: 'orange', label: 'Box' },
}

export function StatusBadge({ status, size = 'md', className = '' }) {
  const config = statusConfig[status] || { variant: 'gray', label: status }
  const label = config.label || status?.replace(/_/g, ' ') || 'Unknown'

  return (
    <Badge variant={config.variant} size={size} className={className}>
      {label}
    </Badge>
  )
}
