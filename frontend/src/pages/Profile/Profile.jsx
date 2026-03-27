import React, { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectUser,
  updateProfile,
  uploadAvatar,
  changePassword,
} from '../../store/authSlice.js'
import { ROLE_LABELS } from '../../utils/constants.js'

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
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith('http')
      ? user.avatar
      : `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:8000'}${user.avatar}`
    : null

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || 'U'
    : 'U'

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

      {/* Avatar + infos identité */}
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
                style={{ backgroundColor: '#37B6E9' }}
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

          <div>
            <p className="text-sm font-medium text-gray-800">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-500">
              {ROLE_LABELS[user?.role] || user?.role}
              {user?.department_detail?.name ? ` — ${user.department_detail.name}` : ''}
            </p>
            {user?.matricule && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {user.matricule}
              </p>
            )}
            {user?.is_agent_liaison && (
              <span className="ml-2 inline-flex items-center text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                Agent de liaison
              </span>
            )}
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

      {/* Informations personnelles */}
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

      {/* Changer le mot de passe */}
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
