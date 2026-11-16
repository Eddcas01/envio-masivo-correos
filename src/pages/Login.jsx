import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { login as loginApi, getMicrosoftConfig, loginMicrosoft, DEMO } from '../api/api'
import { obtenerIdTokenMicrosoft, intentarIngresoSilencioso, ingresoAutomaticoPermitido } from '../auth/microsoft'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [msConfig, setMsConfig] = useState(null)
  const [loadingMs, setLoadingMs] = useState(false)
  // true mientras se intenta el ingreso automático con la sesión de Windows/Microsoft
  const [ingresoAutomatico, setIngresoAutomatico] = useState(true)
  const [mostrarLoginLocal, setMostrarLoginLocal] = useState(false)
  const { loginUser } = useAuth()

  const entrarConToken = async (idToken) => {
    const { data } = await loginMicrosoft(idToken)
    loginUser(data.token, data)
  }

  useEffect(() => {
    let cancelado = false
    const iniciar = async () => {
      let config = null
      try {
        const { data } = await getMicrosoftConfig()
        config = data.habilitado ? data : null
      } catch { /* sin login con Microsoft */ }
      if (cancelado) return
      setMsConfig(config)

      // Ingreso automático: sin clics si el equipo ya tiene sesión de Microsoft (no tras cerrar sesión a mano)
      if (config && ingresoAutomaticoPermitido()) {
        const idToken = await intentarIngresoSilencioso(config)
        if (idToken && !cancelado) {
          try {
            await entrarConToken(idToken)
            return
          } catch (err) {
            if (!cancelado) setError(err.response?.data?.message || 'No se pudo iniciar sesión con Microsoft.')
          }
        }
      }
      if (!cancelado) setIngresoAutomatico(false)
    }
    iniciar()
    return () => { cancelado = true }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await loginApi({ username, password })
      loginUser(data.token, data)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.')
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoft = async () => {
    setError('')
    setLoadingMs(true)
    try {
      const idToken = await obtenerIdTokenMicrosoft(msConfig)
      if (!idToken) return
      await entrarConToken(idToken)
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo iniciar sesión con Microsoft.')
    } finally {
      setLoadingMs(false)
    }
  }

  // Con Microsoft habilitado y OcultarLoginLocal, el formulario local queda detrás de un enlace (respaldo)
  const formularioLocalVisible = !msConfig || !msConfig.ocultarLoginLocal || mostrarLoginLocal

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">📧</div>
          <h1 className="login-title">Email Masivo</h1>
          <div className="login-sub">Inicia sesión para continuar</div>
        </div>

        {ingresoAutomatico ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <span className="spinner"></span>
            <div className="text-muted mt-4">Iniciando sesión con tu cuenta de Microsoft…</div>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            {DEMO && <div className="alert alert-info" style={{ display: 'block' }}>Modo demo: entra con <strong>demo</strong> / <strong>demo</strong> (o cualquier contraseña). Los datos son ficticios.</div>}

            {msConfig && (
              <button type="button" className="btn btn-microsoft" onClick={handleMicrosoft} disabled={loadingMs || loading}>
                {loadingMs ? <span className="spinner"></span> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Ingresar con Microsoft
                  </>
                )}
              </button>
            )}

            {msConfig && !formularioLocalVisible && (
              <div className="mt-4" style={{ textAlign: 'center' }}>
                <a href="#" className="text-muted" onClick={e => { e.preventDefault(); setMostrarLoginLocal(true) }}>
                  Ingresar con usuario del sistema
                </a>
              </div>
            )}

            {formularioLocalVisible && (
              <>
                {msConfig && <div className="login-divider">o con usuario del sistema</div>}
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Usuario</label>
                    <input
                      type="text"
                      className="form-input"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Ej: admin"
                      required
                    />
                  </div>
                  <div className="form-group mb-6">
                    <label className="form-label">Contraseña</label>
                    <input
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }} disabled={loading || loadingMs}>
                    {loading ? <span className="spinner"></span> : 'Ingresar al sistema'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
