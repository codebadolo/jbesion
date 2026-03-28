import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axios.js'
import { selectUser } from '../../store/authSlice.js'
import { createFicheMission, selectMissionsError } from '../../store/missionsSlice.js'

const today = new Date().toISOString().split('T')[0]

// Couleurs
const C_DEEP = '#162C54'
const C_MID = '#3475BB'
const C_LIGHT = '#37B6E9'

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
    <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header avec navigation */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/missions')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Fiche de Mission</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créer une fiche de frais de mission</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1: Identification - Pleine largeur */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }}></div>
            <h2 className="text-base font-semibold text-gray-800">Identification</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="form-label flex items-center gap-1">
                Date de la fiche <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                value={form.date} 
                onChange={(e) => set('date', e.target.value)}
                className="form-input w-full" 
                required 
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                Département <span className="text-red-500">*</span>
              </label>
              <select 
                value={form.department} 
                onChange={(e) => set('department', e.target.value)}
                className="form-input w-full" 
                required
              >
                <option value="">Sélectionner un département…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {fieldErrors.department && <p className="mt-1 text-xs text-red-600">{fieldErrors.department}</p>}
            </div>
          </div>
        </div>

        {/* Section 2: Personne en mission - Pleine largeur */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }}></div>
            <h2 className="text-base font-semibold text-gray-800">Personne en mission</h2>
          </div>

          {/* Toggle personnel / prestataire - Style amélioré */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => { setIsInternal(true); set('prestataire_nom', '') }}
              className={`flex-1 px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                isInternal 
                  ? 'text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={isInternal ? { backgroundColor: C_DEEP } : {}}
            >
              Personnel interne
            </button>
            <button
              type="button"
              onClick={() => { setIsInternal(false); set('beneficiaire', ''); set('matricule_display', ''); set('nom_prenom', ''); set('fonction', '') }}
              className={`flex-1 px-6 py-2.5 text-sm font-medium transition-all duration-200 ${
                !isInternal 
                  ? 'text-white' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={!isInternal ? { backgroundColor: C_DEEP } : {}}
            >
              Prestataire externe
            </button>
          </div>

          {isInternal ? (
            <div className="mb-5">
              <label className="form-label">Sélectionner un collaborateur</label>
              <select 
                value={form.beneficiaire}
                onChange={(e) => handleBeneficiaireChange(e.target.value)}
                className="form-input w-full"
              >
                <option value="">— Saisir manuellement —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || `${u.first_name} ${u.last_name}`} {u.matricule ? `(${u.matricule})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-5">
              <label className="form-label">Nom du prestataire</label>
              <input 
                type="text" 
                value={form.prestataire_nom}
                onChange={(e) => set('prestataire_nom', e.target.value)}
                className="form-input w-full" 
                placeholder="Nom de la société / personne" 
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="form-label">Matricule</label>
              <input 
                type="text" 
                value={form.matricule_display}
                onChange={(e) => set('matricule_display', e.target.value)}
                className="form-input w-full font-mono"
                placeholder="MAT-2026-00001"
                readOnly={isInternal && !!form.beneficiaire} 
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                Nom et Prénom <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={form.nom_prenom}
                onChange={(e) => set('nom_prenom', e.target.value)}
                className="form-input w-full" 
                required
                placeholder="KONÉ Moussa" 
              />
              {fieldErrors.nom_prenom && <p className="mt-1 text-xs text-red-600">{fieldErrors.nom_prenom}</p>}
            </div>
            <div>
              <label className="form-label">Fonction / Poste</label>
              <input 
                type="text" 
                value={form.fonction}
                onChange={(e) => set('fonction', e.target.value)}
                className="form-input w-full" 
                placeholder="Chargé de Communication" 
              />
            </div>
          </div>
        </div>

        {/* Section 3: Détails de la mission - Pleine largeur */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }}></div>
            <h2 className="text-base font-semibold text-gray-800">Détails de la mission</h2>
          </div>
          <div className="space-y-5">
            <div>
              <label className="form-label flex items-center gap-1">
                Destination <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={form.destination}
                onChange={(e) => set('destination', e.target.value)}
                className="form-input w-full" 
                required 
                placeholder="Ex : Bobo-Dioulasso" 
              />
              {fieldErrors.destination && <p className="mt-1 text-xs text-red-600">{fieldErrors.destination}</p>}
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                Objet de la mission <span className="text-red-500">*</span>
              </label>
              <textarea 
                value={form.objet_mission}
                onChange={(e) => set('objet_mission', e.target.value)}
                rows={3} 
                className="form-input w-full" 
                required
                placeholder="Ex : Couverture photo des activités Moov à Bobo-Dioulasso" 
              />
              {fieldErrors.objet_mission && <p className="mt-1 text-xs text-red-600">{fieldErrors.objet_mission}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="form-label flex items-center gap-1">
                  Date de départ <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.date_debut}
                  onChange={(e) => set('date_debut', e.target.value)}
                  className="form-input w-full" 
                  required 
                />
              </div>
              <div>
                <label className="form-label flex items-center gap-1">
                  Date de retour <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={form.date_fin}
                  onChange={(e) => set('date_fin', e.target.value)}
                  className="form-input w-full" 
                  required 
                />
              </div>
              <div>
                <label className="form-label">Agent de liaison</label>
                <select 
                  value={form.agent_liaison}
                  onChange={(e) => set('agent_liaison', e.target.value)}
                  className="form-input w-full"
                >
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
        </div>

        {/* Section 4: Frais - Pleine largeur */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }}></div>
            <h2 className="text-base font-semibold text-gray-800">Frais de mission (FCFA)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            <div>
              <label className="form-label">Hébergement</label>
              <input 
                type="number" 
                value={form.hebergement}
                onChange={(e) => set('hebergement', e.target.value)}
                min="0" 
                step="1" 
                className="form-input w-full" 
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label">Restauration</label>
              <input 
                type="number" 
                value={form.restauration}
                onChange={(e) => set('restauration', e.target.value)}
                min="0" 
                step="1" 
                className="form-input w-full" 
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label">Transport A/R</label>
              <input 
                type="number" 
                value={form.transport_aller_retour}
                onChange={(e) => set('transport_aller_retour', e.target.value)}
                min="0" 
                step="1" 
                className="form-input w-full" 
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label">Autres frais</label>
              <input 
                type="number" 
                value={form.autres_frais}
                onChange={(e) => set('autres_frais', e.target.value)}
                min="0" 
                step="1" 
                className="form-input w-full" 
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <div 
              className="rounded-lg px-6 py-4"
              style={{ backgroundColor: `${C_DEEP}10`, borderLeft: `3px solid ${C_DEEP}` }}
            >
              <span className="text-sm font-medium" style={{ color: C_DEEP }}>Total estimé : </span>
              <span className="text-2xl font-bold" style={{ color: C_DEEP }}>
                {totalFrais.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Notes - Pleine largeur */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-6 w-1 rounded-full" style={{ backgroundColor: C_DEEP }}></div>
            <h2 className="text-base font-semibold text-gray-800">Notes / Observations</h2>
          </div>
          <textarea 
            value={form.notes} 
            onChange={(e) => set('notes', e.target.value)}
            rows={3} 
            className="form-input w-full" 
            placeholder="Informations complémentaires…" 
          />
        </div>

        {apiError && typeof apiError === 'string' && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 pb-8">
          <button 
            type="button" 
            onClick={() => navigate('/missions')} 
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            disabled={loading} 
            className="px-6 py-2.5 rounded-lg text-white font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: C_DEEP }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création en cours…
              </span>
            ) : 'Créer la fiche de mission'}
          </button>
        </div>
      </form>
    </div>
  )
}