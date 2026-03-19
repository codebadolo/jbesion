import React from 'react'
import { formatMontant } from '../../utils/helpers.js'

/**
 * Reusable items table for both fiche types.
 *
 * Props:
 *   items     – array of item objects
 *   onChange  – callback(newItems) when items change (omit for readOnly)
 *   type      – 'interne' | 'externe'
 *   readOnly  – boolean
 */
export default function ItemsTable({ items = [], onChange, type = 'interne', readOnly = false }) {
  const isExterne = type === 'externe'

  const emptyItem = isExterne
    ? { designation: '', quantity: 1, affectation: '', date_requise: '', montant_prestataire: '', montant_client: '' }
    : { designation: '', quantity: 1, date_requise: '', montant: '' }

  const handleAdd = () => {
    onChange([...items, { ...emptyItem, _id: Date.now() }])
  }

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const handleChange = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    )
    onChange(updated)
  }

  // ── Read-only table ─────────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header w-8">#</th>
              <th className="table-header">Désignation</th>
              <th className="table-header">Qté</th>
              {isExterne && <th className="table-header">Affectation</th>}
              <th className="table-header">Date requise</th>
              {isExterne ? (
                <>
                  <th className="table-header">Mnt. Prestataire</th>
                  <th className="table-header">Mnt. Client</th>
                </>
              ) : (
                <th className="table-header">Montant</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={isExterne ? 7 : 5}
                  className="table-cell text-center text-gray-400 py-8"
                >
                  Aucun article
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id || item._id || idx} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell text-gray-400 font-mono text-xs">{idx + 1}</td>
                  <td className="table-cell font-medium text-gray-900">{item.designation || '—'}</td>
                  <td className="table-cell">{item.quantity ?? item.quantite ?? '—'}</td>
                  {isExterne && <td className="table-cell">{item.affectation || '—'}</td>}
                  <td className="table-cell">
                    {item.date_requise
                      ? new Date(item.date_requise).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  {isExterne ? (
                    <>
                      <td className="table-cell">{formatMontant(item.montant_prestataire)}</td>
                      <td className="table-cell">{formatMontant(item.montant_client)}</td>
                    </>
                  ) : (
                    <td className="table-cell">{formatMontant(item.montant)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && isExterne && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="table-cell text-right font-semibold text-gray-700">
                  Totaux :
                </td>
                <td className="table-cell font-semibold text-gray-900">
                  {formatMontant(
                    items.reduce((s, i) => s + (parseFloat(i.montant_prestataire) || 0), 0),
                  )}
                </td>
                <td className="table-cell font-semibold text-gray-900">
                  {formatMontant(
                    items.reduce((s, i) => s + (parseFloat(i.montant_client) || 0), 0),
                  )}
                </td>
              </tr>
            </tfoot>
          )}
          {items.length > 0 && !isExterne && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="table-cell text-right font-semibold text-gray-700">
                  Total :
                </td>
                <td className="table-cell font-semibold text-gray-900">
                  {formatMontant(
                    items.reduce((s, i) => s + (parseFloat(i.montant) || 0), 0),
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    )
  }

  // ── Editable table ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header w-8">#</th>
              <th className="table-header min-w-[160px]">Désignation *</th>
              <th className="table-header w-20">Qté *</th>
              {isExterne && <th className="table-header min-w-[120px]">Affectation</th>}
              <th className="table-header min-w-[130px]">Date requise</th>
              {isExterne ? (
                <>
                  <th className="table-header min-w-[130px]">Mnt. Prestataire</th>
                  <th className="table-header min-w-[130px]">Mnt. Client</th>
                </>
              ) : (
                <th className="table-header min-w-[120px]">Montant</th>
              )}
              <th className="table-header w-10" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={isExterne ? 8 : 6}
                  className="table-cell text-center text-gray-400 py-8"
                >
                  Aucun article. Cliquez sur "Ajouter une ligne" pour commencer.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id || item._id || idx} className="group">
                  <td className="table-cell text-gray-400 font-mono text-xs">{idx + 1}</td>

                  {/* Désignation */}
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.designation || ''}
                      onChange={(e) => handleChange(idx, 'designation', e.target.value)}
                      className="form-input text-xs"
                      placeholder="Désignation..."
                      required
                    />
                  </td>

                  {/* Quantité */}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity ?? item.quantite ?? ''}
                      onChange={(e) => handleChange(idx, 'quantity', e.target.value)}
                      className="form-input text-xs w-20"
                      placeholder="1"
                      required
                    />
                  </td>

                  {/* Affectation (externe only) */}
                  {isExterne && (
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.affectation || ''}
                        onChange={(e) => handleChange(idx, 'affectation', e.target.value)}
                        className="form-input text-xs"
                        placeholder="Affectation..."
                      />
                    </td>
                  )}

                  {/* Date requise */}
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={item.date_requise || ''}
                      onChange={(e) => handleChange(idx, 'date_requise', e.target.value)}
                      className="form-input text-xs"
                    />
                  </td>

                  {/* Montant(s) */}
                  {isExterne ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.montant_prestataire || ''}
                          onChange={(e) => handleChange(idx, 'montant_prestataire', e.target.value)}
                          className="form-input text-xs"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.montant_client || ''}
                          onChange={(e) => handleChange(idx, 'montant_client', e.target.value)}
                          className="form-input text-xs"
                          placeholder="0.00"
                        />
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.montant || ''}
                        onChange={(e) => handleChange(idx, 'montant', e.target.value)}
                        className="form-input text-xs"
                        placeholder="0.00"
                      />
                    </td>
                  )}

                  {/* Remove */}
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Supprimer cette ligne"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Ajouter une ligne
      </button>
    </div>
  )
}
