import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as notificationsAPI from '../api/notificationsAPI.js'

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (params, { rejectWithValue }) => {
    try {
      return await notificationsAPI.getNotifications(params)
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur notifications')
    }
  },
)

export const markRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    try {
      await notificationsAPI.markNotificationRead(id)
      return id
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur')
    }
  },
)

export const markAllRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationsAPI.markAllNotificationsRead()
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur')
    }
  },
)

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    isLoading: false,
    pagination: { count: 0, num_pages: 1, page: 1, page_size: 20 },
    toasts: [],           // notifications à afficher en toast
    seenIds: [],          // IDs déjà connus (pour détecter les nouveaux)
  },
  reducers: {
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false
        const incoming = action.payload.results || []
        state.unreadCount = action.payload.unread_count || 0
        state.pagination = {
          count:     action.payload.count     ?? incoming.length,
          num_pages: action.payload.num_pages ?? 1,
          page:      action.payload.page      ?? 1,
          page_size: action.payload.page_size ?? 20,
        }

        // Detect brand-new notifications (not yet in seenIds)
        const seenSet = new Set(state.seenIds)
        const newNotifs = incoming.filter((n) => !seenSet.has(n.id) && !n.is_read)

        // Only push toasts if we already had some seen IDs (avoid flooding on first load)
        if (state.seenIds.length > 0 && newNotifs.length > 0) {
          state.toasts = [
            ...state.toasts,
            ...newNotifs.map((n) => ({ ...n, _toastId: n.id })),
          ].slice(-5) // max 5 toasts simultanés
        }

        state.seenIds = incoming.map((n) => n.id)
        state.items = incoming
      })
      .addCase(fetchNotifications.rejected, (state) => { state.isLoading = false })

      .addCase(markRead.fulfilled, (state, action) => {
        const id = action.payload
        const notif = state.items.find((n) => n.id === id)
        if (notif && !notif.is_read) {
          notif.is_read = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        state.toasts = state.toasts.filter((t) => t.id !== id)
      })

      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.is_read = true })
        state.unreadCount = 0
        state.toasts = []
      })
  },
})

export const { dismissToast } = notificationsSlice.actions
export default notificationsSlice.reducer

export const selectNotifications = (state) => state.notifications.items
export const selectUnreadCount = (state) => state.notifications.unreadCount
export const selectNotificationsLoading = (state) => state.notifications.isLoading
export const selectToasts = (state) => state.notifications.toasts
export const selectNotificationsPagination = (state) => state.notifications.pagination
