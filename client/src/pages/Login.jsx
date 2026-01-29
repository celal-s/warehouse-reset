import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Input, Alert } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  function getRedirectPath(user) {
    switch (user.role) {
      case 'admin':
        return '/admin'
      case 'employee':
        return '/employee/scan'
      case 'client':
        return `/client/${user.client_code}`
      default:
        return '/'
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const user = await login(email, password)
      navigate(getRedirectPath(user))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">ShipFifty Warehouse RESET</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />

            <Input
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            fullWidth
          >
            Sign In
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Contact your administrator if you need an account.
          </p>
        </div>
      </div>
    </div>
  )
}
