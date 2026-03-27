import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  fetchAbsences, createAbsence, validerAbsence, annulerAbsence,
  selectAbsences, selectAbsencesPagination, selectMissionsLoading,
} from '../../store/missionsSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'

const MOTIF_LABELS = {
  MISSION:   'Déplacement mission',
  FORMATION: 'Formation / Cours',
  ACTIVITE:  'Activité extérieure',
  AUTRE:     'Autre',
}

const STATUS_CONFIG = {
  DECLARED:  { label: 'Déclarée',  color: 'bg-yellow-100 text-yellow-800' },
  VALIDATED: { label: 'Validée',   color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annulée',   color: 'bg-gray-100 text-gray-500' },
}

const today = new Date().toISOString().split('T')[0]

export default function AbsencesList() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const absences   = useSelector(selectAbsences)
  const pagination = useSelector(selectAbsencesPagination)
  const loading    = useSelector(selectMissionsLoading)
  const user       = useSelector(selectUser)

  const [showForm,     setShowForm]     = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [actionError,  setActionError]  = useState(null)
  const [form, setForm] = useState({
    agent: user?.id || '',
    date_debut: today,
    date_fin:   today,
    motif:      'MISSION',
    description: '',
  })

  const isManager = ['MANAGER','DAF','DIRECTOR','ADMIN'].includes(user?.role)

  const load = useCallback(() => {
    const params = {}
    if (statusFilter) params.status = statusFilter
    dispatch(fetchAbsences(params))
  }, [dispatch, statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setActionError(null)
    try {
      await dispatch(createAbsence(form)).unwrap()
      setShowForm(false)
      setForm({ agent: user?.id || '', date_debut: today, date_fin: today, motif: 'MISSION', description: '' })
    } catch (e) { setActionError(typeof e === 'string' ? e : JSON.stringify(e)) }
  }

  const doAction = async (thunk, arg) => {
    setActionError(null)
    try { await dispatch(thunk(arg)).unwrap() }
    catch (e) { setActionError(typeof e === 'string' ? e : JSON.stringify(e)) }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/missions')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Absences — Agents de liaison</h1>
            <p className="text-sm text-gray-500 mt-0.5">{pagination.count ?? absences.length} absence(s)</p>
          </div>
        </div>
        {user?.is_agent_liaison && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Déclarer une absence
          </button>
        )}
      </div>

      {/* Formulaire déclaration */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-5 space-y-4 border-l-4 border-blue-400">
          <h2 className="text-sm font-semibold text-gray-700">Déclarer une absence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date de début <span className="text-red-500">*</span></label>
              <input type="date" value={form.date_debut}
                onChange={(e) => setForm((f) => ({ ...f, date_debut: e.target.value }))}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Date de fin <span className="text-red-500">*</span></label>
              <input type="date" value={form.date_fin}
                onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Motif</label>
              <select value={form.motif}
                onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))}
                className="form-input">
                {Object.entries(MOTIF_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Description</label>
              <input type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="form-input" placeholder="Précisions…" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Filtre */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="form-input w-44">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : absences.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 font-medium">Aucune absence déclarée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Agent', 'Période', 'Motif', 'Description', 'Statut', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {absences.map((abs) => {
                  const cfg = STATUS_CONFIG[abs.status] ?? STATUS_CONFIG.DECLARED
                  return (
                    <tr key={abs.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {getFullName(abs.agent_detail) || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(abs.date_debut)} → {formatDate(abs.date_fin)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {MOTIF_LABELS[abs.motif] ?? abs.motif}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                        {abs.description || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isManager && abs.status === 'DECLARED' && (
                            <button onClick={() => doAction(validerAbsence, abs.id)}
                              className="text-xs text-green-600 hover:text-green-800 border border-green-300 px-2 py-1 rounded-lg hover:bg-green-50">
                              Valider
                            </button>
                          )}
                          {abs.status !== 'CANCELLED' && (
                            abs.agent_detail?.id === user?.id || isManager
                          ) && (
                            <button onClick={() => doAction(annulerAbsence, abs.id)}
                              className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
