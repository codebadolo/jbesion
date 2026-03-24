import axiosInstance from './axios.js'

export const getNotifications = (params) =>
  axiosInstance.get('/notifications/', { params }).then((r) => r.data)

export const markNotificationRead = (id) =>
  axiosInstance.post(`/notifications/${id}/mark_read/`).then((r) => r.data)

export const markAllNotificationsRead = () =>
  axiosInstance.post('/notifications/mark_all_read/').then((r) => r.data)
