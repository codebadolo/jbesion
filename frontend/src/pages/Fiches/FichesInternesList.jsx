import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import { selectUser } from '../../store/authSlice.js'
import {
  fetchFiches,
  selectFichesError,
  selectFichesInternes,
  selectFichesInternesCount,
  selectFichesLoading,
} from '../../store/fichesSlice.js'
import { STATUS_LABELS } from '../../utils/constants.js'
import { formatDate } from '../../utils/helpers.js'

const C_DEEP = '#162C54'  // Bleu foncé principal
const C_BLUE = '#3475BB'
const C_LIGHT = '#37B6E9'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
  { value: 'PENDING_MANAGER', label: STATUS_LABELS.PENDING_MANAGER },
  { value: 'PENDING_DAF', label: STATUS_LABELS.PENDING_DAF },
  { value: 'PENDING_DIRECTOR', label: STATUS_LABELS.PENDING_DIRECTOR },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
  { value: 'IN_EXECUTION', label: STATUS_LABELS.IN_EXECUTION || 'En cours d\'exécution' },
  { value: 'DELIVERED', label: STATUS_LABELS.DELIVERED || 'Livrée / Réceptionnée' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ── StatCard Component ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }) {
  const cardColor = C_DEEP
  
  return (
    <div 
      className="card p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-md"
      style={{ 
        borderLeft: `4px solid ${cardColor}`,
        backgroundColor: '#162C54'
      }}
    >
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${cardColor}15`, color: cardColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold" style={{ color: '#1F2937' }}>
          {value ?? '—'}
        </p>
        <p className="text-sm font-medium mt-0.5" style={{ color: '#4B5563' }}>
          {label}
        </p>
        {sub != null && (
          <p className="text-xs mt-1" style={{ color: cardColor, fontWeight: 500 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function SortIcon({ dir }) {
  if (!dir) return (
    <svg className="inline h-3 w-3 ml-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  )
  return dir === 'asc' ? (
    <svg className="inline h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: C_BLUE }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  ) : (
    <svg className="inline h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: C_BLUE }}>
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
              style={p === page ? { backgroundColor: C_DEEP, color: '#fff', borderColor: C_DEEP } : { borderColor: '#e5e7eb' }}
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

// ── Icons ──────────────────────────────────────────────────────────────────
const iconDoc = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
)

const iconClock = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const iconCheck = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const iconX = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const iconTrend = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)

export default function FichesInternesList() {
  const dispatch = useDispatch()

  const fiches = useSelector(selectFichesInternes)
  const total = useSelector(selectFichesInternesCount)
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

  // Calcul des statistiques à partir des fiches
  const stats = useMemo(() => {
    const counts = {
      total: total,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      inExecution: 0,
      delivered: 0
    }
    
    fiches.forEach(fiche => {
      switch (fiche.status) {
        case 'DRAFT':
          counts.draft++
          break
        case 'PENDING_MANAGER':
        case 'PENDING_DAF':
        case 'PENDING_DIRECTOR':
          counts.pending++
          break
        case 'APPROVED':
          counts.approved++
          break
        case 'REJECTED':
          counts.rejected++
          break
        case 'IN_EXECUTION':
          counts.inExecution++
          break
        case 'DELIVERED':
          counts.delivered++
          break
        default:
          break
      }
    })
    
    return counts
  }, [fiches, total])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const params = { page, page_size: pageSize }
    if (statusFilter) params.status = statusFilter
    if (search) params.search = search
    dispatch(fetchFiches({ type: 'interne', params }))
  }, [dispatch, statusFilter, search, page, pageSize])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [statusFilter, pageSize])

  // Client-side sort (within the current page)
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

  const cols = [
    { key: 'id',              label: 'N°',         w: 'w-16' },
    { key: 'created_by_name', label: 'Créé par',   w: '' },
    { key: 'department_detail', label: 'Département', w: '' },
    { key: 'created_at',      label: 'Date',        w: 'w-28' },
    { key: 'status',          label: 'Statut',      w: 'w-44' },
    { key: 'item_count',      label: 'Articles',    w: 'w-20' },
  ]

  const hasFilters = statusFilter || search
  const isEmpty = !isLoading && sorted.length === 0

  // Cartes de statistiques
  const statCards = [
    { label: 'Total fiches', value: stats.total, icon: iconDoc },
    { label: 'Brouillons', value: stats.draft, icon: iconDoc },
    { label: 'En attente', value: stats.pending, icon: iconClock },
    { label: 'Approuvées', value: stats.approved, icon: iconCheck },
    { label: 'Rejetées', value: stats.rejected, icon: iconX },
    { label: 'En exécution', value: stats.inExecution, icon: iconTrend },
    { label: 'Livrées', value: stats.delivered, icon: iconCheck },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fiches de Besoins Internes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Besoins matériels ou services internes à l'organisation
          </p>
        </div>
        <Link to="/fiches-internes/create" className="btn-primary">
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle fiche
        </Link>
      </div>

      {/* ── Statistiques Cards ───────────────────────────────────────────── */}
      {!isLoading && stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Toolbar */}
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
          <LoadingSpinner message="Chargement des fiches internes..." />
        ) : isEmpty ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">
              {hasFilters ? 'Aucun résultat pour ces filtres' : 'Aucune fiche interne trouvée'}
            </p>
            {!hasFilters && (
              <Link to="/fiches-internes/create" className="mt-3 inline-block text-sm font-medium" style={{ color: C_LIGHT }}>
                Créer une fiche interne →
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
                          <Link to={`/fiches-internes/${fiche.id}`}
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