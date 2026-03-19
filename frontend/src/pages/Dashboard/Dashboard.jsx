import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '../../store/authSlice.js'
import { getDashboardData } from '../../api/dashboardAPI.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import { formatDate, getFullName } from '../../utils/helpers.js'
import { VALIDATION_ROLES } from '../../utils/constants.js'

function StatCard({ label, value, icon, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    yellow: 'bg-yellow-50 text-yellow-600 ring-yellow-100',
    green: 'bg-green-50 text-green-600 ring-green-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
    gray: 'bg-gray-50 text-gray-600 ring-gray-100',
  }
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useSelector(selectUser)
  const userRole = user?.role || user?.role_code

  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  useEffect(() => {
    setLoading(true)
    getDashboardData()
      .then((d) => setData(d))
      .catch(() => setError('Impossible de charger le tableau de bord.'))
      .finally(() => setLoading(false))
  }, [])

  const stats = data?.stats || {}
  const recentFiches = data?.recent_fiches || []
  const pendingFiches = data?.pending_fiches || []

  // Show pending section only for roles that validate
  const canSeePending = ['MANAGER', 'DAF', 'DIRECTOR', 'ADMIN'].includes(userRole)

  if (loading) return <LoadingSpinner message="Chargement du tableau de bord..." />

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Bonjour, {user?.first_name || getFullName(user)} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Voici un aperçu de l'activité aujourd'hui.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/fiches/create" className="btn-primary">
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total fiches"
          value={stats.total}
          color="blue"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
        />
        <StatCard
          label="En attente"
          value={stats.pending}
          color="yellow"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Approuvées"
          value={stats.approved}
          color="green"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
        <StatCard
          label="Rejetées"
          value={stats.rejected}
          color="red"
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/fiches/create?type=interne')}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                Créer une fiche interne
              </p>
              <p className="text-xs text-gray-500">Besoins matériels internes</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/fiches/create?type=externe')}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">
                Créer une fiche externe
              </p>
              <p className="text-xs text-gray-500">Prestations & prestataires</p>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent fiches */}
        <div className={`card ${canSeePending ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Fiches récentes</h2>
            <Link to="/fiches" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Voir tout →
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentFiches.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="text-sm text-gray-400">Aucune fiche pour le moment</p>
                <Link to="/fiches/create" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
                  Créer votre première fiche →
                </Link>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="table-header">N°</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Créé par</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Statut</th>
                    <th className="table-header" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentFiches.map((fiche) => (
                    <tr key={`${fiche.type}-${fiche.id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-mono text-xs text-gray-500">
                        #{fiche.numero || fiche.id}
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                          ${fiche.type === 'interne' || fiche.fiche_type === 'interne'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-indigo-50 text-indigo-700'}`}>
                          {fiche.type === 'interne' || fiche.fiche_type === 'interne' ? 'Interne' : 'Externe'}
                        </span>
                      </td>
                      <td className="table-cell">{getFullName(fiche.created_by || fiche.user)}</td>
                      <td className="table-cell text-gray-500">{formatDate(fiche.created_at)}</td>
                      <td className="table-cell">
                        <StatusBadge status={fiche.status} size="sm" />
                      </td>
                      <td className="table-cell">
                        <Link
                          to={`/fiches-${fiche.type === 'interne' || fiche.fiche_type === 'interne' ? 'internes' : 'externes'}/${fiche.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pending fiches (managers/DAF/director) */}
        {canSeePending && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">À valider</h2>
                {pendingFiches.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-white text-xs font-bold">
                    {pendingFiches.length}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-2">
              {pendingFiches.length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto h-8 w-8 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="text-xs text-gray-400">Aucune fiche en attente</p>
                </div>
              ) : (
                pendingFiches.map((fiche) => (
                  <Link
                    key={`${fiche.type}-${fiche.id}`}
                    to={`/fiches-${fiche.type === 'interne' ? 'internes' : 'externes'}/${fiche.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700">
                        #{fiche.numero || fiche.id}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getFullName(fiche.created_by || fiche.user)}
                      </p>
                    </div>
                    <StatusBadge status={fiche.status} size="sm" />
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
