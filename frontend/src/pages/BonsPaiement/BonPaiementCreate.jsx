import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createBonPaiement,
  updateBonPaiement,
  fetchBonPaiementById,
  selectCurrentBon,
  selectBonsPaiementLoading,
  selectBonsPaiementError,
  clearCurrent,
  clearError,
} from '../../store/bonsPaiementSlice.js'
import { montantEnLettres } from '../../utils/helpers.js'

const MODES = [
  { value: 'ESPECE',  label: 'Espèce' },
  { value: 'CHEQUE',  label: 'Chèque' },
]

const emptyItem = () => ({ designation: '', montant: '' })

export default function BonPaiementCreate() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const { id }    = useParams()
  const isEdit    = Boolean(id)
  const current   = useSelector(selectCurrentBon)
  const loading   = useSelector(selectBonsPaiementLoading)
  const storeErr  = useSelector(selectBonsPaiementError)

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    date:            today,
    beneficiaire:    '',
    motif:           '',
    mode_paiement:   'ESPECE',
    montant_lettres: '',
    notes:           '',
  })
  const [items,   setItems]   = useState([emptyItem()])
  const [errors,  setErrors]  = useState({})

  // Load existing bon when editing
  useEffect(() => {
    if (isEdit) dispatch(fetchBonPaiementById(id))
    return () => { dispatch(clearCurrent()); dispatch(clearError()) }
  }, [dispatch, id, isEdit])

  useEffect(() => {
    if (isEdit && current && String(current.id) === String(id)) {
      setForm({
        date:            current.date,
        beneficiaire:    current.beneficiaire,
        motif:           current.motif,
        mode_paiement:   current.mode_paiement,
        montant_lettres: current.montant_lettres || '',
        notes:           current.notes || '',
      })
      setItems(current.items?.length ? current.items.map((i) => ({ designation: i.designation, montant: String(i.montant) })) : [emptyItem()])
      // Si le bon a déjà un montant en lettres saisi, on considère que c'est manuel
      setLettresManual(Boolean(current.montant_lettres))
    }
  }, [current, isEdit, id])

  const total = items.reduce((acc, i) => acc + (parseFloat(i.montant) || 0), 0)

  // Auto-fill montant_lettres whenever total changes, unless the user has manually edited it
  const [lettresManual, setLettresManual] = useState(false)
  useEffect(() => {
    if (!lettresManual) {
      setForm((f) => ({ ...f, montant_lettres: total > 0 ? montantEnLettres(total) : '' }))
    }
  }, [total, lettresManual])

  const set = (field) => (e) => {
    const value = e.target.value
    if (field === 'montant_lettres') setLettresManual(true)
    setForm((f) => ({ ...f, [field]: value }))
  }

  const setItem = (idx, field) => (e) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: e.target.value } : item))
  }

  const addItem    = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const validate = () => {
    const errs = {}
    if (!form.date)          errs.date          = 'Requis'
    if (!form.beneficiaire.trim()) errs.beneficiaire = 'Requis'
    if (!form.motif.trim())  errs.motif         = 'Requis'
    if (!form.mode_paiement) errs.mode_paiement = 'Requis'
    if (items.every((i) => !i.designation.trim())) errs.items = 'Au moins un article requis'
    items.forEach((item, idx) => {
      if (item.designation.trim() && !item.montant) {
        errs[`item_montant_${idx}`] = 'Montant requis'
      }
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const validItems = items.filter((i) => i.designation.trim())
    const payload = {
      ...form,
      montant: total,
      items: validItems.map((i) => ({ designation: i.designation, montant: parseFloat(i.montant) })),
    }

    try {
      let result
      if (isEdit) {
        result = await dispatch(updateBonPaiement({ id, data: payload })).unwrap()
      } else {
        result = await dispatch(createBonPaiement(payload)).unwrap()
      }
      navigate(`/bons-paiement/${result.id}`)
    } catch (_) {}
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(isEdit ? `/bons-paiement/${id}` : '/bons-paiement')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Modifier le bon de paiement' : 'Nouveau bon de paiement'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* General info */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">
            Informations générales
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={set('date')} className="form-input" />
              {errors.date && <p className="form-error">{errors.date}</p>}
            </div>
            <div>
              <label className="form-label">Mode de paiement <span className="text-red-500">*</span></label>
              <select value={form.mode_paiement} onChange={set('mode_paiement')} className="form-input">
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {errors.mode_paiement && <p className="form-error">{errors.mode_paiement}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Bénéficiaire (Reçu par) <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.beneficiaire}
              onChange={set('beneficiaire')}
              placeholder="Nom et prénom du bénéficiaire"
              className="form-input"
            />
            {errors.beneficiaire && <p className="form-error">{errors.beneficiaire}</p>}
          </div>

          <div>
            <label className="form-label">Motif <span className="text-red-500">*</span></label>
            <textarea
              value={form.motif}
              onChange={set('motif')}
              rows={2}
              placeholder="Objet / motif du paiement"
              className="form-input resize-none"
            />
            {errors.motif && <p className="form-error">{errors.motif}</p>}
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">
            Tableau récapitulatif
          </h2>
          {errors.items && <p className="form-error">{errors.items}</p>}

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.designation}
                  onChange={setItem(idx, 'designation')}
                  placeholder="Désignation / Détail"
                  className="form-input flex-1"
                />
                <input
                  type="number"
                  value={item.montant}
                  onChange={setItem(idx, 'montant')}
                  placeholder="Montant"
                  min="0"
                  step="0.01"
                  className={`form-input w-36 ${errors[`item_montant_${idx}`] ? 'border-red-400' : ''}`}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">FCFA</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter un article
          </button>

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <div className="text-right">
              <span className="text-sm text-gray-500 mr-3">TOTAL</span>
              <span className="text-xl font-bold text-gray-900">{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>

        {/* Montant en lettres + Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">Montant en lettres</label>
              {lettresManual && (
                <button
                  type="button"
                  onClick={() => { setLettresManual(false); setForm((f) => ({ ...f, montant_lettres: total > 0 ? montantEnLettres(total) : '' })) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  ↺ Regénérer automatiquement
                </button>
              )}
            </div>
            <input
              type="text"
              value={form.montant_lettres}
              onChange={set('montant_lettres')}
              placeholder="Généré automatiquement depuis le total…"
              className={`form-input ${!lettresManual && total > 0 ? 'bg-blue-50 border-blue-200' : ''}`}
            />
            {!lettresManual && total > 0 && (
              <p className="mt-1 text-xs text-blue-500">Généré automatiquement — modifiez pour personnaliser</p>
            )}
          </div>
          <div>
            <label className="form-label">Notes / Observations</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              className="form-input resize-none"
              placeholder="Observations complémentaires (optionnel)"
            />
          </div>
        </div>

        {/* Server error */}
        {storeErr && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {typeof storeErr === 'string' ? storeErr : JSON.stringify(storeErr)}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/bons-paiement/${id}` : '/bons-paiement')}
            className="btn-secondary"
          >
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Enregistrement…
              </span>
            ) : isEdit ? 'Enregistrer les modifications' : 'Créer le bon'}
          </button>
        </div>
      </form>
    </div>
  )
}
