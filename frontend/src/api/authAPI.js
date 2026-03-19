import axiosInstance from './axios.js'

/**
 * Authenticate with email + password.
 * Returns { access, refresh, user }
 */
export const login = (credentials) =>
  axiosInstance.post('/auth/login/', credentials).then((r) => r.data)

/**
 * Fetch the authenticated user's profile.
 */
export const getCurrentUser = () =>
  axiosInstance.get('/auth/me/').then((r) => r.data)

/**
 * Obtain a new access token using the refresh token.
 */
export const refreshToken = (refresh) =>
  axiosInstance
    .post('/auth/token/refresh/', { refresh })
    .then((r) => r.data)

/**
 * Logout: invalidate refresh token server-side.
 */
export const logout = (refresh) =>
  axiosInstance
    .post('/auth/logout/', { refresh })
    .then((r) => r.data)
    .catch(() => null) // best-effort
