import axiosInstance from './axios.js'

// ── CRUD ──────────────────────────────────────────────────────────────────────

export const getBonsCommande = (params) =>
  axiosInstance.get('/bons-commande/', { params }).then((r) => r.data)

export const getBonCommandeById = (id) =>
  axiosInstance.get(`/bons-commande/${id}/`).then((r) => r.data)

export const createBonCommande = (data) =>
  axiosInstance.post('/bons-commande/', data).then((r) => r.data)

export const updateBonCommande = (id, data) =>
  axiosInstance.put(`/bons-commande/${id}/`, data).then((r) => r.data)

export const deleteBonCommande = (id) =>
  axiosInstance.delete(`/bons-commande/${id}/`).then((r) => r.data)

// ── Workflow ───────────────────────────────────────────────────────────────────

export const soumettreDAF = (id) =>
  axiosInstance.post(`/bons-commande/${id}/soumettre-daf/`).then((r) => r.data)

export const validerProformas = (id, data) =>
  axiosInstance.post(`/bons-commande/${id}/valider-proformas/`, data).then((r) => r.data)

// ── Workflow DAF ──────────────────────────────────────────────────────────────

export const approuverDAF = (id, data) =>
  axiosInstance.post(`/bons-commande/${id}/approuver-daf/`, data).then((r) => r.data)

export const rejeterDAF = (id, data) =>
  axiosInstance.post(`/bons-commande/${id}/rejeter-daf/`, data).then((r) => r.data)

// ── Workflow DG ───────────────────────────────────────────────────────────────

export const approuverDG = (id, data) =>
  axiosInstance.post(`/bons-commande/${id}/approuver-dg/`, data).then((r) => r.data)

export const rejeterDG = (id, data) =>
  axiosInstance.post(`/bons-commande/${id}/rejeter-dg/`, data).then((r) => r.data)

// ── Exécution ─────────────────────────────────────────────────────────────────

export const executerBonCommande = (id) =>
  axiosInstance.post(`/bons-commande/${id}/executer/`).then((r) => r.data)

export const cloturerBonCommande = (id) =>
  axiosInstance.post(`/bons-commande/${id}/cloturer/`).then((r) => r.data)

// ── Fournisseur sélectionné ───────────────────────────────────────────────────

export const selectionnerFournisseur = (id, proformaId) =>
  axiosInstance.post(`/bons-commande/${id}/selectionner-fournisseur/`, {
    fournisseur_selectionne: proformaId,
  }).then((r) => r.data)

// ── Factures Proforma ─────────────────────────────────────────────────────────

export const getProformas = (bonId) =>
  axiosInstance.get(`/bons-commande/${bonId}/proformas/`).then((r) => r.data)

export const uploadProforma = (bonId, formData) =>
  axiosInstance.post(`/bons-commande/${bonId}/proformas/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)

export const deleteProforma = (bonId, proformaId) =>
  axiosInstance.delete(`/bons-commande/${bonId}/proformas/${proformaId}/`).then((r) => r.data)
