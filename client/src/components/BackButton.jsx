import { useLocation, useNavigate } from 'react-router-dom'

export default function BackButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname

  // Auto-hide on Home and Login pages
  if (currentPath === '/' || currentPath === '/login') {
    return null
  }

  const handleClick = () => {
    // Use browser history if available
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    // Smart fallback routes by path prefix
    if (currentPath.startsWith('/manager')) {
      navigate('/manager')
    } else if (currentPath.startsWith('/admin')) {
      navigate('/admin')
    } else if (currentPath.startsWith('/client/')) {
      // Extract client code from path like /client/{clientCode}/...
      const pathParts = currentPath.split('/')
      const clientCode = pathParts[2]
      if (clientCode) {
        navigate(`/client/${clientCode}`)
      } else {
        navigate('/')
      }
    } else if (currentPath.startsWith('/employee')) {
      navigate('/employee')
    } else {
      navigate('/')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="text-gray-500 hover:text-gray-700"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
