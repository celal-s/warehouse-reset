import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function useClientNavigation() {
  const { clientCode } = useParams()
  const { user } = useAuth()

  const isStaffViewing = user?.role === 'manager' || user?.role === 'admin'

  const navItems = [
    { to: `/client/${clientCode}`, label: 'Dashboard' },
    { to: `/client/${clientCode}/products`, label: 'Products' },
    { to: `/client/${clientCode}/inventory`, label: 'Inventory' },
    { to: `/client/${clientCode}/orders`, label: 'Orders' }
  ]

  return {
    navItems,
    isStaffViewing,
    clientCode
  }
}
