import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as api from '../api/bonsPaiementAPI.js'

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchBonsPaiement = createAsyncThunk(
  'bonsPaiement/fetchAll',
  async (params, { rejectWithValue }) => {
    try { return await api.getBonsPaiement(params) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const fetchBonPaiementById = createAsyncThunk(
  'bonsPaiement/fetchById',
  async (id, { rejectWithValue }) => {
    try { return await api.getBonPaiementById(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const createBonPaiement = createAsyncThunk(
  'bonsPaiement/create',
  async (data, { rejectWithValue }) => {
    try { return await api.createBonPaiement(data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const updateBonPaiement = createAsyncThunk(
  'bonsPaiement/update',
  async ({ id, data }, { rejectWithValue }) => {
    try { return await api.updateBonPaiement(id, data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const deleteBonPaiement = createAsyncThunk(
  'bonsPaiement/delete',
  async (id, { rejectWithValue }) => {
    try { await api.deleteBonPaiement(id); return id }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const validateBonPaiement = createAsyncThunk(
  'bonsPaiement/validate',
  async (id, { rejectWithValue }) => {
    try { return await api.validateBonPaiement(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const cancelBonPaiement = createAsyncThunk(
  'bonsPaiement/cancel',
  async (id, { rejectWithValue }) => {
    try { return await api.cancelBonPaiement(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const bonsPaiementSlice = createSlice({
  name: 'bonsPaiement',
  initialState: {
    list: [],
    pagination: { count: 0, next: null, previous: null },
    current: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearCurrent(state) { state.current = null },
    clearError(state)   { state.error = null },
  },
  extraReducers: (builder) => {
    const pending  = (state)        => { state.loading = true;  state.error = null }
    const rejected = (state, action) => { state.loading = false; state.error = action.payload }

    builder
      // list
      .addCase(fetchBonsPaiement.pending, pending)
      .addCase(fetchBonsPaiement.fulfilled, (state, { payload }) => {
        state.loading = false
        state.list = payload.results ?? payload
        if (payload.count !== undefined) {
          state.pagination = { count: payload.count, next: payload.next, previous: payload.previous }
        }
      })
      .addCase(fetchBonsPaiement.rejected, rejected)
      // fetchById
      .addCase(fetchBonPaiementById.pending, pending)
      .addCase(fetchBonPaiementById.fulfilled, (state, { payload }) => {
        state.loading = false; state.current = payload
      })
      .addCase(fetchBonPaiementById.rejected, rejected)
      // create
      .addCase(createBonPaiement.pending, pending)
      .addCase(createBonPaiement.fulfilled, (state, { payload }) => {
        state.loading = false; state.current = payload
      })
      .addCase(createBonPaiement.rejected, rejected)
      // update
      .addCase(updateBonPaiement.pending, pending)
      .addCase(updateBonPaiement.fulfilled, (state, { payload }) => {
        state.loading = false; state.current = payload
      })
      .addCase(updateBonPaiement.rejected, rejected)
      // delete
      .addCase(deleteBonPaiement.pending, pending)
      .addCase(deleteBonPaiement.fulfilled, (state, { payload: id }) => {
        state.loading = false
        state.list = state.list.filter((b) => b.id !== id)
        if (state.current?.id === id) state.current = null
      })
      .addCase(deleteBonPaiement.rejected, rejected)
      // validate
      .addCase(validateBonPaiement.pending, pending)
      .addCase(validateBonPaiement.fulfilled, (state, { payload }) => {
        state.loading = false; state.current = payload
      })
      .addCase(validateBonPaiement.rejected, rejected)
      // cancel
      .addCase(cancelBonPaiement.pending, pending)
      .addCase(cancelBonPaiement.fulfilled, (state, { payload }) => {
        state.loading = false; state.current = payload
      })
      .addCase(cancelBonPaiement.rejected, rejected)
  },
})

export const { clearCurrent, clearError } = bonsPaiementSlice.actions

export const selectBonsPaiement      = (state) => state.bonsPaiement.list
export const selectBonsPaiementPagination = (state) => state.bonsPaiement.pagination
export const selectCurrentBon        = (state) => state.bonsPaiement.current
export const selectBonsPaiementLoading = (state) => state.bonsPaiement.loading
export const selectBonsPaiementError = (state) => state.bonsPaiement.error

export default bonsPaiementSlice.reducer
