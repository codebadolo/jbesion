import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as notificationsAPI from '../api/notificationsAPI.js'

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationsAPI.getNotifications()
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
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false
        state.items = action.payload.results || []
        state.unreadCount = action.payload.unread_count || 0
      })
      .addCase(fetchNotifications.rejected, (state) => { state.isLoading = false })

      .addCase(markRead.fulfilled, (state, action) => {
        const id = action.payload
        const notif = state.items.find((n) => n.id === id)
        if (notif && !notif.is_read) {
          notif.is_read = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })

      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach((n) => { n.is_read = true })
        state.unreadCount = 0
      })
  },
})

export default notificationsSlice.reducer

export const selectNotifications = (state) => state.notifications.items
export const selectUnreadCount = (state) => state.notifications.unreadCount
export const selectNotificationsLoading = (state) => state.notifications.isLoading
