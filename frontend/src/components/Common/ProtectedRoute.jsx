import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUser } from '../../store/authSlice.js'

/**
 * Wraps a route to require authentication (and optionally specific roles).
 *
 * Props:
 *   children  – the protected component tree
 *   roles     – optional string[] of allowed role codes (e.g. ['ADMIN', 'MANAGER'])
 */
export default function ProtectedRoute({ children, roles }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && roles.length > 0) {
    const userRole = user?.role || user?.role_code
    if (!roles.includes(userRole)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès refusé</h2>
            <p className="text-gray-500">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
          </div>
        </div>
      )
    }
  }

  return children
}
