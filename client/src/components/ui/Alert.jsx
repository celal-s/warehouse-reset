const variants = {
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-400',
    text: 'text-red-700',
  },
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-400',
    text: 'text-green-700',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-400',
    text: 'text-yellow-700',
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-400',
    text: 'text-blue-700',
  },
}

const icons = {
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function Alert({
  children,
  variant = 'info',
  icon = true,
  onDismiss,
  className = '',
  ...props
}) {
  const styles = variants[variant]

  return (
    <div
      role="alert"
      className={`
        p-4 border rounded-lg
        ${styles.container}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      <div className="flex">
        {icon && (
          <div className={`flex-shrink-0 ${styles.icon}`}>
            {typeof icon === 'boolean' ? icons[variant] : icon}
          </div>
        )}
        <div className={`${icon ? 'ml-3' : ''} flex-1 ${styles.text}`}>
          {children}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg hover:bg-black/5 focus:outline-none ${styles.text}`}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
