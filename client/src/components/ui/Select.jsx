import { forwardRef } from 'react'

const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder,
  className = '',
  containerClassName = '',
  id,
  required,
  ...props
}, ref) => {
  const selectId = id || props.name

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`
          w-full px-3 py-2
          border rounded-lg
          bg-white
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          outline-none transition-colors
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option
          const label = typeof option === 'object' ? option.label : option
          const disabled = typeof option === 'object' ? option.disabled : false

          return (
            <option key={value} value={value} disabled={disabled}>
              {label}
            </option>
          )
        })}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
