import axios from 'axios'
import demoAdapter from './demoAdapter'

// Modo demo (por defecto): el backend se simula en memoria. Para usar la API real:
//   VITE_DEMO=false  VITE_API_URL=https://mi-servidor/api
export const DEMO = import.meta.env.VITE_DEMO !== 'false'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://localhost:7222/api',
  ...(DEMO ? { adapter: demoAdapter } : {}),
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.hash.endsWith('/login')) {
        window.location.hash = '#/login'
      }
    } else if (err.response?.status === 403 && !err.response.data?.message) {
      err.response.data = { ...(err.response.data || {}), message: 'No tienes permiso para realizar esta acción' }
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)
export const getMe = () => api.get('/auth/me')
export const getMicrosoftConfig = () => api.get('/auth/microsoft/config')
export const loginMicrosoft = (idToken) => api.post('/auth/microsoft', { idToken })

// Plantillas
export const getPlantillas = () => api.get('/plantillas')
export const getPlantilla = (id) => api.get(`/plantillas/${id}`)
export const createPlantilla = (data) => api.post('/plantillas', data)
export const updatePlantilla = (id, data) => api.put(`/plantillas/${id}`, data)
export const deletePlantilla = (id) => api.delete(`/plantillas/${id}`)
export const getVariablesPlantilla = () => api.get('/plantillas/variables')
export const vistaPreviaPlantilla = (data) => api.post('/plantillas/vista-previa', data)

// Empleados (vista del sistema de nómina)
export const getEmpresas = () => api.get('/empleados/empresas')
export const getEmpleadosActivos = (ciaCodigo) =>
  api.get('/empleados/activos', { params: { ciaCodigo: ciaCodigo || undefined } })

// Usuarios, roles y permisos
export const getUsuarios = () => api.get('/usuarios')
export const createUsuario = (data) => api.post('/usuarios', data)
export const updateUsuario = (id, data) => api.put(`/usuarios/${id}`, data)
export const resetPasswordUsuario = (id, password) => api.put(`/usuarios/${id}/password`, { password })
export const getRoles = () => api.get('/usuarios/roles')
export const getPermisos = () => api.get('/usuarios/permisos')
export const updateRolPermisos = (id, permisos) => api.put(`/usuarios/roles/${id}/permisos`, { permisos })
export const createRol = (data) => api.post('/usuarios/roles', data)
export const updateRol = (id, data) => api.put(`/usuarios/roles/${id}`, data)
export const deleteRol = (id) => api.delete(`/usuarios/roles/${id}`)

// Cargas
export const getCargas = (estado) => api.get('/cargas', { params: { estado } })
export const getResumen = () => api.get('/cargas/resumen')
export const cargarPorCodigos = (data) => api.post('/cargas/cargar-codigos', data)
export const procesarArchivos = (data) => api.post('/cargas/procesar-archivos', data)
export const toggleHabilitado = (correlativo, habilitado) =>
  api.patch(`/cargas/${correlativo}/habilitado`, { correlativo, habilitado })
export const deleteCarga = (correlativo) => api.delete(`/cargas/${correlativo}`)
export const deleteAllCargas = () => api.delete('/cargas/todos')
export const deleteEnviadosCargas = () => api.delete('/cargas/enviados')

// Archivos
export const subirArchivos = (formData) =>
  api.post('/archivos/subir', formData)
export const limpiarTemporales = () => api.delete('/archivos/limpiar-temporales')

// Plantillas URL PDF
export const getPdfUrls = () => api.get('/plantillasurlpdf')
export const getPdfUrl = (id) => api.get(`/plantillasurlpdf/${id}`)
export const createPdfUrl = (data) => api.post('/plantillasurlpdf', data)
export const updatePdfUrl = (id, data) => api.put(`/plantillasurlpdf/${id}`, data)
export const deletePdfUrl = (id) => api.delete(`/plantillasurlpdf/${id}`)

// Envío
export const iniciarEnvio = (bloqueId) => api.post('/envio/iniciar', { bloqueId })
export const getProgreso = () => api.get('/envio/progreso')
export const getEstado = () => api.get('/envio/estado')

// Historial de envíos por bloques
export const getBloques = (params) => api.get('/bloques', { params })
export const getBloque = (id) => api.get(`/bloques/${id}`)
export const reenviarBloque = (id, detalleIds) => api.post(`/bloques/${id}/reenviar`, { detalleIds })
export const agregarAlBloque = (id, data) => api.post(`/bloques/${id}/agregar`, data)

// Envíos (lotes) pendientes
export const getEnviosPendientes = () => api.get('/bloques/pendientes')
export const crearEnvio = (data) => api.post('/bloques', data)
export const eliminarEnvio = (id) => api.delete(`/bloques/${id}`)
export const quitarDelEnvio = (id, correlativo) => api.delete(`/bloques/${id}/destinatarios/${correlativo}`)

export default api
