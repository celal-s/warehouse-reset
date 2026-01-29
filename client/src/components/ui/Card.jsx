export default function Card({
  children,
  title,
  description,
  actions,
  padding = true,
  className = '',
  ...props
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow ${className}`}
      {...props}
    >
      {(title || description || actions) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>
        {children}
      </div>
    </div>
  )
}

// Simple card section divider
export function CardDivider() {
  return <hr className="border-gray-200 my-4" />
}

// Card with just content, no header
export function SimpleCard({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={`bg-white rounded-lg shadow ${padding ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
