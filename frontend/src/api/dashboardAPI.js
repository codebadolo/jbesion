import axiosInstance from './axios.js'

/**
 * Returns dashboard summary:
 * { stats, recent_fiches, pending_fiches }
 */
export const getDashboardData = () =>
  axiosInstance.get('/dashboard/stats/').then((r) => r.data)
