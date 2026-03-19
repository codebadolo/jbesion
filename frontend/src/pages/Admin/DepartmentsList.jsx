import React, { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectUser } from '../../store/authSlice.js'
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../../api/adminAPI.js'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function ConfirmDialog({ open, title, message, warning, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
            {warning && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2">
                <svg className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-xs text-yellow-700">{warning}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="btn-danger">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, error, required, hint, children }) {
  return (
    <div>
      <label className="form-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DepartmentsList() {
  const currentUser = useSelector(selectUser)
  const isAdmin = currentUser?.role === 'ADMIN'

  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDepartments()
      setDepartments(Array.isArray(data) ? data : data.results ?? [])
    } catch {
      setError('Impossible de charger les départements. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingDept(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (dept) => {
    setEditingDept(dept)
    setForm({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
    })
    setFormErrors({})
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingDept(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  // ── Form handling ─────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target
    // Auto-uppercase the code field
    const processed = name === 'code' ? value.toUpperCase().slice(0, 10) : value
    setForm((prev) => ({ ...prev, [name]: processed }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Nom requis'
    if (!form.code.trim()) errors.code = 'Code requis'
    else if (form.code.length > 10) errors.code = 'Maximum 10 caractères'
    else if (!/^[A-Z0-9_-]+$/.test(form.code)) errors.code = 'Lettres majuscules, chiffres et tirets uniquement'
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
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
      }

      if (editingDept) {
        const updated = await updateDepartment(editingDept.id, payload)
        setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? updated : d)))
        showToast('Département mis à jour avec succès.')
      } else {
        const created = await createDepartment(payload)
        setDepartments((prev) => [...prev, created])
        showToast('Département créé avec succès.')
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
      await deleteDepartment(confirmDelete.id)
      setDepartments((prev) => prev.filter((d) => d.id !== confirmDelete.id))
      showToast('Département supprimé.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Impossible de supprimer ce département.'
      showToast(msg, 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const getMemberCount = (dept) =>
    dept.members_count ?? dept.member_count ?? dept.users_count ?? dept.users?.length ?? '—'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des départements</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {departments.length} département{departments.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={openCreate} className="btn-primary">
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau département
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
          <LoadingSpinner message="Chargement des départements..." />
        ) : departments.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Aucun département trouvé</p>
            {isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Créer le premier département →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="table-header">Nom</th>
                  <th className="table-header">Code</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Membres</th>
                  {isAdmin && <th className="table-header">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {departments.map((dept) => {
                  const memberCount = getMemberCount(dept)
                  const hasMembers = typeof memberCount === 'number' && memberCount > 0

                  return (
                    <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                            </svg>
                          </div>
                          <span className="font-medium text-gray-800">{dept.name}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                          {dept.code}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500 max-w-xs">
                        {dept.description ? (
                          <span className="line-clamp-2">{dept.description}</span>
                        ) : (
                          <span className="text-gray-300 italic">Aucune description</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                          </svg>
                          <span className={`text-sm font-medium ${hasMembers ? 'text-gray-700' : 'text-gray-400'}`}>
                            {memberCount}
                          </span>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(dept)}
                              title="Modifier"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(dept)}
                              title="Supprimer"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
        title="Supprimer le département"
        message={
          confirmDelete
            ? `Êtes-vous sûr de vouloir supprimer le département "${confirmDelete.name}" ? Cette action est irréversible.`
            : ''
        }
        warning={
          confirmDelete && getMemberCount(confirmDelete) > 0
            ? `Attention : ce département contient ${getMemberCount(confirmDelete)} membre(s). La suppression peut affecter ces utilisateurs.`
            : undefined
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md mx-4">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {editingDept ? 'Modifier le département' : 'Nouveau département'}
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

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <FormField label="Nom du département" required error={formErrors.name}>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`form-input ${formErrors.name ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="Ex : Ressources Humaines"
                  autoFocus
                />
              </FormField>

              <FormField
                label="Code"
                required
                error={formErrors.code}
                hint="Majuscules, chiffres et tirets uniquement (max 10 car.)"
              >
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  maxLength={10}
                  className={`form-input font-mono uppercase ${formErrors.code ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="EX : RH"
                />
              </FormField>

              <FormField label="Description" error={formErrors.description}>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className={`form-input resize-none ${formErrors.description ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="Description optionnelle du département..."
                />
              </FormField>

              {formErrors.non_field_errors && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {formErrors.non_field_errors}
                </div>
              )}

              {/* Modal footer inside form */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary" disabled={submitting}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-1.5 border-2 border-white border-t-transparent rounded-full" viewBox="0 0 24 24" />
                      Enregistrement...
                    </>
                  ) : editingDept ? (
                    'Mettre à jour'
                  ) : (
                    'Créer le département'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
