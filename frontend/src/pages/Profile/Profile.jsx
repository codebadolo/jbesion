import React, { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectUser,
  updateProfile,
  uploadAvatar,
  changePassword,
} from '../../store/authSlice.js'
import { ROLE_LABELS } from '../../utils/constants.js'

const C_MID = '#3475BB'

// Configuration par rôle : couleur, description, permissions
const ROLE_CONFIG = {
  EMPLOYEE: {
    label: 'Collaborateur',
    color: '#6B7280',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    description: 'Accès standard — création et suivi de vos propres fiches de besoins.',
    permissions: [
      { label: 'Créer des fiches internes & externes', ok: true },
      { label: 'Suivre l\'avancement de vos fiches', ok: true },
      { label: 'Valider ou approuver des fiches', ok: false },
      { label: 'Accès à l\'administration', ok: false },
    ],
  },
  MANAGER: {
    label: 'Supérieur Hiérarchique',
    color: '#3475BB',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    description: 'Responsable hiérarchique — validation de premier niveau des fiches de votre équipe.',
    permissions: [
      { label: 'Créer des fiches internes & externes', ok: true },
      { label: 'Valider les fiches de votre équipe', ok: true },
      { label: 'Demander des clarifications', ok: true },
      { label: 'Accès à l\'administration', ok: false },
    ],
  },
  DAF: {
    label: 'Directeur Administratif et Financier',
    color: '#7C3AED',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    description: 'DAF — validation financière et contrôle des demandes d\'achat.',
    permissions: [
      { label: 'Créer des fiches internes & externes', ok: true },
      { label: 'Validation financière des fiches', ok: true },
      { label: 'Consulter la liste des utilisateurs', ok: true },
      { label: 'Accès à l\'administration complète', ok: false },
    ],
  },
  DIRECTOR: {
    label: 'Directeur Général',
    color: '#D97706',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    description: 'DG — approbation finale et supervision de l\'ensemble des fiches.',
    permissions: [
      { label: 'Approbation finale des fiches', ok: true },
      { label: 'Consulter toutes les fiches', ok: true },
      { label: 'Consulter la liste des utilisateurs', ok: true },
      { label: 'Accès à l\'administration complète', ok: false },
    ],
  },
  ADMIN: {
    label: 'Administrateur',
    color: '#DC2626',
    bg: 'bg-red-100',
    text: 'text-red-700',
    description: 'Accès complet — gestion des utilisateurs, départements et configuration du système.',
    permissions: [
      { label: 'Accès complet à toutes les fiches', ok: true },
      { label: 'Gestion des utilisateurs', ok: true },
      { label: 'Gestion des départements', ok: true },
      { label: 'Configuration du système', ok: true },
    ],
  },
}

const SPECIAL_ATTRS = [
  { key: 'is_comptable', label: 'Comptable', color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    description: 'Peut téléverser des factures pro forma sur les bons de commande.' },
  { key: 'is_rh',        label: 'Ressources Humaines', color: 'text-violet-700 bg-violet-50 border-violet-200',
    description: 'Accès aux fonctionnalités RH.' },
  { key: 'is_agent_liaison', label: 'Agent de liaison', color: 'text-sky-700 bg-sky-50 border-sky-200',
    description: 'Peut être désigné comme agent de liaison sur les fiches externes.' },
]

