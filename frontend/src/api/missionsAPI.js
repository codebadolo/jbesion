import axiosInstance from './axios.js'

// ── Fiches de Mission ─────────────────────────────────────────────────────────

export const getFichesMission = (params) =>
  axiosInstance.get('/missions/', { params }).then((r) => r.data)

export const getFicheMissionById = (id) =>
  axiosInstance.get(`/missions/${id}/`).then((r) => r.data)

export const createFicheMission = (data) =>
  axiosInstance.post('/missions/', data).then((r) => r.data)

export const updateFicheMission = (id, data) =>
  axiosInstance.put(`/missions/${id}/`, data).then((r) => r.data)

export const deleteFicheMission = (id) =>
  axiosInstance.delete(`/missions/${id}/`).then((r) => r.data)

// ── Workflow ──────────────────────────────────────────────────────────────────

export const soumettreMission = (id) =>
  axiosInstance.post(`/missions/${id}/soumettre/`).then((r) => r.data)

export const validerMission = (id, data) =>
  axiosInstance.post(`/missions/${id}/valider/`, data).then((r) => r.data)

export const rejeterMission = (id, data) =>
  axiosInstance.post(`/missions/${id}/rejeter/`, data).then((r) => r.data)

export const cloturerMission = (id) =>
  axiosInstance.post(`/missions/${id}/cloturer/`).then((r) => r.data)

// ── Absences Agents de Liaison ────────────────────────────────────────────────

export const getAbsences = (params) =>
  axiosInstance.get('/missions/absences/', { params }).then((r) => r.data)

export const getAbsenceById = (id) =>
  axiosInstance.get(`/missions/absences/${id}/`).then((r) => r.data)

export const createAbsence = (data) =>
  axiosInstance.post('/missions/absences/', data).then((r) => r.data)

export const updateAbsence = (id, data) =>
  axiosInstance.put(`/missions/absences/${id}/`, data).then((r) => r.data)

export const validerAbsence = (id) =>
  axiosInstance.post(`/missions/absences/${id}/valider/`).then((r) => r.data)

export const annulerAbsence = (id) =>
  axiosInstance.post(`/missions/absences/${id}/annuler/`).then((r) => r.data)
