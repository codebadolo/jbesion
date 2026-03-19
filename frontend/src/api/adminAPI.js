import axiosInstance from './axios.js'

// Users
export const getUsers = (params) => axiosInstance.get('/users/', { params }).then(r => r.data)
export const getUserById = (id) => axiosInstance.get(`/users/${id}/`).then(r => r.data)
export const createUser = (data) => axiosInstance.post('/users/', data).then(r => r.data)
export const updateUser = (id, data) => axiosInstance.patch(`/users/${id}/`, data).then(r => r.data)
export const deleteUser = (id) => axiosInstance.delete(`/users/${id}/`).then(r => r.data)
export const getManagers = () => axiosInstance.get('/users/managers/').then(r => r.data)

// Departments
export const getDepartments = () => axiosInstance.get('/departments/').then(r => r.data)
export const createDepartment = (data) => axiosInstance.post('/departments/', data).then(r => r.data)
export const updateDepartment = (id, data) => axiosInstance.patch(`/departments/${id}/`, data).then(r => r.data)
export const deleteDepartment = (id) => axiosInstance.delete(`/departments/${id}/`).then(r => r.data)