export default function Profile() {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const fileInputRef = useRef(null)

  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  })
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  })

  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarLoading, setAvatarLoading]   = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileSuccess, setProfileSuccess]   = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [profileError, setProfileError]       = useState(null)
  const [passwordError, setPasswordError]     = useState(null)

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith('http')
      ? user.avatar
      : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000'}${user.avatar}`
    : null

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || 'U'
    : 'U'

  const roleConfig = ROLE_CONFIG[user?.role] || {
    label: user?.role || '',
    color: C_MID,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    description: '',
    permissions: [],
  }

  const activeAttrs = SPECIAL_ATTRS.filter(a => user?.[a.key])

  const managerName = user?.manager_detail
    ? [user.manager_detail.first_name, user.manager_detail.last_name].filter(Boolean).join(' ') || user.manager_detail.username
    : null

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    await dispatch(uploadAvatar(file))
    setAvatarLoading(false)
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError(null)
    setProfileSuccess(false)
    const result = await dispatch(updateProfile(profileForm))
    setProfileLoading(false)
    if (updateProfile.fulfilled.match(result)) {
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } else {
      setProfileError(result.payload)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    const result = await dispatch(changePassword(passwordForm))
    setPasswordLoading(false)
    if (changePassword.fulfilled.match(result)) {
      setPasswordSuccess(true)
      setPasswordForm({ old_password: '', new_password: '', new_password_confirm: '' })
      setTimeout(() => setPasswordSuccess(false), 3000)
    } else {
      const err = result.payload
      if (typeof err === 'object') {
        const msgs = Object.values(err).flat().join(' ')
        setPasswordError(msgs)
      } else {
        setPasswordError(err)
      }
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos informations personnelles et votre mot de passe</p>
      </div>

      {/* ── Carte Rôle & Accès ────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
      >
        {/* Bandeau couleur du rôle */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: roleConfig.color }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Votre rôle</p>
              <p className="text-base font-bold text-white">{roleConfig.label}</p>
            </div>
          </div>
          {activeAttrs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {activeAttrs.map(a => (
                <span key={a.key} className="text-xs font-semibold bg-white/20 text-white px-2 py-1 rounded-full">
                  {a.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Corps de la carte */}
        <div className="bg-white px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">{roleConfig.description}</p>

          {/* Grille permissions */}
          {roleConfig.permissions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roleConfig.permissions.map((p) => (
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
          )}

          {/* Attributs spéciaux détaillés */}
          {activeAttrs.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Attributs spéciaux</p>
              <div className="flex flex-col gap-2">
                {activeAttrs.map(a => (
                  <div key={a.key} className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2 ${a.color}`}>
                    <svg className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <div>
                      <span className="font-semibold">{a.label} — </span>
                      <span className="opacity-80">{a.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manager hiérarchique */}
          {managerName && (
            <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              <span className="text-xs text-gray-500">Votre responsable hiérarchique :</span>
              <span className="text-xs font-semibold text-gray-800">{managerName}</span>
            </div>
          )}

          {/* Département */}
          {user?.department_detail && (
            <div className={`${managerName ? '' : 'border-t border-gray-100 pt-3'} flex items-center gap-2`}>
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="text-xs text-gray-500">Département :</span>
              <span className="text-xs font-semibold text-gray-800">
                {user.department_detail.name}
                {user.department_detail.code && <span className="ml-1 text-gray-400">({user.department_detail.code})</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Avatar + identité ────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Photo de profil</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200"
              />
            ) : (
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-2 ring-gray-200"
                style={{ backgroundColor: roleConfig.color }}
              >
                {initials}
              </div>
            )}
            {avatarLoading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-800">
              {user?.first_name} {user?.last_name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                style={{ color: roleConfig.color, borderColor: `${roleConfig.color}40`, backgroundColor: `${roleConfig.color}10` }}
              >
                {roleConfig.label}
              </span>
              {user?.matricule && (
                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  {user.matricule}
                </span>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {avatarLoading ? 'Upload...' : 'Changer la photo'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ─────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations personnelles</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Prénom</label>
              <input
                type="text"
                className="form-input"
                value={profileForm.first_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Nom</label>
              <input
                type="text"
                className="form-input"
                value={profileForm.last_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Téléphone</label>
            <input
              type="tel"
              className="form-input"
              value={profileForm.phone}
              onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+226 00 00 00 00"
            />
          </div>

          {/* Champs en lecture seule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Département</label>
              <input
                type="text"
                className="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
                value={user?.department_detail?.name || '—'}
                readOnly
              />
            </div>
            <div>
              <label className="form-label">Rôle</label>
              <input
                type="text"
                className="form-input bg-gray-50 text-gray-500 cursor-not-allowed"
                value={ROLE_LABELS[user?.role] || user?.role || '—'}
                readOnly
              />
            </div>
          </div>

          {profileError && (
            <p className="text-sm text-red-600">
              {typeof profileError === 'string' ? profileError : JSON.stringify(profileError)}
            </p>
          )}
          {profileSuccess && (
            <p className="text-sm text-green-600">Profil mis à jour avec succès.</p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Changer le mot de passe ───────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Changer le mot de passe</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="form-label">Mot de passe actuel</label>
            <input
              type="password"
              className="form-input"
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, old_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="form-label">Nouveau mot de passe</label>
            <input
              type="password"
              className="form-input"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="form-label">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              className="form-input"
              value={passwordForm.new_password_confirm}
              onChange={(e) => setPasswordForm((f) => ({ ...f, new_password_confirm: e.target.value }))}
              required
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600">Mot de passe changé avec succès.</p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={passwordLoading}>
              {passwordLoading ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
