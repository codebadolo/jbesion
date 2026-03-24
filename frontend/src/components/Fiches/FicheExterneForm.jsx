import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { clearFichesError, createFiche, selectFichesError, selectFichesLoading } from '../../store/fichesSlice.js'
import ItemsTable from './ItemsTable.jsx'

/**
 * Form for creating a Fiche Externe.
 * Props:
 *   onSuccess – optional callback after successful creation
 */
export default function FicheExterneForm({ onSuccess }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const isLoading = useSelector(selectFichesLoading)
  const serverError = useSelector(selectFichesError)

  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [errors, setErrors] = useState({})

  const validate = () => {
    const errs = {}
    if (items.length === 0) {
      errs.items = 'Veuillez ajouter au moins un article.'
    } else {
      const invalid = items.some((it) => !it.designation || !it.quantity)
      if (invalid) errs.items = 'Chaque article doit avoir une désignation et une quantité.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    dispatch(clearFichesError())
    if (!validate()) return

    try {
      const result = await dispatch(
        createFiche({
          type: 'externe',
          data: {
            notes,
            items: items.map(({ _id, ...rest }) => ({
              ...rest,
              quantity: parseInt(rest.quantity, 10) || 1,
              montant_prestataire: rest.montant_prestataire
                ? parseFloat(rest.montant_prestataire)
                : null,
              montant_client: rest.montant_client
                ? parseFloat(rest.montant_client)
                : null,
            })),
          },
        }),
      ).unwrap()

      if (onSuccess) {
        onSuccess(result)
      } else {
        navigate(`/fiches-externes/${result.data?.id || result.id}`)
      }
    } catch {
      // error is already in the store
    }
  }

  // Totals display
  const totalPrestataire = items.reduce(
    (s, i) => s + (parseFloat(i.montant_prestataire) || 0),
    0,
  )
  const totalClient = items.reduce(
    (s, i) => s + (parseFloat(i.montant_client) || 0),
    0,
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Notes */}
      <div>
        <label htmlFor="notes-ext" className="form-label">
          Notes / Observations
        </label>
        <textarea
          id="notes-ext"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Décrivez le contexte, les prestataires envisagés..."
          className="form-input resize-none"
        />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="form-label mb-0">
            Articles / Prestations <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-500">
            {items.length} article{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ItemsTable
          items={items}
          onChange={setItems}
          type="externe"
          readOnly={false}
        />
        {errors.items && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            {errors.items}
          </p>
        )}
      </div>

      {/* Totals summary */}
      {items.length > 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Récapitulatif des montants
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Prestataire</p>
              <p className="text-lg font-bold text-gray-900">
                {totalPrestataire.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-sm font-normal text-gray-500">FCFA</span>
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Client</p>
              <p className="text-lg font-bold text-gray-900">
                {totalClient.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-sm font-normal text-gray-500">FCFA</span>
              </p>
            </div>
          </div>
          {totalClient > 0 && totalPrestataire > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Marge :{' '}
              <span className="font-semibold text-green-700">
                {(totalClient - totalPrestataire).toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                })}{' '}
                MAD
              </span>
            </p>
          )}
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{typeof serverError === 'string' ? serverError : JSON.stringify(serverError)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-secondary"
          disabled={isLoading}
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Création...
            </span>
          ) : (
            <>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Créer la fiche
            </>
          )}
        </button>
      </div>
    </form>
  )
}
