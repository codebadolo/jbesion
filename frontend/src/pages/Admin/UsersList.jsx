import React, { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectUser } from '../../store/authSlice.js'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDepartments,
  getManagers,
} from '../../api/adminAPI.js'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employé' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'DAF', label: 'DAF' },
  { value: 'DIRECTOR', label: 'Directeur' },
  { value: 'ADMIN', label: 'Admin' },
]

const ROLE_BADGE = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  DAF: 'bg-purple-100 text-purple-700',
  DIRECTOR: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-red-100 text-red-700',
}

const ROLE_LABELS = {
  EMPLOYEE: 'Employé',
  MANAGER: 'Manager',
  DAF: 'DAF',
  DIRECTOR: 'Directeur',
  ADMIN: 'Admin',
}

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  role: 'EMPLOYEE',
  department: '',
  manager: '',
  password: '',
  password_confirm: '',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[role] || 'bg-gray-100 text-gray-700'}`}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all
        ${isError
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-green-50 border-green-200 text-green-700'}`}
    >
      {isError ? (
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {toast.message}
    </div>
  )
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Supprimer', danger = true }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100' : 'bg-yellow-100'}`}>
            <svg className={`h-5 w-5 ${danger ? 'text-red-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, error, required, children }) {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UsersList() {
  const currentUser = useSelector(selectUser)
  const isAdmin = currentUser?.role === 'ADMIN'

  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = create mode
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})

  const [confirmDelete, setConfirmDelete] = useState(null) // user to delete
  const [toast, setToast] = useState(null)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, deptsData, managersData] = await Promise.all([
        getUsers(),
        getDepartments(),
        getManagers(),
      ])
      setUsers(Array.isArray(usersData) ? usersData : usersData.results ?? [])
      setDepartments(Array.isArray(deptsData) ? deptsData : deptsData.results ?? [])
      setManagers(Array.isArray(managersData) ? managersData : managersData.results ?? [])
    } catch {
      setError('Impossible de charger les données. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  })

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'EMPLOYEE',
      department: user.department?.id?.toString() || user.department?.toString() || '',
      manager: user.manager?.id?.toString() || user.manager?.toString() || '',
      password: '',
      password_confirm: '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  // ── Form handling ─────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!form.first_name.trim()) errors.first_name = 'Prénom requis'
    if (!form.last_name.trim()) errors.last_name = 'Nom requis'
    if (!form.username.trim()) errors.username = "Nom d'utilisateur requis"
    if (!form.email.trim()) errors.email = 'Email requis'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email invalide'
    if (!editingUser) {
      if (!form.password) errors.password = 'Mot de passe requis'
      else if (form.password.length < 8) errors.password = 'Minimum 8 caractères'
      if (!form.password_confirm) errors.password_confirm = 'Confirmation requise'
      else if (form.password !== form.password_confirm) errors.password_confirm = 'Les mots de passe ne correspondent pas'
    } else if (form.password) {
      if (form.password.length < 8) errors.password = 'Minimum 8 caractères'
      if (!form.password_confirm) errors.password_confirm = 'Confirmation requise'
      else if (form.password !== form.password_confirm) errors.password_confirm = 'Les mots de passe ne correspondent pas'
    }
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.department || null,
        manager: form.manager || null,
      }
      if (!editingUser || form.password) {
        payload.password = form.password
      }

      if (editingUser) {
        const updated = await updateUser(editingUser.id, payload)
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)))
        showToast('Utilisateur mis à jour avec succès.')
      } else {
        const created = await createUser(payload)
        setUsers((prev) => [...prev, created])
        showToast('Utilisateur créé avec succès.')
      }
      closeModal()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const fieldErrors = {}
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val
        })
        setFormErrors(fieldErrors)
      } else {
        showToast("Une erreur est survenue lors de l'enregistrement.", 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete handling ───────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      await deleteUser(confirmDelete.id)
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id))
      showToast('Utilisateur supprimé.')
    } catch {
      showToast('Impossible de supprimer cet utilisateur.', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} utilisateur{users.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={openCreate} className="btn-primary">
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvel utilisateur
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, username..."
          className="form-input pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner message="Chargement des utilisateurs..." />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">
              {search ? `Aucun résultat pour "${search}"` : 'Aucun utilisateur trouvé'}
            </p>
            {isAdmin && !search && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Créer le premier utilisateur →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="table-header">Nom complet</th>
                  <th className="table-header">Username</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Rôle</th>
                  <th className="table-header">Département</th>
                  <th className="table-header">Manager</th>
                  {isAdmin && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filtered.map((user) => {
                  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
                  const initials = (
                    (user.first_name?.[0] || '') + (user.last_name?.[0] || '')
                  ).toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
                  const deptName = user.department?.name || user.department_name || '—'
                  const managerName = user.manager
                    ? [user.manager.first_name, user.manager.last_name].filter(Boolean).join(' ') || user.manager.username
                    : '—'

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {initials}
                          </div>
                          <span className="font-medium text-gray-800">{fullName}</span>
                          {user.id === currentUser?.id && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">moi</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell font-mono text-xs text-gray-500">{user.username}</td>
                      <td className="table-cell text-gray-500">{user.email || '—'}</td>
                      <td className="table-cell">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="table-cell text-gray-500">{deptName}</td>
                      <td className="table-cell text-gray-500">{managerName}</td>
                      {isAdmin && (
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              title="Modifier"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(user)}
                              title="Supprimer"
                              disabled={user.id === currentUser?.id}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer l'utilisateur"
        message={
          confirmDelete
            ? `Êtes-vous sûr de vouloir supprimer "${[confirmDelete.first_name, confirmDelete.last_name].filter(Boolean).join(' ') || confirmDelete.username}" ? Cette action est irréversible.`
            : ''
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Supprimer"
        danger
      />

      {/* Create / Edit drawer / modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          {/* Panel slides in from right */}
          <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom" required error={formErrors.first_name}>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    className={`form-input ${formErrors.first_name ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                    placeholder="Jean"
                  />
                </FormField>
                <FormField label="Nom" required error={formErrors.last_name}>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    className={`form-input ${formErrors.last_name ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                    placeholder="Dupont"
                  />
                </FormField>
              </div>

              <FormField label="Nom d'utilisateur" required error={formErrors.username}>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  className={`form-input ${formErrors.username ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="jean.dupont"
                />
              </FormField>

              <FormField label="Email" required error={formErrors.email}>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`form-input ${formErrors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="jean.dupont@entreprise.com"
                />
              </FormField>

              <FormField label="Rôle" required error={formErrors.role}>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="form-input appearance-none"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Département" error={formErrors.department}>
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className="form-input appearance-none"
                >
                  <option value="">— Aucun département —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Manager" error={formErrors.manager}>
                <select
                  name="manager"
                  value={form.manager}
                  onChange={handleChange}
                  className="form-input appearance-none"
                >
                  <option value="">— Aucun manager —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* Password section */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                </p>
                <div className="space-y-4">
                  <FormField
                    label="Mot de passe"
                    required={!editingUser}
                    error={formErrors.password}
                  >
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className={`form-input ${formErrors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                      placeholder="Minimum 8 caractères"
                      autoComplete="new-password"
                    />
                  </FormField>
                  <FormField
                    label="Confirmer le mot de passe"
                    required={!editingUser || !!form.password}
                    error={formErrors.password_confirm}
                  >
                    <input
                      type="password"
                      name="password_confirm"
                      value={form.password_confirm}
                      onChange={handleChange}
                      className={`form-input ${formErrors.password_confirm ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                      placeholder="Répétez le mot de passe"
                      autoComplete="new-password"
                    />
                  </FormField>
                </div>
              </div>

              {formErrors.non_field_errors && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {formErrors.non_field_errors}
                </div>
              )}
            </form>

            {/* Panel footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={submitting}>
                Annuler
              </button>
              <button
                type="submit"
                form="user-form"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-1.5 border-2 border-white border-t-transparent rounded-full" viewBox="0 0 24 24" />
                    Enregistrement...
                  </>
                ) : editingUser ? (
                  'Mettre à jour'
                ) : (
                  'Créer l\'utilisateur'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
