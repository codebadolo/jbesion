import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as api from '../api/missionsAPI.js'

// ── Thunks Fiches Mission ─────────────────────────────────────────────────────

export const fetchFichesMission = createAsyncThunk(
  'missions/fetchAll',
  async (params, { rejectWithValue }) => {
    try { return await api.getFichesMission(params) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const fetchFicheMissionById = createAsyncThunk(
  'missions/fetchById',
  async (id, { rejectWithValue }) => {
    try { return await api.getFicheMissionById(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const createFicheMission = createAsyncThunk(
  'missions/create',
  async (data, { rejectWithValue }) => {
    try { return await api.createFicheMission(data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const updateFicheMission = createAsyncThunk(
  'missions/update',
  async ({ id, data }, { rejectWithValue }) => {
    try { return await api.updateFicheMission(id, data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const deleteFicheMission = createAsyncThunk(
  'missions/delete',
  async (id, { rejectWithValue }) => {
    try { await api.deleteFicheMission(id); return id }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const soumettreMission = createAsyncThunk(
  'missions/soumettre',
  async (id, { rejectWithValue }) => {
    try { return await api.soumettreMission(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const validerMission = createAsyncThunk(
  'missions/valider',
  async ({ id, data }, { rejectWithValue }) => {
    try { return await api.validerMission(id, data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const rejeterMission = createAsyncThunk(
  'missions/rejeter',
  async ({ id, data }, { rejectWithValue }) => {
    try { return await api.rejeterMission(id, data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const cloturerMission = createAsyncThunk(
  'missions/cloturer',
  async (id, { rejectWithValue }) => {
    try { return await api.cloturerMission(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

// ── Thunks Absences ───────────────────────────────────────────────────────────

export const fetchAbsences = createAsyncThunk(
  'missions/fetchAbsences',
  async (params, { rejectWithValue }) => {
    try { return await api.getAbsences(params) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const createAbsence = createAsyncThunk(
  'missions/createAbsence',
  async (data, { rejectWithValue }) => {
    try { return await api.createAbsence(data) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const validerAbsence = createAsyncThunk(
  'missions/validerAbsence',
  async (id, { rejectWithValue }) => {
    try { return await api.validerAbsence(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

export const annulerAbsence = createAsyncThunk(
  'missions/annulerAbsence',
  async (id, { rejectWithValue }) => {
    try { return await api.annulerAbsence(id) }
    catch (e) { return rejectWithValue(e.response?.data || 'Erreur serveur') }
  }
)

// ── Slice ─────────────────────────────────────────────────────────────────────

const updateCurrent = (state, { payload }) => { state.loading = false; state.current = payload }
const pending       = (state) => { state.loading = true;  state.error = null }
const rejected      = (state, action) => { state.loading = false; state.error = action.payload }
const updateAbsence = (state, { payload }) => {
  state.loading = false
  state.absences = state.absences.map((a) => a.id === payload.id ? payload : a)
}

const missionsSlice = createSlice({
  name: 'missions',
  initialState: {
    list: [],
    pagination: { count: 0, next: null, previous: null },
    current: null,
    absences: [],
    absencesPagination: { count: 0, next: null, previous: null },
    loading: false,
    error: null,
  },
  reducers: {
    clearCurrent(state) { state.current = null },
    clearError(state)   { state.error = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFichesMission.pending, pending)
      .addCase(fetchFichesMission.fulfilled, (state, { payload }) => {
        state.loading = false
        state.list = payload.results ?? payload
        if (payload.count !== undefined) {
          state.pagination = { count: payload.count, next: payload.next, previous: payload.previous }
        }
      })
      .addCase(fetchFichesMission.rejected, rejected)

      .addCase(fetchFicheMissionById.pending, pending)
      .addCase(fetchFicheMissionById.fulfilled, updateCurrent)
      .addCase(fetchFicheMissionById.rejected, rejected)

      .addCase(createFicheMission.pending, pending)
      .addCase(createFicheMission.fulfilled, updateCurrent)
      .addCase(createFicheMission.rejected, rejected)

      .addCase(updateFicheMission.pending, pending)
      .addCase(updateFicheMission.fulfilled, updateCurrent)
      .addCase(updateFicheMission.rejected, rejected)

      .addCase(deleteFicheMission.pending, pending)
      .addCase(deleteFicheMission.fulfilled, (state, { payload: id }) => {
        state.loading = false
        state.list = state.list.filter((m) => m.id !== id)
        if (state.current?.id === id) state.current = null
      })
      .addCase(deleteFicheMission.rejected, rejected)

    for (const thunk of [soumettreMission, validerMission, rejeterMission, cloturerMission]) {
      builder.addCase(thunk.pending, pending)
      builder.addCase(thunk.fulfilled, updateCurrent)
      builder.addCase(thunk.rejected, rejected)
    }

    // Absences
    builder
      .addCase(fetchAbsences.pending, pending)
      .addCase(fetchAbsences.fulfilled, (state, { payload }) => {
        state.loading = false
        state.absences = payload.results ?? payload
        if (payload.count !== undefined) {
          state.absencesPagination = { count: payload.count, next: payload.next, previous: payload.previous }
        }
      })
      .addCase(fetchAbsences.rejected, rejected)

      .addCase(createAbsence.pending, pending)
      .addCase(createAbsence.fulfilled, (state, { payload }) => {
        state.loading = false
        state.absences = [payload, ...state.absences]
      })
      .addCase(createAbsence.rejected, rejected)

      .addCase(validerAbsence.pending, pending)
      .addCase(validerAbsence.fulfilled, updateAbsence)
      .addCase(validerAbsence.rejected, rejected)

      .addCase(annulerAbsence.pending, pending)
      .addCase(annulerAbsence.fulfilled, updateAbsence)
      .addCase(annulerAbsence.rejected, rejected)
  },
})

export const { clearCurrent, clearError } = missionsSlice.actions

export const selectFichesMission           = (state) => state.missions.list
export const selectFichesMissionPagination = (state) => state.missions.pagination
export const selectCurrentMission          = (state) => state.missions.current
export const selectAbsences                = (state) => state.missions.absences
export const selectAbsencesPagination      = (state) => state.missions.absencesPagination
export const selectMissionsLoading         = (state) => state.missions.loading
export const selectMissionsError           = (state) => state.missions.error

export default missionsSlice.reducer
