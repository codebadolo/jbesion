import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createFicheMission, selectMissionsError } from '../../store/missionsSlice.js'
import { selectUser } from '../../store/authSlice.js'
import axiosInstance from '../../api/axios.js'

const today = new Date().toISOString().split('T')[0]

export default function FicheMissionCreate() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user     = useSelector(selectUser)
  const apiError = useSelector(selectMissionsError)

  const [departments, setDepartments] = useState([])
  const [users,       setUsers]       = useState([])
  const [agents,      setAgents]      = useState([])
  const [loading,     setLoading]     = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isInternal,  setIsInternal]  = useState(true)

  const [form, setForm] = useState({
    date:                  today,
    beneficiaire:          '',
    matricule_display:     '',
    nom_prenom:            '',
    fonction:              '',
    destination:           '',
    objet_mission:         '',
    date_debut:            today,
    date_fin:              today,
    hebergement:           '0',
    restauration:          '0',
    transport_aller_retour:'0',
    autres_frais:          '0',
    prestataire_nom:       '',
    agent_liaison:         '',
    department:            user?.department?.id || '',
    notes:                 '',
  })

  useEffect(() => {
    axiosInstance.get('/departments/').then((r) => setDepartments(r.data?.results ?? r.data))
    axiosInstance.get('/users/').then((r) => setUsers(r.data?.results ?? r.data))
    axiosInstance.get('/users/agents_liaison/').then((r) => setAgents(r.data))
  }, [])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleBeneficiaireChange = (userId) => {
    set('beneficiaire', userId)
    if (userId) {
      const u = users.find((u) => String(u.id) === String(userId))
      if (u) {
        set('nom_prenom', u.full_name || `${u.first_name} ${u.last_name}`.trim())
        set('fonction',   u.fonction || '')
        set('matricule_display', u.matricule || '')
      }
    }
  }

  const totalFrais = [form.hebergement, form.restauration, form.transport_aller_retour, form.autres_frais]
    .reduce((acc, v) => acc + (parseFloat(v) || 0), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    setLoading(true)
    const payload = { ...form }
    if (!payload.beneficiaire)    delete payload.beneficiaire
    if (!payload.agent_liaison)   delete payload.agent_liaison
    if (!payload.prestataire_nom) delete payload.prestataire_nom
    const result = await dispatch(createFicheMission(payload))
    setLoading(false)
    if (createFicheMission.fulfilled.match(result)) {
      navigate(`/missions/${result.payload.id}`)
    } else if (result.payload && typeof result.payload === 'object') {
      setFieldErrors(result.payload)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/missions')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Fiche de Mission</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fiche de frais de mission</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Identification */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Identification</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date de la fiche <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Département <span className="text-red-500">*</span></label>
              <select value={form.department} onChange={(e) => set('department', e.target.value)}
                className="form-input" required>
                <option value="">Sélectionner…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {fieldErrors.department && <p className="mt-1 text-xs text-red-600">{fieldErrors.department}</p>}
            </div>
          </div>
        </div>

        {/* Personne en mission */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personne en mission</h2>

          {/* Toggle personnel / prestataire */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button type="button"
              onClick={() => { setIsInternal(true); set('prestataire_nom', '') }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${isInternal ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'}`}>
              Personnel interne
            </button>
            <button type="button"
              onClick={() => { setIsInternal(false); set('beneficiaire', ''); set('matricule_display', '') }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${!isInternal ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:bg-gray-50'}`}>
              Prestataire externe
            </button>
          </div>

          {isInternal ? (
            <div>
              <label className="form-label">Sélectionner un collaborateur</label>
              <select value={form.beneficiaire}
                onChange={(e) => handleBeneficiaireChange(e.target.value)}
                className="form-input">
                <option value="">— Saisir manuellement —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || `${u.first_name} ${u.last_name}`} {u.matricule ? `(${u.matricule})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="form-label">Nom du prestataire</label>
              <input type="text" value={form.prestataire_nom}
                onChange={(e) => set('prestataire_nom', e.target.value)}
                className="form-input" placeholder="Nom de la société / personne" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Matricule</label>
              <input type="text" value={form.matricule_display}
                onChange={(e) => set('matricule_display', e.target.value)}
                className="form-input font-mono"
                placeholder="MAT-2026-00001"
                readOnly={isInternal && !!form.beneficiaire} />
            </div>
            <div>
              <label className="form-label">Nom et Prénom <span className="text-red-500">*</span></label>
              <input type="text" value={form.nom_prenom}
                onChange={(e) => set('nom_prenom', e.target.value)}
                className="form-input" required
                placeholder="KONÉ Moussa" />
              {fieldErrors.nom_prenom && <p className="mt-1 text-xs text-red-600">{fieldErrors.nom_prenom}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Fonction / Poste</label>
              <input type="text" value={form.fonction}
                onChange={(e) => set('fonction', e.target.value)}
                className="form-input" placeholder="Chargé de Communication" />
            </div>
          </div>
        </div>

        {/* Détails de la mission */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Détails de la mission</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label">Destination <span className="text-red-500">*</span></label>
              <input type="text" value={form.destination}
                onChange={(e) => set('destination', e.target.value)}
                className="form-input" required placeholder="Ex : Bobo-Dioulasso" />
              {fieldErrors.destination && <p className="mt-1 text-xs text-red-600">{fieldErrors.destination}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Objet de la mission <span className="text-red-500">*</span></label>
              <textarea value={form.objet_mission}
                onChange={(e) => set('objet_mission', e.target.value)}
                rows={2} className="form-input" required
                placeholder="Ex : Couverture photo des activités Moov à Bobo-Dioulasso" />
              {fieldErrors.objet_mission && <p className="mt-1 text-xs text-red-600">{fieldErrors.objet_mission}</p>}
            </div>
            <div>
              <label className="form-label">Date de départ <span className="text-red-500">*</span></label>
              <input type="date" value={form.date_debut}
                onChange={(e) => set('date_debut', e.target.value)}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Date de retour <span className="text-red-500">*</span></label>
              <input type="date" value={form.date_fin}
                onChange={(e) => set('date_fin', e.target.value)}
                className="form-input" required />
            </div>
            <div>
              <label className="form-label">Agent de liaison</label>
              <select value={form.agent_liaison}
                onChange={(e) => set('agent_liaison', e.target.value)}
                className="form-input">
                <option value="">— Aucun —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || `${a.first_name} ${a.last_name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Frais */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Frais de mission (FCFA)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'hebergement',          label: 'Hébergement' },
              { key: 'restauration',         label: 'Restauration' },
              { key: 'transport_aller_retour', label: 'Transport A/R' },
              { key: 'autres_frais',         label: 'Autres frais' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="form-label">{label}</label>
                <input type="number" value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  min="0" step="1" className="form-input" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <span className="text-sm text-blue-700 font-medium">Total : </span>
              <span className="text-lg font-bold text-blue-900">
                {totalFrais.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card p-6">
          <label className="form-label">Notes / Observations</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
            rows={2} className="form-input" placeholder="Informations complémentaires…" />
        </div>

        {apiError && typeof apiError === 'string' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/missions')} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création…
              </span>
            ) : 'Créer la fiche de mission'}
          </button>
        </div>
      </form>
    </div>
  )
}
