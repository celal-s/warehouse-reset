import { forwardRef } from 'react'

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 border-transparent',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400 border-transparent',
  success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 border-transparent',
  warning: 'bg-yellow-600 text-white hover:bg-yellow-700 disabled:bg-yellow-400 border-transparent',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400 border-transparent',
  outline: 'bg-transparent text-gray-700 hover:bg-gray-50 border-gray-300 disabled:text-gray-400',
  link: 'bg-transparent text-blue-600 hover:text-blue-800 hover:underline disabled:text-blue-400 border-transparent p-0',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-5 h-5',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg border
        transition-colors duration-150
        disabled:cursor-not-allowed
        ${variants[variant]}
        ${variant !== 'link' ? sizes[size] : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {loading ? (
        <svg
          className={`animate-spin ${iconSizes[size]}`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : leftIcon ? (
        <span className={iconSizes[size]}>{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && (
        <span className={iconSizes[size]}>{rightIcon}</span>
      )}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
