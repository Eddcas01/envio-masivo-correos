import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getProgreso, getEstado, iniciarEnvio, getEnviosPendientes, eliminarEnvio } from '../api/api'
import { useAuth, PERMISOS } from '../context/AuthContext'

const fmtFecha = (f) => f ? new Date(f).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : ''

export default function Envio() {
  const { hasPermission } = useAuth()
  const puedeEjecutar = hasPermission(PERMISOS.ENVIO_EJECUTAR)
  const puedeEliminar = hasPermission(PERMISOS.DESTINATARIOS_EDITAR)
  const [lotes, setLotes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [estado, setEstado] = useState({ enProceso: false })
  const [progreso, setProgreso] = useState(null)
  // Muestra el resultado del último envío iniciado desde esta pantalla
  const [verResultado, setVerResultado] = useState(false)
  const [enviando, setEnviando] = useState(null)
  // Envío recién creado desde el asistente de Destinatarios
  const location = useLocation()
  const [creado, setCreado] = useState(() => location.state?.creado || null)

  const fetchStatus = async () => {
    try {
      const [resEstado, resLotes] = await Promise.all([getEstado(), getEnviosPendientes()])
      setEstado(resEstado.data)
      setLotes(resLotes.data)

      if (resEstado.data.enProceso || verResultado) {
        const resProgreso = await getProgreso()
        setProgreso(resProgreso.data)
      }
    } catch (err) { console.error(err) }
    finally { setCargando(false) }
  }

  useEffect(() => {
    fetchStatus()
    let interval
    if (estado.enProceso) {
      interval = setInterval(fetchStatus, 2000)
    }
    return () => clearInterval(interval)
  }, [estado.enProceso])

  const handleEnviar = async (lote) => {
    const nombre = lote.nombre ? ` "${lote.nombre}"` : ''
    if (!confirm(`¿Enviar el envío #${lote.id}${nombre} a ${lote.total} destinatario(s)?`)) return

    setEnviando(lote.id)
    try {
      await iniciarEnvio(lote.id)
      setVerResultado(true)
      setProgreso(null)
      setEstado({ enProceso: true })
    } catch (err) {
      alert(err.response?.data?.message || 'Error al iniciar el envío')
      fetchStatus()
    } finally {
      setEnviando(null)
    }
  }

  const handleEliminar = async (lote) => {
    if (!confirm(`¿Eliminar el envío #${lote.id}? Se eliminan sus ${lote.total} destinatario(s) y sus archivos. No se puede deshacer.`)) return
    try {
      await eliminarEnvio(lote.id)
      fetchStatus()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el envío')
    }
  }

  const p = progreso

  return (
    <>
      {estado.enProceso && p && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="card-title mb-0">
              Enviando{p.bloqueId ? <> envío <Link to={`/bloques?id=${p.bloqueId}`}>#{p.bloqueId}</Link></> : ''}...
            </h3>
            <div className="text-primary font-bold">{p.porcentaje}%</div>
          </div>
          <div className="form-hint mb-2">
            Para agregar empleados a este envío mientras está en curso, ábrelo en <Link to={`/bloques?id=${p.bloqueId}`}>Historial de Envíos</Link>.
            Los demás envíos pendientes se pueden enviar cuando este termine.
          </div>
          <div className="progress-wrap mb-4">
            <div className="progress-bar progress-bar-accent" style={{ width: `${p.porcentaje}%` }}></div>
          </div>

          <div className="grid-3">
            <div className="card" style={{ padding: '12px' }}>
              <div className="stat-label">Enviados</div>
              <div className="text-primary font-bold text-lg">{p.enviados}</div>
            </div>
            <div className="card" style={{ padding: '12px' }}>
              <div className="stat-label">Errores</div>
              <div className="text-danger font-bold text-lg">{p.errores}</div>
            </div>
            <div className="card" style={{ padding: '12px' }}>
              <div className="stat-label">Restantes</div>
              <div className="text-warning font-bold text-lg">{p.pendientes}</div>
            </div>
          </div>
        </div>
      )}

      {creado && (
        <div className={`alert ${creado.errores?.length ? 'alert-info' : 'alert-success'} mb-6`} style={{ display: 'block' }}>
          <div className="flex justify-between items-center">
            <div>
              <strong>Lote creado:</strong> envío <Link to={`/bloques?id=${creado.id}`}>#{creado.id}</Link>
              {creado.nombre ? ` "${creado.nombre}"` : ''} con {creado.cargados} destinatario(s). Queda pendiente: revísalo y usa ▶ Enviar.
              {creado.errores?.length > 0 && ` ${creado.errores.length} no se cargaron:`}
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setCreado(null)}>Ocultar</button>
          </div>
          {creado.errores?.length > 0 && (
            <div className="table-wrapper mt-2" style={{ maxHeight: '160px', overflowY: 'auto' }}>
              <table className="table-sm">
                <tbody>
                  {creado.errores.map((e, i) => (
                    <tr key={i}><td>{e.codEmpleado ?? e.archivo}</td><td>{e.mensaje}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {verResultado && !estado.enProceso && p && p.completado && (
        <div className={`alert ${p.errores > 0 ? 'alert-error' : 'alert-success'} mb-6 flex justify-between items-center`}>
          <div>
            <strong>{p.errores > 0 ? 'Envío terminado con errores.' : '¡Envío completado!'}</strong> Se enviaron {p.enviados} correos correctamente y hubo {p.errores} error(es).
            {p.bloqueId && <> <Link to={`/bloques?id=${p.bloqueId}`}>Ver detalle del envío #{p.bloqueId}</Link></>}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setVerResultado(false)}>Ocultar</button>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="card-title mb-0">Envíos pendientes</h3>
          <Link to="/cargas" className="btn btn-sm btn-ghost">+ Preparar otro envío en Destinatarios</Link>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Nombre</th>
                <th>Creado</th>
                <th>Destinatarios</th>
                <th>Plantillas</th>
                <th>PDF dinámico</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan="7" className="text-center p-6 text-muted">Cargando...</td></tr>
              ) : lotes.length === 0 ? (
                <tr><td colSpan="7" className="text-center p-6 text-muted">
                  No hay envíos pendientes. Carga destinatarios en <Link to="/cargas">Destinatarios</Link> y usa <strong>Crear envío</strong>.
                </td></tr>
              ) : lotes.map(l => (
                <tr key={l.id}>
                  <td><Link to={`/bloques?id=${l.id}`}>#{l.id}</Link></td>
                  <td className="text-primary">{l.nombre || <span className="text-muted">Sin nombre</span>}</td>
                  <td>
                    {fmtFecha(l.fechaCreacion)}
                    <div className="text-muted" style={{ fontSize: '12px' }}>{l.usuarioCrea}</div>
                  </td>
                  <td>{l.total}</td>
                  <td>{l.plantillas.length ? l.plantillas.join(', ') : <span className="text-muted">—</span>}</td>
                  <td>{l.urlPdf ? <span className="badge badge-info">Sí</span> : <span className="text-muted">No</span>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {puedeEjecutar && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleEnviar(l)}
                        disabled={estado.enProceso || enviando !== null || l.total === 0}
                        title={estado.enProceso ? 'Hay un envío en curso; espera a que termine' : l.total === 0 ? 'El envío no tiene destinatarios' : ''}>
                        {enviando === l.id ? 'Iniciando...' : '▶ Enviar'}
                      </button>
                    )}
                    <Link to={`/bloques?id=${l.id}`} className="btn btn-sm btn-ghost ml-2">Ver detalle</Link>
                    {puedeEliminar && (
                      <button className="btn btn-sm btn-ghost ml-2" style={{ color: 'var(--danger)' }}
                        onClick={() => handleEliminar(l)} title="Eliminar envío">🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!puedeEjecutar && lotes.length > 0 && (
          <div className="form-hint mt-2">Tu rol no permite enviar.</div>
        )}
      </div>

      {p && p.log && p.log.length > 0 && (estado.enProceso || verResultado) && (
        <div className="card">
          <h4 className="form-label mb-2">Registro de Actividad en Vivo</h4>
          <div className="log-panel">
            {[...p.log].reverse().map((l, i) => (
              <div key={i} className="log-item">
                <span className="log-time">[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                <span className={`log-icon ${l.exitoso ? 'log-ok' : 'log-err'}`}>{l.exitoso ? '✓' : '✗'}</span>
                <span className="log-text">
                  {l.correo} {l.exitoso ? 'enviado' : `falló: ${l.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
