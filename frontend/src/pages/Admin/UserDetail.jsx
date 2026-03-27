import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '../../store/authSlice.js'
import { getUserById } from '../../api/adminAPI.js'
import { getFichesInternes, getFichesExternes } from '../../api/fichesAPI.js'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import { formatDate } from '../../utils/helpers.js'

const ROLE_CONFIG = {
  EMPLOYEE:  { label: 'Employé',    bg: 'bg-gray-100',   text: 'text-gray-700'   },
  MANAGER:   { label: 'Manager',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  DAF:       { label: 'DAF',        bg: 'bg-purple-100', text: 'text-purple-700' },
  DIRECTOR:  { label: 'Directeur',  bg: 'bg-orange-100', text: 'text-orange-700' },
  ADMIN:     { label: 'Admin',      bg: 'bg-red-100',    text: 'text-red-700'    },
}

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || { label: role, bg: 'bg-gray-100', text: 'text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-3 border-b border-gray-50 last:border-0">
      <span className=" flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function FichesTable({ fiches, type, loading }) {
  const color = type === 'interne' ? 'blue' : 'indigo'

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">Chargement...</div>
    )
  }

  if (fiches.length === 0) {
    return (
      <div className="py-10 text-center">
        <svg className="mx-auto h-10 w-10 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-sm text-gray-400">Aucune fiche {type}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-gray-50">
            <th className="table-header">N°</th>
            <th className="table-header">Date</th>
            <th className="table-header">Département</th>
            <th className="table-header">Statut</th>
            <th className="table-header">Articles</th>
            <th className="table-header">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {fiches.map((fiche) => (
            <tr key={fiche.id} className="hover:bg-gray-50 transition-colors">
              <td className="table-cell">
                <span className="font-mono text-xs text-gray-500">#{fiche.id}</span>
              </td>
              <td className="table-cell text-gray-500">
                {formatDate(fiche.created_at)}
              </td>
              <td className="table-cell text-gray-500">
                {fiche.department_detail?.name || '—'}
              </td>
              <td className="table-cell">
                <StatusBadge status={fiche.status} size="sm" />
              </td>
              <td className="table-cell text-gray-500">
                {fiche.item_count ?? '—'}
              </td>
              <td className="table-cell">
                <Link
                  to={`/fiches-${type === 'interne' ? 'internes' : 'externes'}/${fiche.id}`}
                  className={`inline-flex items-center gap-1 text-sm font-medium text-${color}-600 hover:text-${color}-700 transition-colors`}
                >
                  Voir
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useSelector(selectUser)

  const [user, setUser]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [fichesInternes, setFichesInternes] = useState([])
  const [fichesExternes, setFichesExternes] = useState([])
  const [fichesLoading, setFichesLoading] = useState(true)

  const isAdmin = currentUser?.role === 'ADMIN'

  useEffect(() => {
    setLoading(true)
    setError(null)
    getUserById(id)
      .then(setUser)
      .catch(() => setError('Utilisateur introuvable ou accès refusé.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setFichesLoading(true)
    Promise.all([
      getFichesInternes({ created_by: id }),
      getFichesExternes({ created_by: id }),
    ])
      .then(([internes, externes]) => {
        const toList = (data) => Array.isArray(data) ? data : data.results ?? []
        setFichesInternes(toList(internes))
        setFichesExternes(toList(externes))
      })
      .catch(() => {})
      .finally(() => setFichesLoading(false))
  }, [id])

  if (loading) return <LoadingSpinner message="Chargement du profil..." />

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-base font-semibold text-gray-800">Profil introuvable</h2>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">← Retour</button>
      </div>
    )
  }

  const fullName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
  const isSelf = user.id === currentUser?.id
  const managerName = user.manager_detail
    ? [user.manager_detail.first_name, user.manager_detail.last_name].filter(Boolean).join(' ') || user.manager_detail.username
    : null

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Profil utilisateur</h1>
      </div>

      {/* Profile card */}
      <div className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600" />
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md border-2 border-white text-2xl font-bold text-blue-700">
              {initials}
            </div>
            <div className="flex items-center gap-2 pb-1">
              {isSelf && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-medium">Mon profil</span>
              )}
              {!user.is_active && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">Inactif</span>
              )}
              {isAdmin && (
                <Link to="/admin/utilisateurs" state={{ editUserId: user.id }} className="btn-secondary text-xs py-1.5">
                  <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                  Modifier
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
              <p className="text-sm text-gray-500 font-mono mt-0.5">@{user.username}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Informations personnelles */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Identité
            </h3>
          </div>
          <div className="px-5 py-2">
            <InfoRow label="Prénom" value={user.first_name} />
            <InfoRow label="Nom" value={user.last_name} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Téléphone" value={user.phone || null} />
          </div>
        </div>

        {/* Organisation */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              Organisation
            </h3>
          </div>
          <div className="px-5 py-2">
            <InfoRow
              label="Département"
              value={user.department_detail ? `${user.department_detail.name} (${user.department_detail.code})` : null}
            />
            <InfoRow
              label="Manager"
              value={
                user.manager_detail ? (
                  <Link to={`/admin/utilisateurs/${user.manager_detail.id}`} className="text-blue-600 hover:underline">
                    {managerName}
                  </Link>
                ) : null
              }
            />
            <InfoRow label="Rôle" value={<RoleBadge role={user.role} />} />
          </div>
        </div>

        {/* Compte */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              Compte
            </h3>
          </div>
          <div className="px-5 py-2">
            <InfoRow label="Username" value={user.username} />
            <InfoRow label="Statut" value={
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${user.is_active ? 'text-green-700' : 'text-red-600'}`}>
                <span className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                {user.is_active ? 'Actif' : 'Inactif'}
              </span>
            } />
            <InfoRow label="Inscrit le" value={formatDate(user.date_joined)} />
            <InfoRow label="Dernière co." value={user.last_login ? formatDate(user.last_login) : 'Jamais'} />
            {(user.is_agent_liaison || user.is_comptable || user.is_rh) && (
              <div className="flex items-start py-3 border-b border-gray-50 last:border-0">
                <span className="flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">
                  Attributs
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {user.is_comptable && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      Comptable
                    </span>
                  )}
                  {user.is_rh && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                      RH
                    </span>
                  )}
                  {user.is_agent_liaison && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                      Agent liaison
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Fiches Internes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
            </svg>
            Fiches de Besoins Internes
            {!fichesLoading && (
              <span className="ml-1 text-xs font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                {fichesInternes.length}
              </span>
            )}
          </h3>
          {fichesInternes.length > 0 && (
            <Link to="/fiches-internes" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Voir tout →
            </Link>
          )}
        </div>
        <FichesTable fiches={fichesInternes} type="interne" loading={fichesLoading} />
      </div>

      {/* Fiches Externes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918" />
            </svg>
            Fiches de Besoins Externes
            {!fichesLoading && (
              <span className="ml-1 text-xs font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                {fichesExternes.length}
              </span>
            )}
          </h3>
          {fichesExternes.length > 0 && (
            <Link to="/fiches-externes" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Voir tout →
            </Link>
          )}
        </div>
        <FichesTable fiches={fichesExternes} type="externe" loading={fichesLoading} />
      </div>

    </div>
  )
}
