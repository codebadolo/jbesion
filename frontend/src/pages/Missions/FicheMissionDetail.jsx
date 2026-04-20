import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchFicheMissionById,
  soumettreMission, validerMission, rejeterMission, cloturerMission,
  deleteFicheMission,
  clearCurrent,
  selectCurrentMission,
  selectMissionsLoading,
} from '../../store/missionsSlice.js'
import { selectUser } from '../../store/authSlice.js'
import { formatDate, getFullName } from '../../utils/helpers.js'
import { exportFicheMissionPDF } from '../../utils/exportPDF.js'

const STATUS_CONFIG = {
  DRAFT:           { label: 'Brouillon',          color: 'bg-gray-100 text-gray-700',    step: 0 },
  PENDING_MANAGER: { label: 'En attente Manager', color: 'bg-yellow-100 text-yellow-800', step: 1 },
  PENDING_DAF:     { label: 'En attente DAF',     color: 'bg-orange-100 text-orange-800', step: 2 },
  PENDING_DG:      { label: 'En attente DG',      color: 'bg-purple-100 text-purple-800', step: 3 },
  APPROVED:        { label: 'Approuvée',           color: 'bg-green-100 text-green-800',   step: 4 },
  REJECTED:        { label: 'Rejetée',             color: 'bg-red-100 text-red-800',       step: -1 },
  IN_PROGRESS:     { label: 'En cours',            color: 'bg-blue-100 text-blue-800',     step: 5 },
  DONE:            { label: 'Terminée',            color: 'bg-teal-100 text-teal-800',     step: 6 },
}

const STEPS = ['Brouillon', 'Manager', 'DAF', 'DG', 'Approuvée', 'En cours', 'Terminée']

function canValidate(user, status) {
  if (status === 'PENDING_MANAGER') return ['MANAGER', 'DAF', 'DIRECTOR', 'ADMIN'].includes(user?.role)
  if (status === 'PENDING_DAF')     return ['DAF', 'ADMIN'].includes(user?.role)
  if (status === 'PENDING_DG')      return ['DIRECTOR', 'ADMIN'].includes(user?.role)
  return false
}

