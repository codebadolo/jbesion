import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice.js'
import fichesReducer from './fichesSlice.js'
import notificationsReducer from './notificationsSlice.js'
import bonsPaiementReducer from './bonsPaiementSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    fiches: fichesReducer,
    notifications: notificationsReducer,
    bonsPaiement: bonsPaiementReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/loginUser/fulfilled'],
      },
    }),
})
