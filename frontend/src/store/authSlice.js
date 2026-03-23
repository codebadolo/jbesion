import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as authAPI from '../api/authAPI.js'

// ── Thunks ───────────────────────────────────────────────────────────────────

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authAPI.login(credentials)
      return data
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Identifiants incorrects. Veuillez réessayer.'
      return rejectWithValue(message)
    }
  },
)

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authAPI.getCurrentUser()
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur de récupération du profil')
    }
  },
)

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data, { rejectWithValue }) => {
    try {
      return await authAPI.updateProfile(data)
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur lors de la mise à jour du profil')
    }
  },
)

export const uploadAvatar = createAsyncThunk(
  'auth/uploadAvatar',
  async (file, { rejectWithValue }) => {
    try {
      return await authAPI.uploadAvatar(file)
    } catch (err) {
      return rejectWithValue(err.response?.data || "Erreur lors de l'upload de l'avatar")
    }
  },
)

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (data, { rejectWithValue }) => {
    try {
      return await authAPI.changePassword(data)
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur lors du changement de mot de passe')
    }
  },
)

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState }) => {
    const { refreshToken } = getState().auth
    if (refreshToken) {
      await authAPI.logout(refreshToken)
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  },
)

// ── Slice ────────────────────────────────────────────────────────────────────

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    setCredentials(state, action) {
      const { token, refreshToken, user } = action.payload
      state.token = token
      state.refreshToken = refreshToken
      state.user = user
      state.isAuthenticated = true
      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
    },
  },
  extraReducers: (builder) => {
    // loginUser
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.token = action.payload.access
        state.refreshToken = action.payload.refresh
        state.user = action.payload.user
        state.isAuthenticated = true
        state.error = null
        localStorage.setItem('token', action.payload.access)
        localStorage.setItem('refreshToken', action.payload.refresh)
        localStorage.setItem('user', JSON.stringify(action.payload.user))
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
        state.isAuthenticated = false
      })

    // fetchCurrentUser
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.isLoading = true
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload
        state.isAuthenticated = true
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.token = null
        state.refreshToken = null
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
      })

    // updateProfile / uploadAvatar
    builder
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
      .addCase(uploadAvatar.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })

    // logoutUser
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
    })
  },
})

export const { clearError, setCredentials } = authSlice.actions
export default authSlice.reducer

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated
export const selectAuthLoading = (state) => state.auth.isLoading
export const selectAuthError = (state) => state.auth.error
