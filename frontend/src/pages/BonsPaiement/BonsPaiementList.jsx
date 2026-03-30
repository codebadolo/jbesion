import React, { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchBonsPaiement,
  selectBonsPaiement,
  selectBonsPaiementPagination,
  selectBonsPaiementLoading,
} from '../../store/bonsPaiementSlice.js'
import { selectUser } from '../../store/authSlice.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import { formatDate } from '../../utils/helpers.js'

const MODE_LABELS = {
  ESPECE:       'Espèce',
  VIREMENT:     'Virement bancaire',
  CHEQUE:       'Chèque',
  MOBILE_MONEY: 'Mobile Money',
  CARTE:        'Carte bancaire',
  AUTRE:        'Autre',
}

const STATUS_LABELS = {
  DRAFT:     'Brouillon',
  VALIDATED: 'Validé',
  CANCELLED: 'Annulé',
}

const STATUS_COLORS = {
  DRAFT:     'gray',
  VALIDATED: 'green',
  CANCELLED: 'red',
}

function isComptable(user) {
  return user?.role === 'DAF' || user?.role === 'ADMIN'
}

function StatsCards({ bons, total }) {
  const draft     = bons.filter((b) => b.status === 'DRAFT').length
  const validated = bons.filter((b) => b.status === 'VALIDATED').length
  const cancelled = bons.filter((b) => b.status === 'CANCELLED').length

  const cards = [
    {
      label: 'Total',
      value: total,
      sub: 'bons de paiement',
      bg: 'bg-[#162C54]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
    },
    {
      label: 'Brouillons',
      value: draft,
      sub: 'en attente de validation',
      bg: 'bg-[#1e4a7a]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
      ),
    },
    {
      label: 'Validés',
      value: validated,
      sub: 'bons approuvés',
      bg: 'bg-[#163d6e]',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Annulés',
      value: cancelled,
      sub: 'bons annulés',
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

export default function BonsPaiementList() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const bons     = useSelector(selectBonsPaiement)
  const pagination = useSelector(selectBonsPaiementPagination)
  const loading  = useSelector(selectBonsPaiementLoading)
  const user     = useSelector(selectUser)

  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modeFilter,  setModeFilter]  = useState('')
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(20)

  const load = useCallback(() => {
    const params = { page, page_size: pageSize }
    if (search)       params.search = search
    if (statusFilter) params.status = statusFilter
    if (modeFilter)   params.mode_paiement = modeFilter
    dispatch(fetchBonsPaiement(params))
  }, [dispatch, page, pageSize, search, statusFilter, modeFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil((pagination.count || 0) / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bons de Paiement</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.count ?? bons.length} bon{(pagination.count ?? bons.length) !== 1 ? 's' : ''}
          </p>
        </div>
        {isComptable(user) && (
          <Link
            to="/bons-paiement/create"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau bon
          </Link>
        )}
      </div>

      {/* Stats */}
      {!loading && bons.length > 0 && (
        <StatsCards bons={bons} total={pagination.count ?? bons.length} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher (bénéficiaire, motif, numéro)…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="form-input w-72"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="form-input w-44"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={modeFilter}
          onChange={(e) => { setModeFilter(e.target.value); setPage(1) }}
          className="form-input w-52"
        >
          <option value="">Tous les modes</option>
          {Object.entries(MODE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-gray-500 font-medium">Aucun bon de paiement</p>
            {isComptable(user) && (
              <Link to="/bons-paiement/create" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Créer le premier bon
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['N° Bon', 'Date', 'Bénéficiaire', 'Motif', 'Mode', 'Montant', 'Statut', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bons.map((bon) => (
                  <tr
                    key={bon.id}
                    onClick={() => navigate(`/bons-paiement/${bon.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-gray-800">{bon.numero}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(bon.date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[160px] truncate">
                      {bon.beneficiaire}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                      {bon.motif}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {MODE_LABELS[bon.mode_paiement] ?? bon.mode_paiement}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {Number(bon.montant).toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        status={bon.status}
                        label={STATUS_LABELS[bon.status] ?? bon.status}
                        color={STATUS_COLORS[bon.status] ?? 'gray'}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <svg className="h-4 w-4 text-gray-400 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                  </tr>
                ))}
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
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Préc.
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Suiv.
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
