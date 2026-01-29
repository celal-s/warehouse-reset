const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
}

const colors = {
  primary: 'border-blue-600',
  white: 'border-white',
  gray: 'border-gray-600',
}

export default function Spinner({
  size = 'md',
  color = 'primary',
  className = '',
  label = 'Loading...',
  showLabel = false,
  ...props
}) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} {...props}>
      <div
        className={`
          animate-spin rounded-full
          border-2 border-t-transparent
          ${sizes[size]}
          ${colors[color]}
        `.trim().replace(/\s+/g, ' ')}
        role="status"
        aria-label={label}
      />
      {showLabel && (
        <span className="text-sm text-gray-500">{label}</span>
      )}
    </div>
  )
}

// Centered spinner for loading states
export function LoadingState({
  size = 'lg',
  message = 'Loading...',
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Spinner size={size} />
      {message && (
        <p className="mt-3 text-sm text-gray-500">{message}</p>
      )}
    </div>
  )
}
