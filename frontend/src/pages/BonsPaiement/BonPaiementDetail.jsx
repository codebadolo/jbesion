import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  fetchBonPaiementById,
  validateBonPaiement,
  cancelBonPaiement,
  deleteBonPaiement,
  selectCurrentBon,
  selectBonsPaiementLoading,
  clearCurrent,
} from '../../store/bonsPaiementSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'

const MODE_LABELS = {
  ESPECE:  'Espèce',
  CHEQUE:  'Chèque',
}

const STATUS_CONFIG = {
  DRAFT:     { label: 'Brouillon', bg: 'bg-gray-100',   text: 'text-gray-700'  },
  VALIDATED: { label: 'Validé',    bg: 'bg-green-100',  text: 'text-green-700' },
  CANCELLED: { label: 'Annulé',    bg: 'bg-red-100',    text: 'text-red-700'   },
}

function isComptable(user) {
  return user?.role === 'DAF' || user?.role === 'ADMIN'
}

export default function BonPaiementDetail() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { id }   = useParams()
  const bon      = useSelector(selectCurrentBon)
  const loading  = useSelector(selectBonsPaiementLoading)
  const user     = useSelector(selectUser)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError,   setActionError]   = useState(null)

  useEffect(() => {
    dispatch(fetchBonPaiementById(id))
    return () => dispatch(clearCurrent())
  }, [dispatch, id])

  const handleValidate = async () => {
    setActionError(null)
    try { await dispatch(validateBonPaiement(id)).unwrap() }
    catch (e) { setActionError(typeof e === 'string' ? e : 'Erreur lors de la validation.') }
  }

  const handleCancel = async () => {
    setActionError(null)
    try { await dispatch(cancelBonPaiement(id)).unwrap() }
    catch (e) { setActionError(typeof e === 'string' ? e : 'Erreur lors de l\'annulation.') }
  }

  const handleDelete = async () => {
    try {
      await dispatch(deleteBonPaiement(id)).unwrap()
      navigate('/bons-paiement')
    } catch (e) { setActionError(typeof e === 'string' ? e : 'Erreur lors de la suppression.') }
  }

  const handlePrint = () => window.print()

  if (loading && !bon) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    )
  }

  if (!bon) return null

  const statusCfg = STATUS_CONFIG[bon.status] ?? STATUS_CONFIG.DRAFT
  const total = bon.items?.reduce((acc, i) => acc + parseFloat(i.montant || 0), 0) ?? parseFloat(bon.montant)
  const canManage = isComptable(user)

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Screen view ───────────────────────────────────────────── */}
      <div className="print:hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/bons-paiement')}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">{bon.numero}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Créé le {formatDate(bon.created_at)} par {getFullName(bon.created_by_detail) || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Imprimer
            </button>
            {canManage && bon.status === 'DRAFT' && (
              <>
                <Link to={`/bons-paiement/${bon.id}/edit`} className="btn-secondary flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  Modifier
                </Link>
                <button
                  onClick={handleValidate}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Valider
                </button>
              </>
            )}
            {canManage && bon.status !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="btn-secondary !text-red-600 flex items-center gap-2"
              >
                Annuler le bon
              </button>
            )}
            {canManage && bon.status === 'DRAFT' && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <span className="text-sm text-red-700">Confirmer la suppression ?</span>
                <button onClick={handleDelete} className="text-sm font-semibold text-red-600 hover:text-red-800">Oui</button>
                <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500 hover:text-gray-700">Non</button>
              </div>
            )}
          </div>
        </div>

        {actionError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
            {actionError}
          </div>
        )}

        {/* Info card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-gray-500 font-medium">Date</dt>
              <dd className="text-gray-900 font-semibold mt-0.5">{formatDate(bon.date)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Mode de paiement</dt>
              <dd className="text-gray-900 font-semibold mt-0.5">{MODE_LABELS[bon.mode_paiement] ?? bon.mode_paiement}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Bénéficiaire (Reçu par)</dt>
              <dd className="text-gray-900 font-semibold mt-0.5">{bon.beneficiaire}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Montant</dt>
              <dd className="text-xl font-bold text-gray-900 mt-0.5">{Number(bon.montant).toLocaleString('fr-FR')} FCFA</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500 font-medium">Motif</dt>
              <dd className="text-gray-900 mt-0.5">{bon.motif}</dd>
            </div>
            {bon.montant_lettres && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 font-medium">Montant en lettres</dt>
                <dd className="text-gray-900 italic mt-0.5">{bon.montant_lettres}</dd>
              </div>
            )}
            {bon.notes && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500 font-medium">Notes</dt>
                <dd className="text-gray-600 mt-0.5">{bon.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Items table */}
        {bon.items?.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Tableau récapitulatif</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Désignation / Détail</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Montant (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bon.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-3 text-sm text-gray-700">{item.designation}</td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                      {Number(item.montant).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-6 py-3 text-sm text-gray-800">TOTAL</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">
                    {total.toLocaleString('fr-FR')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Print view ─────────────────────────────────────────────── */}
      <div className="hidden print:block print-bon">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-bon, .print-bon * { visibility: visible; }
            .print-bon { position: fixed; top: 0; left: 0; width: 100%; }
          }
        `}</style>

        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', padding: '20px', maxWidth: '700px', margin: '0 auto', border: '2px solid #000' }}>
          {/* Company header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>JO'FE DIGITAL SARL</h2>
            <p style={{ margin: '2px 0', fontSize: '11px' }}>Ouagadougou, Secteur 53 (Ex Secteur 15), Ouaga 2000</p>
          </div>

          {/* Title + number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
              BON DE PAIEMENT
            </h1>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold' }}>N° {bon.numero}</div>
              <div style={{ fontSize: '11px', color: '#555' }}>Date : {formatDate(bon.date)}</div>
            </div>
          </div>

          {/* Payment details */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', width: '35%', borderBottom: '1px solid #ccc' }}>Mode de paiement</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ccc' }}>{MODE_LABELS[bon.mode_paiement] ?? bon.mode_paiement}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>Montant en chiffres</td>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #ccc' }}>
                  {Number(bon.montant).toLocaleString('fr-FR')} F
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>Montant en lettres</td>
                <td style={{ padding: '5px 8px', fontStyle: 'italic', borderBottom: '1px solid #ccc' }}>
                  {bon.montant_lettres || '_______________________________________________'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>Bénéficiaire (Reçu par)</td>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>{bon.beneficiaire}</td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', borderBottom: '1px solid #ccc' }}>Motif</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #ccc' }}>{bon.motif}</td>
              </tr>
            </tbody>
          </table>

          {/* Items table */}
          {bon.items?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', border: '1px solid #000' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #000', fontWeight: 'bold' }}>Détails</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', border: '1px solid #000', fontWeight: 'bold', width: '120px' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {bon.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 8px', border: '1px solid #000' }}>{item.designation}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #000' }}>
                      {Number(item.montant).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                  <td style={{ padding: '5px 8px', border: '1px solid #000' }}>TOTAL</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #000' }}>
                    {total.toLocaleString('fr-FR')}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #ccc' }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '40px' }}>La Caisse</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '11px', color: '#555' }}>Signature</div>
            </div>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '40px' }}>Le Receveur</div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '11px', color: '#555' }}>
                {bon.beneficiaire}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
