import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice.js'
import fichesReducer from './fichesSlice.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    fiches: fichesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/loginUser/fulfilled'],
      },
    }),
})
