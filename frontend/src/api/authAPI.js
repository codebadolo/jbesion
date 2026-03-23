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

/**
 * Update current user profile (text fields).
 */
export const updateProfile = (data) =>
  axiosInstance.patch('/auth/me/', data).then((r) => r.data)

/**
 * Upload avatar (multipart/form-data).
 */
export const uploadAvatar = (file) => {
  const formData = new FormData()
  formData.append('avatar', file)
  return axiosInstance
    .patch('/auth/me/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}

/**
 * Change password.
 */
export const changePassword = (data) =>
  axiosInstance.post('/auth/me/change_password/', data).then((r) => r.data)
