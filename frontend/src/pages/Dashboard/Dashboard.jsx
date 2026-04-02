import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getDashboardData } from '../../api/dashboardAPI.js'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import { selectUser } from '../../store/authSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'

// ── Palette ────────────────────────────────────────────────────────────────
const C_DEEP  = '#162C54'  // Bleu foncé principal
const C_MID   = '#3475BB'
const C_LIGHT = '#37B6E9'
const C_NIGHT = '#1A4278'

// ── Helpers ────────────────────────────────────────────────────────────────
function monthLabel(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const names = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${names[parseInt(m, 10) - 1]} ${String(y).slice(2)}`
}

const CARD_BG_COLORS = ['bg-[#1e3a5f]', 'bg-[#1e4a7a]', 'bg-[#163d6e]', 'bg-[#0f2d52]']

// ── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, bgColor }) {
  return (
    <div className={`${bgColor || CARD_BG_COLORS[0]} rounded-xl px-5 py-4 text-white shadow transition-all duration-200 hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-blue-200">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold">{value ?? '—'}</p>
      {sub != null && (
        <p className="mt-1 text-xs text-blue-300">{sub}</p>
      )}
    </div>
  )
}

function Toggle({ value, onChange }) {
  const options = [
    { key: 'tous',     label: 'Tous' },
    { key: 'interne',  label: 'Internes' },
    { key: 'externe',  label: 'Externes' },
  ]
  return (
    <div
      className="inline-flex rounded-lg p-0.5 gap-0.5"
      style={{ backgroundColor: '#EEF2F8' }}
    >
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className="px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150"
          style={
            value === opt.key
              ? { backgroundColor: C_DEEP, color: '#fff', boxShadow: '0 1px 4px rgba(22,44,84,0.25)' }
              : { color: '#6b7280' }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name} : <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ── DataTable ───────────────────────────────────────────────────────────────
function SortIcon({ dir }) {
  if (!dir) return (
    <svg className="inline h-3 w-3 ml-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  )
  return dir === 'asc' ? (
    <svg className="inline h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: C_MID }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  ) : (
    <svg className="inline h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: C_MID }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function RecentFichesTable({ rows, view, navigate }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows
      .filter((f) => view === 'tous' || f.type === view)
      .filter((f) =>
        !q ||
        String(f.numero || f.id).includes(q) ||
        (f.created_by_name || '').toLowerCase().includes(q) ||
        (f.status || '').toLowerCase().includes(q) ||
        (f.type || '').toLowerCase().includes(q)
      )
  }, [rows, view, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey] ?? ''
      let bv = b[sortKey] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  // reset page on filter/view change
  useEffect(() => { setPage(1) }, [search, view, pageSize])

  const cols = [
    { key: 'id',              label: 'N°' },
    { key: 'type',            label: 'Type' },
    { key: 'created_by_name', label: 'Créé par' },
    { key: 'created_at',      label: 'Date' },
    { key: 'status',          label: 'Statut' },
  ]

  if (rows.length === 0) return (
    <div className="py-12 text-center">
      <svg className="mx-auto h-10 w-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
      <p className="text-sm text-gray-400">Aucune fiche pour le moment</p>
      <button type="button" onClick={() => navigate('/fiches-internes/create')} className="mt-3 inline-block text-sm font-medium" style={{ color: C_LIGHT }}>
        Créer votre première fiche →
      </button>
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-50">
        <div className="relative flex-1 max-w-xs">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:border-blue-300"
            style={{ '--tw-ring-color': C_MID }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Afficher</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-xs focus:outline-none"
          >
            {[5, 10, 20, 50].map((n) => <option key={n}>{n}</option>)}
          </select>
          <span>par page</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50">
              {cols.map((col) => (
                <th
                  key={col.key}
                  className="table-header cursor-pointer select-none hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortIcon dir={sortKey === col.key ? sortDir : null} />
                </th>
              ))}
              <th className="table-header" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  Aucun résultat pour « {search} »
                </td>
              </tr>
            ) : paged.map((fiche) => (
              <tr key={`${fiche.type}-${fiche.id}`} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-mono text-xs text-gray-500">
                  #{fiche.numero || fiche.id}
                </td>
                <td className="table-cell">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: fiche.type === 'interne' ? 'rgba(22,44,84,0.08)' : 'rgba(55,182,233,0.12)',
                      color: fiche.type === 'interne' ? C_DEEP : C_MID,
                    }}
                  >
                    {fiche.type === 'interne' ? 'Interne' : 'Externe'}
                  </span>
                </td>
                <td className="table-cell">{fiche.created_by_name || '—'}</td>
                <td className="table-cell text-gray-500">{formatDate(fiche.created_at)}</td>
                <td className="table-cell">
                  <StatusBadge status={fiche.status} size="sm" />
                </td>
                <td className="table-cell">
                  <Link
                    to={`/fiches-${fiche.type === 'interne' ? 'internes' : 'externes'}/${fiche.id}`}
                    className="text-xs font-medium transition-colors"
                    style={{ color: C_MID }}
                  >
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span>
          {sorted.length === 0 ? '0 résultat' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} sur ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >«</button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className="px-2.5 py-1 rounded border transition-colors"
                  style={p === safePage
                    ? { backgroundColor: C_DEEP, color: '#fff', borderColor: C_DEEP }
                    : { borderColor: '#e5e7eb' }
                  }
                >{p}</button>
              )
            )}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >›</button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >»</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate  = useNavigate()
  const user      = useSelector(selectUser)
  const userRole  = user?.role || user?.role_code

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [view, setView]       = useState('tous') // toggle state

  useEffect(() => {
    setLoading(true)
    getDashboardData()
      .then(setData)
      .catch(() => setError('Impossible de charger le tableau de bord.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Chargement du tableau de bord..." />

  // ── Derived data ──────────────────────────────────────────────────────────
  const ci = data?.counts_interne || {}
  const ce = data?.counts_externe || {}
  const total = data?.total_fiches || {}
  const pendingForMe = data?.pending_for_me || {}
  const recentFiches = data?.recent_fiches || []
  const monthlyStats = (data?.monthly_stats || []).map((m) => ({
    ...m,
    label: monthLabel(m.month),
  }))

  const pendingInterne = (ci.PENDING_MANAGER || 0) + (ci.PENDING_DAF || 0) + (ci.PENDING_DIRECTOR || 0)
  const pendingExterne = (ce.PENDING_MANAGER || 0) + (ce.PENDING_DIRECTOR || 0)

  const isComptable = user?.is_comptable || false
  const isRH        = user?.is_rh || false
  const isEmployee  = userRole === 'COLLABORATEUR' && !isComptable && !isRH

  // Labels personnalisés selon le rôle
  const totalLabel    = isEmployee ? 'Mes fiches'          : 'Total fiches'
  const interneLabel  = isEmployee ? 'Mes fiches internes' : 'Fiches internes'
  const externeLabel  = isEmployee ? 'Mes fiches externes' : 'Fiches externes'
  const pendingLabel  = isEmployee ? 'En attente'          : 'En attente'
  const approvedLabel = isEmployee ? 'Mes approuvées'      : 'Approuvées'
  const rejectedLabel = isEmployee ? 'Mes rejetées'        : 'Rejetées'

  const statsCards = {
    tous: [
      { label: totalLabel,    value: total.combined,  sub: `${total.internes} int. · ${total.externes} ext.`, icon: iconDoc,   bgColor: CARD_BG_COLORS[0] },
      { label: pendingLabel,  value: pendingInterne + pendingExterne, icon: iconClock,  bgColor: CARD_BG_COLORS[1] },
      { label: approvedLabel, value: (ci.APPROVED || 0) + (ce.APPROVED || 0), icon: iconCheck, bgColor: CARD_BG_COLORS[2] },
      { label: rejectedLabel, value: (ci.REJECTED || 0) + (ce.REJECTED || 0), icon: iconX,     bgColor: CARD_BG_COLORS[3] },
    ],
    interne: [
      { label: interneLabel,  value: total.internes,  icon: iconDoc,   bgColor: CARD_BG_COLORS[0] },
      { label: pendingLabel,  value: pendingInterne,  icon: iconClock, bgColor: CARD_BG_COLORS[1] },
      { label: approvedLabel, value: ci.APPROVED || 0, icon: iconCheck, bgColor: CARD_BG_COLORS[2] },
      { label: rejectedLabel, value: ci.REJECTED || 0, icon: iconX,     bgColor: CARD_BG_COLORS[3] },
    ],
    externe: [
      { label: externeLabel,  value: total.externes,  icon: iconGlobe,  bgColor: CARD_BG_COLORS[0] },
      { label: pendingLabel,  value: pendingExterne,  icon: iconClock,  bgColor: CARD_BG_COLORS[1] },
      { label: approvedLabel, value: ce.APPROVED || 0, icon: iconCheck, bgColor: CARD_BG_COLORS[2] },
      { label: rejectedLabel, value: ce.REJECTED || 0, icon: iconX,     bgColor: CARD_BG_COLORS[3] },
    ],
  }

  // Bar chart: status distribution
  const statusBarData = view === 'externe'
    ? [
        { name: 'Brouillon',        value: ce.DRAFT || 0 },
        { name: 'Att. Manager',     value: ce.PENDING_MANAGER || 0 },
        { name: 'Att. Directeur',   value: ce.PENDING_DIRECTOR || 0 },
        { name: 'Approuvées',       value: ce.APPROVED || 0 },
        { name: 'Rejetées',         value: ce.REJECTED || 0 },
      ]
    : view === 'interne'
    ? [
        { name: 'Brouillon',        value: ci.DRAFT || 0 },
        { name: 'Att. Manager',     value: ci.PENDING_MANAGER || 0 },
        { name: 'Att. DAF',         value: ci.PENDING_DAF || 0 },
        { name: 'Att. Directeur',   value: ci.PENDING_DIRECTOR || 0 },
        { name: 'Approuvées',       value: ci.APPROVED || 0 },
        { name: 'Rejetées',         value: ci.REJECTED || 0 },
      ]
    : [
        { name: 'Brouillon',        int: ci.DRAFT || 0,            ext: ce.DRAFT || 0 },
        { name: 'Att. Manager',     int: ci.PENDING_MANAGER || 0,  ext: ce.PENDING_MANAGER || 0 },
        { name: 'Att. DAF',         int: ci.PENDING_DAF || 0,      ext: 0 },
        { name: 'Att. Directeur',   int: ci.PENDING_DIRECTOR || 0, ext: ce.PENDING_DIRECTOR || 0 },
        { name: 'Approuvées',       int: ci.APPROVED || 0,         ext: ce.APPROVED || 0 },
        { name: 'Rejetées',         int: ci.REJECTED || 0,         ext: ce.REJECTED || 0 },
      ]

  const BAR_COLORS = [C_MID, '#64B5F6', '#FFA726', '#FB8C00', '#43A047', '#E53935']

  const canSeePending = ['MANAGER', 'DAF', 'DIRECTOR', 'ADMIN'].includes(userRole) || isComptable || isRH
  const canSeeCharts  = !isEmployee

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Bonjour, {user?.first_name || getFullName(user)} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEmployee
              ? 'Aperçu de vos activités personnelles'
              : 'Aperçu de l\'activité — vue en temps réel'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Toggle value={view} onChange={setView} />
          <Link to="/fiches-internes/create" className="btn-primary">
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouvelle fiche
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-700">
          {error}
        </div>
      )}

      {/* ── Stats cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(statsCards[view] || statsCards.tous).map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ── Charts row (masqué pour les collaborateurs) ───────────────────── */}
      {canSeeCharts && <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Area chart — monthly trend */}
        <div className="card xl:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Évolution mensuelle (6 mois)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C_DEEP}  stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C_DEEP}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C_LIGHT} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C_LIGHT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {view !== 'externe' && (
                <Area
                  type="monotone"
                  dataKey="internes"
                  name="Internes"
                  stroke={C_DEEP}
                  strokeWidth={2}
                  fill="url(#gradInt)"
                  dot={{ r: 3, fill: C_DEEP }}
                  activeDot={{ r: 5 }}
                />
              )}
              {view !== 'interne' && (
                <Area
                  type="monotone"
                  dataKey="externes"
                  name="Externes"
                  stroke={C_LIGHT}
                  strokeWidth={2}
                  fill="url(#gradExt)"
                  dot={{ r: 3, fill: C_LIGHT }}
                  activeDot={{ r: 5 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart — status distribution */}
        <div className="card xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Répartition par statut</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {view === 'tous' ? (
              <BarChart data={statusBarData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="int" name="Internes" fill={C_DEEP} radius={[3, 3, 0, 0]} />
                <Bar dataKey="ext" name="Externes" fill={C_LIGHT} radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={statusBarData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Fiches" radius={[3, 3, 0, 0]}>
                  {statusBarData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>}

      {/* ── Bottom row: recent + pending ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent fiches */}
        <div className={`card ${canSeePending ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Fiches récentes</h2>
            <Link
              to={view === 'externe' ? '/fiches-externes' : '/fiches-internes'}
              className="text-xs font-medium transition-colors"
              style={{ color: C_MID }}
            >
              Voir tout →
            </Link>
          </div>
          <RecentFichesTable rows={recentFiches} view={view} navigate={navigate} />
        </div>

        {/* Pending fiches (managers/DAF/director) */}
        {canSeePending && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">À valider</h2>
                {pendingForMe.total > 0 && (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: '#D97706' }}
                  >
                    {pendingForMe.total}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-2">
              {pendingForMe.total === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto h-8 w-8 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="text-xs text-gray-400">Aucune fiche en attente</p>
                </div>
              ) : (
                <>
                  {pendingForMe.fiches_internes > 0 && (
                    <Link
                      to="/fiches-internes"
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all group"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">Fiches internes</p>
                        <p className="text-xs text-gray-500">En attente de votre validation</p>
                      </div>
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: C_DEEP }}
                      >
                        {pendingForMe.fiches_internes}
                      </span>
                    </Link>
                  )}
                  {pendingForMe.fiches_externes > 0 && (
                    <Link
                      to="/fiches-externes"
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all group"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">Fiches externes</p>
                        <p className="text-xs text-gray-500">En attente de votre validation</p>
                      </div>
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: C_LIGHT }}
                      >
                        {pendingForMe.fiches_externes}
                      </span>
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Quick actions */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actions rapides</p>
              <button
                type="button"
                onClick={() => navigate('/fiches-internes/create')}
                className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(22,44,84,0.08)', color: C_DEEP }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Nouvelle fiche interne</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/fiches-externes/create')}
                className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(55,182,233,0.1)', color: C_LIGHT }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">Nouvelle fiche externe</p>
              </button>
              {isComptable && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/bons-paiement')}
                    className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Bons de Paiement</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/bons-commande')}
                    className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Bons de Commande</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/missions')}
                    className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#d97706' }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Missions</p>
                  </button>
                </>
              )}
              {isRH && !isComptable && (
                <button
                  type="button"
                  onClick={() => navigate('/missions')}
                  className="flex w-full items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#d97706' }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Missions</p>
                </button>
              )}
            </div>
          </div>
        )}
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
const iconGlobe = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)