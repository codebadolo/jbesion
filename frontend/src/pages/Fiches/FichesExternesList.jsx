import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchFiches,
  selectFichesExternes,
  selectFichesExternesCount,
  selectFichesLoading,
  selectFichesError,
} from '../../store/fichesSlice.js'
import { selectUser } from '../../store/authSlice.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import { formatDate } from '../../utils/helpers.js'
import { STATUS_LABELS } from '../../utils/constants.js'

const C_BLUE = '#3475BB'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
  { value: 'PENDING_MANAGER', label: STATUS_LABELS.PENDING_MANAGER },
  { value: 'PENDING_DIRECTOR', label: STATUS_LABELS.PENDING_DIRECTOR },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
  { value: 'IN_EXECUTION', label: STATUS_LABELS.IN_EXECUTION || 'En cours d\'exécution' },
  { value: 'DELIVERED', label: STATUS_LABELS.DELIVERED || 'Livrée / Réceptionnée' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function SortIcon({ dir }) {
  if (!dir) return (
    <svg className="inline h-3 w-3 ml-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  )
  return dir === 'asc' ? (
    <svg className="inline h-3 w-3 ml-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  ) : (
    <svg className="inline h-3 w-3 ml-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }) {
  const pages = useMemo(() => {
    const arr = []
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) arr.push(p)
      else if (arr[arr.length - 1] !== '…') arr.push('…')
    }
    return arr
  }, [page, totalPages])

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span>Lignes par page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs focus:outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="text-gray-400">
          {total === 0 ? '0 résultat' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(1)} disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">«</button>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`el-${i}`} className="px-1">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p)}
              className="px-2.5 py-1 rounded border transition-colors"
              style={p === page ? { backgroundColor: '#162C54', color: '#fff', borderColor: '#162C54' } : { borderColor: '#e5e7eb' }}
            >{p}</button>
          )
        )}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
        <button type="button" onClick={() => onPage(totalPages)} disabled={page === totalPages}
          className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">»</button>
      </div>
    </div>
  )
}

export default function FichesExternesList() {
  const dispatch = useDispatch()

  const fiches = useSelector(selectFichesExternes)
  const total = useSelector(selectFichesExternesCount)
  const isLoading = useSelector(selectFichesLoading)
  const error = useSelector(selectFichesError)
  const user = useSelector(selectUser)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const params = { page, page_size: pageSize }
    if (statusFilter) params.status = statusFilter
    if (search) params.search = search
    dispatch(fetchFiches({ type: 'externe', params }))
  }, [dispatch, statusFilter, search, page, pageSize])

  useEffect(() => { setPage(1) }, [statusFilter, pageSize])

  const sorted = useMemo(() => {
    return [...fiches].sort((a, b) => {
      let av = a[sortKey] ?? ''
      let bv = b[sortKey] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [fiches, sortKey, sortDir])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = statusFilter || search
  const isEmpty = !isLoading && sorted.length === 0

  const cols = [
    { key: 'id',              label: 'N°',          w: 'w-16' },
    { key: 'created_by_name', label: 'Créé par',    w: '' },
    { key: 'department_detail', label: 'Département', w: '' },
    { key: 'created_at',      label: 'Date',         w: 'w-28' },
    { key: 'status',          label: 'Statut',       w: 'w-44' },
    { key: 'item_count',      label: 'Articles',     w: 'w-20' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fiches de Besoins Externes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prestations ou services fournis par des prestataires externes
          </p>
        </div>
        <Link to="/fiches-externes/create" className="btn-primary">
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle fiche
        </Link>
      </div>

      {/* Toolbar + Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par nom, département…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-7 py-1.5 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>

          {hasFilters && (
            <button type="button"
              onClick={() => { setStatusFilter(''); setSearchInput(''); setSearch(''); setPage(1) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">{total} fiche{total !== 1 ? 's' : ''}</span>
        </div>

        {error && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-200 text-sm text-red-600">
            {typeof error === 'string' ? error : 'Erreur lors du chargement.'}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner message="Chargement des fiches externes..." />
        ) : isEmpty ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <p className="text-sm font-medium text-gray-500">
              {hasFilters ? 'Aucun résultat pour ces filtres' : 'Aucune fiche externe trouvée'}
            </p>
            {!hasFilters && (
              <Link to="/fiches-externes/create" className="mt-3 inline-block text-sm font-medium" style={{ color: '#37B6E9' }}>
                Créer une fiche externe →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-50">
                    {cols.map((col) => (
                      <th key={col.key}
                        className={`table-header cursor-pointer select-none hover:bg-gray-100 transition-colors ${col.w}`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <SortIcon dir={sortKey === col.key ? sortDir : null} />
                      </th>
                    ))}
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {sorted.map((fiche) => {
                    const isOwner = fiche.created_by === user?.id
                    return (
                      <tr key={fiche.id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell">
                          <span className="font-mono text-xs text-gray-500">#{fiche.id}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{ backgroundColor: 'rgba(55,182,233,0.15)', color: C_BLUE }}>
                              {(fiche.created_by_name || '').split(' ').map((w) => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'}
                            </div>
                            <span className="font-medium text-gray-800">{fiche.created_by_name || '—'}</span>
                            {isOwner && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">moi</span>
                            )}
                          </div>
                        </td>
                        <td className="table-cell text-gray-500">{fiche.department_detail?.name || '—'}</td>
                        <td className="table-cell text-gray-500">{formatDate(fiche.created_at)}</td>
                        <td className="table-cell"><StatusBadge status={fiche.status} size="sm" /></td>
                        <td className="table-cell text-gray-500">{fiche.item_count ?? '—'}</td>
                        <td className="table-cell">
                          <Link to={`/fiches-externes/${fiche.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium transition-colors" style={{ color: C_BLUE }}>
                            Détails
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(n) => { setPageSize(n); setPage(1) }}
            />
          </>
        )}
      </div>
    </div>
  )
}
