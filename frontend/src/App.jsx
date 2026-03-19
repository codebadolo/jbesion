import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { fetchCurrentUser } from './store/authSlice.js'

import ProtectedRoute from './components/Common/ProtectedRoute.jsx'
import Layout from './components/Layout/Layout.jsx'

import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import FichesList from './pages/Fiches/FichesList.jsx'
import FicheCreate from './pages/Fiches/FicheCreate.jsx'
import FicheDetail from './pages/Fiches/FicheDetail.jsx'
import UsersList from './pages/Admin/UsersList.jsx'
import DepartmentsList from './pages/Admin/DepartmentsList.jsx'
import NotFound from './pages/NotFound/NotFound.jsx'

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
          <Route path="fiches" element={<FichesList />} />
          <Route path="fiches/create" element={<FicheCreate />} />
          <Route path="fiches-internes/:id" element={<FicheDetail type="interne" />} />
          <Route path="fiches-externes/:id" element={<FicheDetail type="externe" />} />
          <Route path="admin/utilisateurs" element={<UsersList />} />
          <Route path="admin/departements" element={<DepartmentsList />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
