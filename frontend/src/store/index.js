import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice.js'
import fichesReducer from './fichesSlice.js'
import notificationsReducer from './notificationsSlice.js'
import bonsPaiementReducer from './bonsPaiementSlice.js'
import bonsCommandeReducer from './bonsCommandeSlice.js'
import missionsReducer from './missionsSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    fiches: fichesReducer,
    notifications: notificationsReducer,
    bonsPaiement: bonsPaiementReducer,
    bonsCommande: bonsCommandeReducer,
    missions: missionsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/loginUser/fulfilled'],
      },
    }),
})
