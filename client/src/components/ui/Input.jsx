import { forwardRef } from 'react'

const Input = forwardRef(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  containerClassName = '',
  id,
  required,
  ...props
}, ref) => {
  const inputId = id || props.name

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2
            border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            outline-none transition-colors
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input

// Search input with icon
export function SearchInput({ className = '', ...props }) {
  return (
    <Input
      type="search"
      leftIcon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      className={className}
      {...props}
    />
  )
}
