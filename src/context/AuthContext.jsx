import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getMe } from '../api/api'
import { desactivarIngresoAutomatico, reactivarIngresoAutomatico } from '../auth/microsoft'

const AuthContext = createContext(null)

// Códigos de permiso (deben coincidir con EmailMasivo.Core.Security.Permisos)
export const PERMISOS = {
  DESTINATARIOS_VER: 'destinatarios.ver',
  DESTINATARIOS_EDITAR: 'destinatarios.editar',
  ENVIO_VER: 'envio.ver',
  ENVIO_EJECUTAR: 'envio.ejecutar',
  PLANTILLAS_VER: 'plantillas.ver',
  PLANTILLAS_EDITAR: 'plantillas.editar',
  PDFURLS_VER: 'pdfurls.ver',
  PDFURLS_EDITAR: 'pdfurls.editar',
  USUARIOS_ADMINISTRAR: 'usuarios.administrar',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  const loginUser = useCallback((token, userData) => {
    const { token: _omit, ...datos } = userData
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(datos))
    reactivarIngresoAutomatico()
    setUser(datos)
  }, [])

  // Cerrar sesión a mano desactiva el ingreso automático con Microsoft en esta pestaña
  // (si no, el login volvería a entrar solo). Una sesión vencida ({ automatico: true }) sí permite reingresar solo.
  const logout = useCallback((opciones) => {
    if (!opciones?.automatico) desactivarIngresoAutomatico()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  // Al cargar la app se refrescan rol y permisos (pudieron cambiar desde el último login)
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getMe()
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data))
        setUser(data)
      })
      .catch(err => { if (err.response?.status === 401) logout({ automatico: true }) })
  }, [logout])

  const hasPermission = useCallback(
    (permiso) => !!user?.permisos?.includes(permiso),
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, loginUser, logout, hasPermission, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
