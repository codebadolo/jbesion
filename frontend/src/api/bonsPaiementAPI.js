import axiosInstance from './axios.js'

export const getBonsPaiement = (params) =>
  axiosInstance.get('/bons-paiement/', { params }).then((r) => r.data)

export const getBonPaiementById = (id) =>
  axiosInstance.get(`/bons-paiement/${id}/`).then((r) => r.data)

export const createBonPaiement = (data) =>
  axiosInstance.post('/bons-paiement/', data).then((r) => r.data)

export const updateBonPaiement = (id, data) =>
  axiosInstance.put(`/bons-paiement/${id}/`, data).then((r) => r.data)

export const deleteBonPaiement = (id) =>
  axiosInstance.delete(`/bons-paiement/${id}/`).then((r) => r.data)

export const validateBonPaiement = (id) =>
  axiosInstance.post(`/bons-paiement/${id}/validate/`).then((r) => r.data)

export const cancelBonPaiement = (id) =>
  axiosInstance.post(`/bons-paiement/${id}/cancel/`).then((r) => r.data)