function WorkflowTracker({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  if (cfg.step < 0) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 text-red-700 font-semibold text-sm">Rejetée</span>
      </div>
    )
  }
  return (
    <ol className="flex items-center gap-0 w-full">
      {STEPS.map((label, i) => {
        const done   = i < cfg.step
        const active = i === cfg.step
        const isLast = i === STEPS.length - 1
        return (
          <React.Fragment key={label}>
            <li className="flex flex-col items-center text-center flex-shrink-0">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                done ? 'bg-green-500 border-green-500 text-white' :
                active ? 'border-blue-500 bg-blue-50 text-blue-700' :
                         'border-gray-200 bg-gray-50 text-gray-400'}`}>
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? 'text-blue-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </li>
            {!isLast && <div className={`flex-1 h-0.5 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

function FraisRow({ label, value }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4 text-sm text-gray-600">{label}</td>
      <td className="py-2 text-sm font-medium text-right text-gray-900">
        {Number(value || 0).toLocaleString('fr-FR')} FCFA
      </td>
    </tr>
  )
}

export default function FicheMissionDetail() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const { id }    = useParams()
  const mission   = useSelector(selectCurrentMission)
  const loading   = useSelector(selectMissionsLoading)
  const user      = useSelector(selectUser)

  const [actionError,    setActionError]    = useState(null)
  const [commentaire,    setCommentaire]    = useState('')
  const [showRejet,      setShowRejet]      = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  useEffect(() => {
    dispatch(fetchFicheMissionById(id))
    return () => dispatch(clearCurrent())
  }, [dispatch, id])

  const doAction = async (thunk, arg) => {
    setActionError(null)
    try { await dispatch(thunk(arg)).unwrap() }
    catch (e) { setActionError(typeof e === 'string' ? e : JSON.stringify(e)) }
  }

  const handleDelete = async () => {
    try {
      await dispatch(deleteFicheMission(id)).unwrap()
      navigate('/missions')
    } catch (e) { setActionError('Erreur lors de la suppression.') }
  }

  if (loading && !mission) {
    return (
      <div className="flex items-center justify-center py-32">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    )
  }
  if (!mission) return null

  const cfg = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.DRAFT
  const isOwner = mission.created_by === user?.id || mission.created_by_detail?.id === user?.id
  const isPending = ['PENDING_MANAGER','PENDING_DAF','PENDING_DG'].includes(mission.status)

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/missions')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{mission.numero}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Créée le {formatDate(mission.created_at)} par {getFullName(mission.created_by_detail) || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportFicheMissionPDF(mission)} className="btn-secondary flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exporter PDF
          </button>
          {mission.status === 'DRAFT' && isOwner && (
            <button onClick={() => doAction(soumettreMission, id)} disabled={loading}
              className="btn-primary">Soumettre</button>
          )}
          {isPending && canValidate(user, mission.status) && (
            <>
              <button onClick={() => doAction(validerMission, { id, data: {} })} disabled={loading}
                className="btn-primary">Valider</button>
              <button onClick={() => setShowRejet(!showRejet)} className="btn-danger">Rejeter</button>
            </>
          )}
          {['APPROVED','IN_PROGRESS'].includes(mission.status) &&
            ['DIRECTOR','DAF','ADMIN','MANAGER'].includes(user?.role) && (
            <button onClick={() => doAction(cloturerMission, id)} disabled={loading}
              className="btn-secondary">Clôturer</button>
          )}
          {mission.status === 'DRAFT' && isOwner && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-sm text-red-700">Supprimer ?</span>
              <button onClick={handleDelete} className="text-sm font-semibold text-red-600 hover:text-red-800">Oui</button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm text-gray-500">Non</button>
            </div>
          )}
        </div>
      </div>

      {/* Rejet inline */}
      {showRejet && (
        <div className="card p-4 border-l-4 border-red-400 bg-red-50">
          <p className="text-sm font-semibold text-red-700 mb-2">Motif de rejet</p>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            rows={2} className="form-input w-full" placeholder="Expliquer le motif de rejet…" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { doAction(rejeterMission, { id, data: { commentaire } }); setShowRejet(false) }}
              className="btn-danger">Confirmer le rejet</button>
            <button onClick={() => setShowRejet(false)} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Workflow */}
      <div className="card p-5"><WorkflowTracker status={mission.status} /></div>

      {/* Fiche imprimable */}
      <div className="card p-6 space-y-6">
        <h2 className="text-base font-bold text-gray-800 border-b pb-2">FICHE DE FRAIS DE MISSION</h2>

        {/* Identification */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">N° de fiche</p>
            <p className="font-mono font-bold text-gray-900">{mission.numero}</p>
          </div>
          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-semibold text-gray-900">{formatDate(mission.date)}</p>
          </div>
          <div>
            <p className="text-gray-500">Matricule</p>
            <p className="font-mono font-semibold text-gray-900">{mission.matricule_display || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Nom et Prénom</p>
            <p className="font-semibold text-gray-900">{mission.nom_prenom}</p>
          </div>
          <div>
            <p className="text-gray-500">Fonction</p>
            <p className="font-semibold text-gray-900">{mission.fonction || '—'}</p>
          </div>
          {mission.prestataire_nom && (
            <div>
              <p className="text-gray-500">Prestataire</p>
              <p className="font-semibold text-gray-900">{mission.prestataire_nom}</p>
            </div>
          )}
        </div>

        {/* Mission */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t pt-4">
          <div className="sm:col-span-2">
            <p className="text-gray-500">Destination</p>
            <p className="font-semibold text-gray-900 text-base">{mission.destination}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-gray-500">Objet de la mission</p>
            <p className="text-gray-900 mt-0.5">{mission.objet_mission}</p>
          </div>
          <div>
            <p className="text-gray-500">Date de départ</p>
            <p className="font-semibold text-gray-900">{formatDate(mission.date_debut)}</p>
          </div>
          <div>
            <p className="text-gray-500">Date de retour</p>
            <p className="font-semibold text-gray-900">{formatDate(mission.date_fin)}</p>
          </div>
          {mission.agent_liaison_detail && (
            <div>
              <p className="text-gray-500">Agent de liaison</p>
              <p className="font-semibold text-gray-900">{getFullName(mission.agent_liaison_detail)}</p>
            </div>
          )}
        </div>

        {/* Montants */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Détail des frais</p>
          <table className="w-full max-w-sm">
            <tbody>
              <FraisRow label="Hébergement"       value={mission.hebergement} />
              <FraisRow label="Restauration"      value={mission.restauration} />
              <FraisRow label="Transport A/R"     value={mission.transport_aller_retour} />
              <FraisRow label="Autres frais"      value={mission.autres_frais} />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td className="pt-2 text-sm font-bold text-gray-800">TOTAL</td>
                <td className="pt-2 text-sm font-bold text-right text-gray-900">
                  {Number(mission.total_frais || 0).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {mission.notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Notes</p>
            <p className="text-sm text-gray-700 mt-1">{mission.notes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="border-t pt-6 grid grid-cols-3 gap-8 text-center text-xs text-gray-500">
          {['L\'Intéressé(e)', 'Le Manager', 'Le DG / DAF'].map((s) => (
            <div key={s}>
              <div className="h-12 border-b border-dashed border-gray-300 mb-2" />
              <p className="font-medium text-gray-600">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
