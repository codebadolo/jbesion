import axiosInstance from './axios.js'

// ── Fiches Internes ──────────────────────────────────────────────────────────

export const getFichesInternes = (params) =>
  axiosInstance.get('/fiches-internes/', { params }).then((r) => r.data)

export const getFicheInterneById = (id) =>
  axiosInstance.get(`/fiches-internes/${id}/`).then((r) => r.data)

export const createFicheInterne = (data) =>
  axiosInstance.post('/fiches-internes/', data).then((r) => r.data)

export const updateFicheInterne = (id, data) =>
  axiosInstance.put(`/fiches-internes/${id}/`, data).then((r) => r.data)

export const submitFicheInterne = (id) =>
  axiosInstance.post(`/fiches-internes/${id}/submit/`).then((r) => r.data)

export const validateFicheInterne = (id, data) =>
  axiosInstance.post(`/fiches-internes/${id}/validate/`, data).then((r) => r.data)

// ── Fiches Externes ──────────────────────────────────────────────────────────

export const getFichesExternes = (params) =>
  axiosInstance.get('/fiches-externes/', { params }).then((r) => r.data)

export const getFicheExterneById = (id) =>
  axiosInstance.get(`/fiches-externes/${id}/`).then((r) => r.data)

export const createFicheExterne = (data) =>
  axiosInstance.post('/fiches-externes/', data).then((r) => r.data)

export const updateFicheExterne = (id, data) =>
  axiosInstance.put(`/fiches-externes/${id}/`, data).then((r) => r.data)

export const submitFicheExterne = (id) =>
  axiosInstance.post(`/fiches-externes/${id}/submit/`).then((r) => r.data)

export const validateFicheExterne = (id, data) =>
  axiosInstance.post(`/fiches-externes/${id}/validate/`, data).then((r) => r.data)
