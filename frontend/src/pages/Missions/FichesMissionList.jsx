import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchFichesMission,
  selectFichesMission,
  selectFichesMissionPagination,
  selectMissionsLoading,
} from '../../store/missionsSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate } from '../../utils/helpers.js'

const STATUS_CONFIG = {
  DRAFT:           { label: 'Brouillon',       color: 'bg-gray-100 text-gray-700' },
  PENDING_MANAGER: { label: 'En attente Manager', color: 'bg-yellow-100 text-yellow-800' },
  PENDING_DAF:     { label: 'En attente DAF',  color: 'bg-orange-100 text-orange-800' },
  PENDING_DG:      { label: 'En attente DG',   color: 'bg-purple-100 text-purple-800' },
  APPROVED:        { label: 'Approuvée',        color: 'bg-green-100 text-green-800' },
  REJECTED:        { label: 'Rejetée',          color: 'bg-red-100 text-red-800' },
  IN_PROGRESS:     { label: 'En cours',         color: 'bg-blue-100 text-blue-800' },
  DONE:            { label: 'Terminée',         color: 'bg-teal-100 text-teal-800' },
}

function StatsCards({ missions, total }) {
  const pending  = missions.filter((m) => ['PENDING_MANAGER', 'PENDING_DAF', 'PENDING_DG'].includes(m.status)).length
  const approved = missions.filter((m) => m.status === 'APPROVED').length
  const inProgress = missions.filter((m) => m.status === 'IN_PROGRESS').length
  const rejected = missions.filter((m) => m.status === 'REJECTED').length

  const cards = [
    {
      label: 'Total',
      value: total,
      sub: 'fiches de mission',
      bg: 'bg-[#162C54]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      ),
    },
    {
      label: 'En attente',
      value: pending,
      sub: 'en validation',
      bg: 'bg-[#1e4a7a]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Approuvées',
      value: approved,
      sub: `dont ${inProgress} en cours`,
      bg: 'bg-[#163d6e]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Rejetées',
      value: rejected,
      sub: 'fiches refusées',
      bg: 'bg-[#0f2d52]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-xl px-5 py-4 text-white shadow`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-blue-200 uppercase tracking-wide">{c.label}</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              {c.icon}
            </div>
          </div>
          <p className="text-3xl font-bold">{c.value}</p>
          <p className="mt-1 text-xs text-blue-200">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

export default function FichesMissionList() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const missions   = useSelector(selectFichesMission)
  const pagination = useSelector(selectFichesMissionPagination)
  const loading    = useSelector(selectMissionsLoading)
  const user       = useSelector(selectUser)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page,         setPage]         = useState(1)
  const [pageSize,     setPageSize]     = useState(20)

  const load = useCallback(() => {
    const params = { page, page_size: pageSize }
    if (search)       params.search = search
    if (statusFilter) params.status = statusFilter
    dispatch(fetchFichesMission(params))
  }, [dispatch, page, pageSize, search, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil((pagination.count || 0) / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiches de Mission</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.count ?? missions.length} fiche{(pagination.count ?? missions.length) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/missions/absences" className="btn-secondary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            Absences agents
          </Link>
          <Link to="/missions/create" className="btn-primary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle fiche
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && missions.length > 0 && (
        <StatsCards missions={missions} total={pagination.count ?? missions.length} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher (nom, destination, objet)…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="form-input w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="form-input w-48"
        >
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
        ) : missions.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <p className="text-gray-500 font-medium">Aucune fiche de mission</p>
            <Link to="/missions/create" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              Créer la première fiche
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['N°', 'Date', 'Bénéficiaire', 'Matricule', 'Destination', 'Période', 'Total frais', 'Statut', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missions.map((m) => {
                  const cfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.DRAFT
                  return (
                    <tr key={m.id}
                      onClick={() => navigate(`/missions/${m.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-gray-700">{m.numero}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(m.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[160px] truncate">
                        {m.nom_prenom}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-gray-500">{m.matricule_display || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate">
                        {m.destination}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(m.date_debut)} → {formatDate(m.date_fin)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {Number(m.total_frais ?? 0).toLocaleString('fr-FR')} F
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <svg className="h-4 w-4 text-gray-400 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Afficher</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="form-input py-1 w-20">
              {[10, 20, 50].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>par page — {pagination.count} résultats</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50">Préc.</button>
            <span className="px-3 py-1.5 text-sm text-gray-700">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
          </div>
        </div>
      )}
    </div>
  )
}
