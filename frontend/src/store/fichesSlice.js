import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as fichesAPI from '../api/fichesAPI.js'

// ── Thunks ───────────────────────────────────────────────────────────────────

export const fetchFiches = createAsyncThunk(
  'fiches/fetchFiches',
  async ({ type = 'interne', params = {} } = {}, { rejectWithValue }) => {
    try {
      const data =
        type === 'interne'
          ? await fichesAPI.getFichesInternes(params)
          : await fichesAPI.getFichesExternes(params)
      return { type, data }
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur lors du chargement des fiches')
    }
  },
)

export const fetchFicheById = createAsyncThunk(
  'fiches/fetchFicheById',
  async ({ id, type }, { rejectWithValue }) => {
    try {
      const data =
        type === 'interne'
          ? await fichesAPI.getFicheInterneById(id)
          : await fichesAPI.getFicheExterneById(id)
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Fiche introuvable')
    }
  },
)

export const createFiche = createAsyncThunk(
  'fiches/createFiche',
  async ({ type, data }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.createFicheInterne(data)
          : await fichesAPI.createFicheExterne(data)
      return { type, data: result }
    } catch (err) {
      const message =
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        'Erreur lors de la création'
      return rejectWithValue(message)
    }
  },
)

export const updateFiche = createAsyncThunk(
  'fiches/updateFiche',
  async ({ id, type, data }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.updateFicheInterne(id, data)
          : await fichesAPI.updateFicheExterne(id, data)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data || 'Erreur lors de la mise à jour')
    }
  },
)

export const submitFiche = createAsyncThunk(
  'fiches/submitFiche',
  async ({ id, type }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.submitFicheInterne(id)
          : await fichesAPI.submitFicheExterne(id)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Erreur lors de la soumission')
    }
  },
)

export const validateFiche = createAsyncThunk(
  'fiches/validateFiche',
  async ({ id, type, data }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.validateFicheInterne(id, data)
          : await fichesAPI.validateFicheExterne(id, data)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Erreur lors de la validation')
    }
  },
)

export const executeFiche = createAsyncThunk(
  'fiches/executeFiche',
  async ({ id, type, data }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.executeFicheInterne(id, data)
          : await fichesAPI.executeFicheExterne(id, data)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || "Erreur lors de l'exécution")
    }
  },
)

export const markReceived = createAsyncThunk(
  'fiches/markReceived',
  async ({ id, type }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.markReceivedFicheInterne(id)
          : await fichesAPI.markReceivedFicheExterne(id)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Erreur lors de la réception')
    }
  },
)

export const respondClarification = createAsyncThunk(
  'fiches/respondClarification',
  async ({ id, type, data }, { rejectWithValue }) => {
    try {
      const result =
        type === 'interne'
          ? await fichesAPI.respondClarificationFicheInterne(id, data)
          : await fichesAPI.respondClarificationFicheExterne(id, data)
      return result
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Erreur lors de la réponse')
    }
  },
)

// ── Slice ────────────────────────────────────────────────────────────────────

const initialState = {
  fichesInternes: [],
  fichesInternesCount: 0,
  fichesExternes: [],
  fichesExternesCount: 0,
  currentFiche: null,
  isLoading: false,
  error: null,
}

const fichesSlice = createSlice({
  name: 'fiches',
  initialState,
  reducers: {
    clearCurrentFiche(state) {
      state.currentFiche = null
    },
    clearFichesError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // fetchFiches
    builder
      .addCase(fetchFiches.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFiches.fulfilled, (state, action) => {
        state.isLoading = false
        const { type, data } = action.payload
        const list = Array.isArray(data) ? data : data.results ?? []
        const count = Array.isArray(data) ? data.length : (data.count ?? list.length)
        if (type === 'interne') {
          state.fichesInternes = list
          state.fichesInternesCount = count
        } else {
          state.fichesExternes = list
          state.fichesExternesCount = count
        }
      })
      .addCase(fetchFiches.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // fetchFicheById
    builder
      .addCase(fetchFicheById.pending, (state) => {
        state.isLoading = true
        state.currentFiche = null
        state.error = null
      })
      .addCase(fetchFicheById.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentFiche = action.payload
      })
      .addCase(fetchFicheById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // createFiche
    builder
      .addCase(createFiche.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createFiche.fulfilled, (state, action) => {
        state.isLoading = false
        const { type, data } = action.payload
        if (type === 'interne') {
          state.fichesInternes.unshift(data)
        } else {
          state.fichesExternes.unshift(data)
        }
        state.currentFiche = data
      })
      .addCase(createFiche.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // updateFiche
    builder
      .addCase(updateFiche.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateFiche.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentFiche = action.payload
      })
      .addCase(updateFiche.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // submitFiche
    builder
      .addCase(submitFiche.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(submitFiche.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentFiche = action.payload
      })
      .addCase(submitFiche.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // validateFiche
    builder
      .addCase(validateFiche.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(validateFiche.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentFiche = action.payload
      })
      .addCase(validateFiche.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

    // executeFiche
    builder
      .addCase(executeFiche.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(executeFiche.fulfilled, (state, action) => { state.isLoading = false; state.currentFiche = action.payload })
      .addCase(executeFiche.rejected, (state, action) => { state.isLoading = false; state.error = action.payload })

    // markReceived
    builder
      .addCase(markReceived.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(markReceived.fulfilled, (state, action) => { state.isLoading = false; state.currentFiche = action.payload })
      .addCase(markReceived.rejected, (state, action) => { state.isLoading = false; state.error = action.payload })

    // respondClarification
    builder
      .addCase(respondClarification.pending, (state) => { state.isLoading = true; state.error = null })
      .addCase(respondClarification.fulfilled, (state, action) => { state.isLoading = false; state.currentFiche = action.payload })
      .addCase(respondClarification.rejected, (state, action) => { state.isLoading = false; state.error = action.payload })
  },
})

export const { clearCurrentFiche, clearFichesError } = fichesSlice.actions
export default fichesSlice.reducer

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectFichesInternes = (state) => state.fiches.fichesInternes
export const selectFichesInternesCount = (state) => state.fiches.fichesInternesCount
export const selectFichesExternes = (state) => state.fiches.fichesExternes
export const selectFichesExternesCount = (state) => state.fiches.fichesExternesCount
export const selectCurrentFiche = (state) => state.fiches.currentFiche
export const selectFichesLoading = (state) => state.fiches.isLoading
export const selectFichesError = (state) => state.fiches.error
