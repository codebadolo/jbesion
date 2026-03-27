import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchBonsCommande,
  selectBonsCommande,
  selectBonsCommandePagination,
  selectBonsCommandeLoading,
} from '../../store/bonsCommandeSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate } from '../../utils/helpers.js'

const STATUS_CONFIG = {
  DRAFT:            { label: 'Brouillon',             color: 'bg-gray-100 text-gray-700' },
  PENDING_PROFORMA: { label: 'En attente proformas',  color: 'bg-amber-100 text-amber-800' },
  PENDING_DAF:      { label: 'En attente DAF',        color: 'bg-yellow-100 text-yellow-800' },
  PENDING_DG:       { label: 'En attente DG',         color: 'bg-orange-100 text-orange-800' },
  APPROVED:         { label: 'Approuvé',              color: 'bg-green-100 text-green-800' },
  REJECTED:         { label: 'Rejeté',                color: 'bg-red-100 text-red-800' },
  IN_EXECUTION:     { label: 'En exécution',          color: 'bg-blue-100 text-blue-800' },
  DONE:             { label: 'Clôturé',               color: 'bg-teal-100 text-teal-800' },
}

function canWrite(user) {
  return ['DAF', 'ADMIN'].includes(user?.role) || user?.is_staff
    || (user?.department?.code === 'AF')
}

export default function BonsCommandeList() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const bons       = useSelector(selectBonsCommande)
  const pagination = useSelector(selectBonsCommandePagination)
  const loading    = useSelector(selectBonsCommandeLoading)
  const user       = useSelector(selectUser)

  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(20)

  const load = useCallback(() => {
    const params = { page, page_size: pageSize }
    if (search)       params.search = search
    if (statusFilter) params.status = statusFilter
    dispatch(fetchBonsCommande(params))
  }, [dispatch, page, pageSize, search, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil((pagination.count || 0) / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de Commande</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.count ?? bons.length} bon{(pagination.count ?? bons.length) !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite(user) && (
          <Link to="/bons-commande/create" className="btn-primary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau bon de commande
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher (numéro, objet, référence)…"
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
        ) : bons.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <p className="text-gray-500 font-medium">Aucun bon de commande</p>
            {canWrite(user) && (
              <Link to="/bons-commande/create" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Créer le premier bon
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Numéro', 'Date', 'Objet', 'Référence', 'Proformas', 'Statut', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bons.map((bon) => {
                  const cfg = STATUS_CONFIG[bon.status] ?? STATUS_CONFIG.DRAFT
                  return (
                    <tr
                      key={bon.id}
                      onClick={() => navigate(`/bons-commande/${bon.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-gray-800">{bon.numero}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(bon.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 max-w-[220px] truncate">
                        {bon.objet}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">
                        {bon.reference || <span className="italic text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                          </svg>
                          {bon.nb_proformas ?? 0}
                        </span>
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
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="form-input py-1 w-20"
            >
              {[10, 20, 50].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>par page — {pagination.count} résultats</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50">
              Préc.
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50">
              Suiv.
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
