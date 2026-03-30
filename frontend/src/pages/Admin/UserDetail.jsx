import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getUserById, getUsers } from '../../api/adminAPI.js'
import { getFichesExternes, getFichesInternes } from '../../api/fichesAPI.js'
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx'
import StatusBadge from '../../components/Common/StatusBadge.jsx'
import { selectUser } from '../../store/authSlice.js'
import { formatDate } from '../../utils/helpers.js'

const C_DEEP = '#162C54'
const C_MID = '#3475BB'
const C_LIGHT = '#37B6E9'

const ROLE_CONFIG = {
  EMPLOYEE:  { label: 'Collaborateur',                   color: '#6B7280', bg: 'bg-gray-100',   text: 'text-gray-700'   },
  MANAGER:   { label: 'Supérieur Hiérarchique',          color: '#3475BB', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  DAF:       { label: 'Directeur Administratif et Fin.', color: '#7C3AED', bg: 'bg-purple-100', text: 'text-purple-700' },
  DIRECTOR:  { label: 'Directeur Général',               color: '#D97706', bg: 'bg-orange-100', text: 'text-orange-700' },
  ADMIN:     { label: 'Administrateur',                  color: '#DC2626', bg: 'bg-red-100',    text: 'text-red-700'    },
}

// Permissions affichées par rôle dans la carte "Accès & Capacités"
const ROLE_PERMISSIONS = {
  EMPLOYEE: [
    { label: 'Créer des fiches internes & externes', ok: true },
    { label: 'Valider les fiches d\'autres utilisateurs', ok: false },
    { label: 'Accès aux rapports globaux', ok: false },
    { label: 'Administration des utilisateurs', ok: false },
  ],
  MANAGER: [
    { label: 'Créer des fiches internes & externes', ok: true },
    { label: 'Valider (niveau 1) les fiches de son équipe', ok: true },
    { label: 'Demander des clarifications', ok: true },
    { label: 'Administration des utilisateurs', ok: false },
  ],
  DAF: [
    { label: 'Créer des fiches internes & externes', ok: true },
    { label: 'Validation financière des fiches', ok: true },
    { label: 'Consulter la liste des utilisateurs', ok: true },
    { label: 'Administration complète', ok: false },
  ],
  DIRECTOR: [
    { label: 'Approbation finale des fiches', ok: true },
    { label: 'Consulter toutes les fiches', ok: true },
    { label: 'Consulter la liste des utilisateurs', ok: true },
    { label: 'Administration complète', ok: false },
  ],
  ADMIN: [
    { label: 'Accès complet à toutes les fiches', ok: true },
    { label: 'Gestion des utilisateurs', ok: true },
    { label: 'Gestion des départements', ok: true },
    { label: 'Configuration du système', ok: true },
  ],
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
      <span className="w-28 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="flex-1 text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function FichesTable({ fiches, type, loading }) {
  const color = type === 'interne' ? C_MID : C_LIGHT

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
                  className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: color }}
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

// Composant StatCard pour les métriques
function StatCard({ label, value, icon, color }) {
  return (
    <div 
      className="rounded-xl p-5 transition-all duration-200 hover:shadow-md"
      style={{ 
        backgroundColor: '#FFFFFF',
        borderLeft: `4px solid ${color}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15`, color: color }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs font-medium text-gray-500">{label}</p>
        </div>
      </div>
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
  const [teamMembers, setTeamMembers]     = useState([])

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

  // Charger l'équipe si l'utilisateur est manager (admin seulement)
  useEffect(() => {
    if (!isAdmin || !user) return
    if (!['MANAGER', 'DIRECTOR', 'DAF'].includes(user.role)) return
    getUsers({ manager: id })
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results ?? []
        setTeamMembers(list)
      })
      .catch(() => {})
  }, [id, user, isAdmin])

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

  // Statistiques
  const stats = [
    { label: 'Fiches internes', value: fichesInternes.length, icon: iconDoc, color: C_MID },
    { label: 'Fiches externes', value: fichesExternes.length, icon: iconGlobe, color: C_LIGHT },
    { label: 'Total fiches', value: fichesInternes.length + fichesExternes.length, icon: iconDoc, color: C_DEEP },
  ]

  return (
    <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Header avec navigation */}
      <div className="flex items-center gap-3">
        <button 
          type="button" 
          onClick={() => navigate(-1)} 
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profil utilisateur</h1>
          <p className="text-sm text-gray-500 mt-0.5">Informations détaillées et activités</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Profile card - Design amélioré */}
      <div className="card overflow-hidden">
        <div 
          className="h-28 relative"
          style={{ 
            background: `linear-gradient(135deg, ${C_DEEP} 0%, ${C_MID} 100%)`
          }}
        >
          {/* Badges flottants */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isSelf && (
              <span className="text-xs bg-white/90 backdrop-blur-sm text-gray-700 px-2 py-1 rounded-full font-medium shadow-sm">
                Mon profil
              </span>
            )}
            {!user.is_active && (
              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-medium shadow-sm">
                Inactif
              </span>
            )}
          </div>
        </div>
        
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-5">
            <div 
              className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-lg border-4 border-white text-3xl font-bold"
              style={{ color: C_DEEP }}
            >
              {initials}
            </div>
            {isAdmin && (
              <Link 
                to="/admin/utilisateurs" 
                state={{ editUserId: user.id }} 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md"
                style={{ backgroundColor: `${C_DEEP}10`, color: C_DEEP }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
                Modifier le profil
              </Link>
            )}
          </div>
          
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
              <p className="text-sm text-gray-500 font-mono mt-1">@{user.username}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
        </div>
      </div>

      {/* Info cards - Grille 3 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Informations personnelles */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: C_MID }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Identité
            </h3>
          </div>
          <div className="px-5 py-2">
            <InfoRow label="Prénom" value={user.first_name} />
            <InfoRow label="Nom" value={user.last_name} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Téléphone" value={user.phone || 'Non renseigné'} />
          </div>
        </div>

        {/* Organisation */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: C_MID }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              Organisation
            </h3>
          </div>
          <div className="px-5 py-2">
            <InfoRow
              label="Département"
              value={user.department_detail ? `${user.department_detail.name} (${user.department_detail.code})` : 'Non assigné'}
            />
            {user.fonction && <InfoRow label="Fonction" value={user.fonction} />}
            <InfoRow
              label="Manager"
              value={
                user.manager_detail ? (
                  <Link 
                    to={`/admin/utilisateurs/${user.manager_detail.id}`} 
                    className="hover:underline transition-colors"
                    style={{ color: C_MID }}
                  >
                    {managerName}
                  </Link>
                ) : 'Aucun'
              }
            />
            <InfoRow label="Rôle" value={<RoleBadge role={user.role} />} />
          </div>
        </div>

        {/* Compte */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: C_MID }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
            <InfoRow label="Dernière connexion" value={user.last_login ? formatDate(user.last_login) : 'Jamais'} />
            {(user.is_agent_liaison || user.is_comptable || user.is_rh) && (
              <div className="flex items-start py-3 border-b border-gray-50 last:border-0">
                <span className="w-28 flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">
                  Attributs
                </span>
                <div className="flex-1 flex flex-wrap gap-1.5">
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

      {/* ── Accès & Capacités ─────────────────────────────────────────── */}
      {(() => {
        const rCfg = ROLE_CONFIG[user.role]
        const perms = ROLE_PERMISSIONS[user.role] || []
        const specialAttrs = [
          user.is_comptable    && { label: 'Comptable',         color: 'text-emerald-700 bg-emerald-50 border border-emerald-200', desc: 'Peut téléverser des factures pro forma sur les bons de commande.' },
          user.is_rh           && { label: 'Ressources Humaines', color: 'text-violet-700 bg-violet-50 border border-violet-200', desc: 'Accès aux fonctionnalités RH.' },
          user.is_agent_liaison && { label: 'Agent de liaison', color: 'text-sky-700 bg-sky-50 border border-sky-200', desc: 'Peut être désigné comme agent de liaison sur les fiches externes.' },
        ].filter(Boolean)

        return (
          <div className="card overflow-hidden">
            <div
              className="px-6 py-3 flex items-center gap-3"
              style={{ backgroundColor: `${rCfg?.color || C_MID}12`, borderBottom: `1px solid ${rCfg?.color || C_MID}20` }}
            >
              <svg className="h-4 w-4" style={{ color: rCfg?.color || C_MID }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">Accès & Capacités</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Permissions du rôle */}
              {perms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Permissions liées au rôle</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => (
                      <div key={p.label} className="flex items-center gap-2">
                        {p.ok ? (
                          <svg className="h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={`text-xs ${p.ok ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attributs spéciaux */}
              {specialAttrs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Attributs spéciaux</p>
                  <div className="flex flex-col gap-2">
                    {specialAttrs.map(a => (
                      <div key={a.label} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${a.color}`}>
                        <svg className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <div><span className="font-semibold">{a.label} — </span><span className="opacity-80">{a.desc}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {specialAttrs.length === 0 && perms.every(p => !p.ok) && (
                <p className="text-xs text-gray-400 italic">Aucune permission particulière au-delà du rôle de base.</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Équipe managée (si manager & admin) ───────────────────────── */}
      {isAdmin && ['MANAGER', 'DIRECTOR', 'DAF'].includes(user.role) && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }} />
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <svg className="h-4 w-4" style={{ color: C_DEEP }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                Équipe managée
              </h3>
              {teamMembers.length > 0 && (
                <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: C_DEEP }}>
                  {teamMembers.length}
                </span>
              )}
            </div>
          </div>

          {teamMembers.length === 0 ? (
            <div className="py-8 text-center">
              <svg className="mx-auto h-8 w-8 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <p className="text-sm text-gray-400">Aucun collaborateur assigné</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {teamMembers.map((member) => {
                const mName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username
                const mInitials = ((member.first_name?.[0] || '') + (member.last_name?.[0] || '')).toUpperCase() || member.username?.[0]?.toUpperCase() || '?'
                const mRoleCfg = ROLE_CONFIG[member.role] || { color: '#6B7280', label: member.role }
                return (
                  <div key={member.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                        style={{ backgroundColor: mRoleCfg.color }}
                      >
                        {mInitials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{mName}</p>
                        <p className="text-xs text-gray-500">{member.department_detail?.name || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CONFIG[member.role]?.bg || 'bg-gray-100'} ${ROLE_CONFIG[member.role]?.text || 'text-gray-700'}`}>
                        {mRoleCfg.label}
                      </span>
                      <Link
                        to={`/admin/utilisateurs/${member.id}`}
                        className="text-xs font-medium transition-colors hover:opacity-70"
                        style={{ color: C_DEEP }}
                      >
                        Voir →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Fiches Internes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_MID }}></div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: C_MID }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
              </svg>
              Fiches de Besoins Internes
            </h3>
            {!fichesLoading && fichesInternes.length > 0 && (
              <span 
                className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: C_MID }}
              >
                {fichesInternes.length}
              </span>
            )}
          </div>
          {fichesInternes.length > 0 && (
            <Link 
              to="/fiches-internes" 
              className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: C_MID }}
            >
              Voir tout →
            </Link>
          )}
        </div>
        <FichesTable fiches={fichesInternes} type="interne" loading={fichesLoading} />
      </div>

      {/* Fiches Externes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_LIGHT }}></div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: C_LIGHT }} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918" />
              </svg>
              Fiches de Besoins Externes
            </h3>
            {!fichesLoading && fichesExternes.length > 0 && (
              <span 
                className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: C_LIGHT }}
              >
                {fichesExternes.length}
              </span>
            )}
          </div>
          {fichesExternes.length > 0 && (
            <Link 
              to="/fiches-externes" 
              className="text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: C_LIGHT }}
            >
              Voir tout →
            </Link>
          )}
        </div>
        <FichesTable fiches={fichesExternes} type="externe" loading={fichesLoading} />
      </div>

    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────
const iconDoc = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
)

const iconGlobe = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918" />
  </svg>
)