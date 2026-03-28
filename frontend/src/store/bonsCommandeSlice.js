import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as api from '../api/bonsCommandeAPI.js'

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchBonsCommande = createAsyncThunk(
  'bonsCommande/fetchAll',
  async (params, { rejectWithValue }) => {
    try { return await api.getBonsCommande(params) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const fetchBonCommandeById = createAsyncThunk(
  'bonsCommande/fetchById',
  async (id, { rejectWithValue }) => {
    try { return await api.getBonCommandeById(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const createBonCommande = createAsyncThunk(
  'bonsCommande/create',
  async (data, { rejectWithValue }) => {
    try { return await api.createBonCommande(data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const updateBonCommande = createAsyncThunk(
  'bonsCommande/update',
  async ({ id, data }, { rejectWithValue }) => {
    try { return await api.updateBonCommande(id, data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const deleteBonCommande = createAsyncThunk(
  'bonsCommande/delete',
  async (id, { rejectWithValue }) => {
    try { await api.deleteBonCommande(id); return id }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

const makeWorkflowThunk = (name, apiFn) =>
  createAsyncThunk(`bonsCommande/${name}`, async (arg, { rejectWithValue }) => {
    try { return await apiFn(arg) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  })

export const soumettreDAF      = makeWorkflowThunk('soumettreDAF',  (id) => api.soumettreDAF(id))
export const validerProformas  = makeWorkflowThunk('validerProformas', ({ id, data }) => api.validerProformas(id, data))
export const approuverDAF      = makeWorkflowThunk('approuverDAF',  ({ id, data }) => api.approuverDAF(id, data))
export const rejeterDAF        = makeWorkflowThunk('rejeterDAF',    ({ id, data }) => api.rejeterDAF(id, data))
export const approuverDG       = makeWorkflowThunk('approuverDG',   ({ id, data }) => api.approuverDG(id, data))
export const rejeterDG         = makeWorkflowThunk('rejeterDG',     ({ id, data }) => api.rejeterDG(id, data))
export const executerBC        = makeWorkflowThunk('executer',      (id) => api.executerBonCommande(id))
export const cloturerBC        = makeWorkflowThunk('cloturer',      (id) => api.cloturerBonCommande(id))
export const selectionnerFourn = makeWorkflowThunk('selectionner',  ({ id, proformaId }) => api.selectionnerFournisseur(id, proformaId))

export const uploadProforma = createAsyncThunk(
  'bonsCommande/uploadProforma',
  async ({ bonId, formData }, { rejectWithValue }) => {
    try { return await api.uploadProforma(bonId, formData) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const deleteProforma = createAsyncThunk(
  'bonsCommande/deleteProforma',
  async ({ bonId, proformaId }, { rejectWithValue }) => {
    try { await api.deleteProforma(bonId, proformaId); return proformaId }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const updateCurrent = (state, { payload }) => { state.loading = false; state.current = payload }
const pending       = (state) => { state.loading = true;  state.error = null }
const rejected      = (state, action) => { state.loading = false; state.error = action.payload }

const bonsCommandeSlice = createSlice({
  name: 'bonsCommande',
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
    builder
      .addCase(fetchBonsCommande.pending, pending)
      .addCase(fetchBonsCommande.fulfilled, (state, { payload }) => {
        state.loading = false
        state.list = payload.results ?? payload
        if (payload.count !== undefined) {
          state.pagination = { count: payload.count, next: payload.next, previous: payload.previous }
        }
      })
      .addCase(fetchBonsCommande.rejected, rejected)
      .addCase(fetchBonCommandeById.pending, pending)
      .addCase(fetchBonCommandeById.fulfilled, updateCurrent)
      .addCase(fetchBonCommandeById.rejected, rejected)
      .addCase(createBonCommande.pending, pending)
      .addCase(createBonCommande.fulfilled, updateCurrent)
      .addCase(createBonCommande.rejected, rejected)
      .addCase(updateBonCommande.pending, pending)
      .addCase(updateBonCommande.fulfilled, updateCurrent)
      .addCase(updateBonCommande.rejected, rejected)
      .addCase(deleteBonCommande.pending, pending)
      .addCase(deleteBonCommande.fulfilled, (state, { payload: id }) => {
        state.loading = false
        state.list = state.list.filter((b) => b.id !== id)
        if (state.current?.id === id) state.current = null
      })
      .addCase(deleteBonCommande.rejected, rejected)

    // Workflow actions — tous mettent à jour current
    for (const thunk of [soumettreDAF, validerProformas, approuverDAF, rejeterDAF, approuverDG, rejeterDG, executerBC, cloturerBC, selectionnerFourn]) {
      builder.addCase(thunk.pending, pending)
      builder.addCase(thunk.fulfilled, updateCurrent)
      builder.addCase(thunk.rejected, rejected)
    }

    // Proforma upload
    builder
      .addCase(uploadProforma.pending, pending)
      .addCase(uploadProforma.fulfilled, (state, { payload }) => {
        state.loading = false
        if (state.current) {
          state.current.factures_proforma = [...(state.current.factures_proforma || []), payload]
        }
      })
      .addCase(uploadProforma.rejected, rejected)

    builder
      .addCase(deleteProforma.pending, pending)
      .addCase(deleteProforma.fulfilled, (state, { payload: proformaId }) => {
        state.loading = false
        if (state.current) {
          state.current.factures_proforma = (state.current.factures_proforma || []).filter(
            (p) => p.id !== proformaId
          )
          if (state.current.fournisseur_selectionne?.id === proformaId) {
            state.current.fournisseur_selectionne = null
            state.current.fournisseur_selectionne_detail = null
          }
        }
      })
      .addCase(deleteProforma.rejected, rejected)
  },
})

export const { clearCurrent, clearError } = bonsCommandeSlice.actions

export const selectBonsCommande           = (state) => state.bonsCommande.list
export const selectBonsCommandePagination = (state) => state.bonsCommande.pagination
export const selectCurrentBonCommande     = (state) => state.bonsCommande.current
export const selectBonsCommandeLoading    = (state) => state.bonsCommande.loading
export const selectBonsCommandeError      = (state) => state.bonsCommande.error

export default bonsCommandeSlice.reducer
