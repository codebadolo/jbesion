import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { fetchCurrentUser } from './store/authSlice.js'

import ProtectedRoute from './components/Common/ProtectedRoute.jsx'
import Layout from './components/Layout/Layout.jsx'

import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import FichesInternesList from './pages/Fiches/FichesInternesList.jsx'
import FichesExternesList from './pages/Fiches/FichesExternesList.jsx'
import FicheInterneCreate from './pages/Fiches/FicheInterneCreate.jsx'
import FicheExterneCreate from './pages/Fiches/FicheExterneCreate.jsx'
import FicheDetail from './pages/Fiches/FicheDetail.jsx'
import UsersList from './pages/Admin/UsersList.jsx'
import UserDetail from './pages/Admin/UserDetail.jsx'
import DepartmentsList from './pages/Admin/DepartmentsList.jsx'
import NotFound from './pages/NotFound/NotFound.jsx'
import Profile from './pages/Profile/Profile.jsx'
import NotificationsPage from './pages/Notifications/NotificationsPage.jsx'
import BonsPaiementList from './pages/BonsPaiement/BonsPaiementList.jsx'
import BonPaiementCreate from './pages/BonsPaiement/BonPaiementCreate.jsx'
import BonPaiementDetail from './pages/BonsPaiement/BonPaiementDetail.jsx'

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes wrapped in Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="fiches-internes" element={<FichesInternesList />} />
          <Route path="fiches-internes/create" element={<FicheInterneCreate />} />
          <Route path="fiches-internes/:id" element={<FicheDetail type="interne" />} />
          <Route path="fiches-externes" element={<FichesExternesList />} />
          <Route path="fiches-externes/create" element={<FicheExterneCreate />} />
          <Route path="fiches-externes/:id" element={<FicheDetail type="externe" />} />
          <Route path="admin/utilisateurs" element={<UsersList />} />
          <Route path="admin/utilisateurs/:id" element={<UserDetail />} />
          <Route path="admin/departements" element={<DepartmentsList />} />
          <Route path="profil" element={<Profile />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="bons-paiement" element={<BonsPaiementList />} />
          <Route path="bons-paiement/create" element={<BonPaiementCreate />} />
          <Route path="bons-paiement/:id" element={<BonPaiementDetail />} />
          <Route path="bons-paiement/:id/edit" element={<BonPaiementCreate />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
