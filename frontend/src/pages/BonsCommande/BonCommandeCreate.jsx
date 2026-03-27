import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createBonCommande } from '../../store/bonsCommandeSlice.js'
import { selectBonsCommandeError } from '../../store/bonsCommandeSlice.js'

const today = new Date().toISOString().split('T')[0]

export default function BonCommandeCreate() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const error    = useSelector(selectBonsCommandeError)

  const [form, setForm] = useState({
    date:      today,
    objet:     '',
    reference: '',
    notes:     '',
  })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    setLoading(true)
    const result = await dispatch(createBonCommande(form))
    setLoading(false)
    if (createBonCommande.fulfilled.match(result)) {
      navigate(`/bons-commande/${result.payload.id}`)
    } else if (result.payload && typeof result.payload === 'object') {
      setFieldErrors(result.payload)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/bons-commande')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau Bon de Commande</h1>
          <p className="text-sm text-gray-500 mt-0.5">Workflow : DAF → DG pour exécution</p>
        </div>
      </div>

      {error && typeof error === 'string' && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Date */}
        <div>
          <label className="form-label">Date <span className="text-red-500">*</span></label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
            className="form-input" required />
          {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>}
        </div>

        {/* Objet */}
        <div>
          <label className="form-label">Objet / Description <span className="text-red-500">*</span></label>
          <textarea
            value={form.objet}
            onChange={(e) => set('objet', e.target.value)}
            rows={3}
            className="form-input"
            placeholder="Décrire l'objet de la commande…"
            required
          />
          {fieldErrors.objet && <p className="mt-1 text-xs text-red-600">{fieldErrors.objet}</p>}
        </div>

        {/* Référence (optionnelle) */}
        <div>
          <label className="form-label">
            Référence
            <span className="ml-1.5 text-xs text-gray-400 font-normal">(optionnelle)</span>
          </label>
          <input type="text" value={form.reference}
            onChange={(e) => set('reference', e.target.value)}
            className="form-input"
            placeholder="N° de commande interne, réf. client…" />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Notes / Observations</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="form-input"
            placeholder="Informations complémentaires…"
          />
        </div>

        {/* Info workflow */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          <strong>Workflow :</strong> Après création, soumettez au DAF pour approbation,
          puis au DG pour exécution. Le comptable pourra ensuite uploader les factures proforma
          des fournisseurs pour que le DAF/DG choisisse.
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/bons-commande')}
            className="btn-secondary">Annuler</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création…
              </span>
            ) : 'Créer le bon de commande'}
          </button>
        </div>
      </form>
    </div>
  )
}
