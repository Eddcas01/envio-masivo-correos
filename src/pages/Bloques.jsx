import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getBloques, getBloque, reenviarBloque, agregarAlBloque, iniciarEnvio, eliminarEnvio, quitarDelEnvio } from '../api/api'
import { useAuth, PERMISOS } from '../context/AuthContext'

const fmtFecha = (f) => f ? new Date(f).toLocaleString() : '—'

const duracion = (inicio, fin) => {
  if (!inicio || !fin) return '—'
  const seg = Math.round((new Date(fin) - new Date(inicio)) / 1000)
  if (seg < 60) return `${seg} s`
  const min = Math.floor(seg / 60)
  return min < 60 ? `${min} min ${seg % 60} s` : `${Math.floor(min / 60)} h ${min % 60} min`
}

// Estados del catálogo estados_envio
const EN_CURSO = 'En curso'
const PENDIENTE = 'Pendiente'
const badgeEstado = (estado) => {
  if (estado === 'Completado') return 'badge badge-success'
  if (estado === 'Con error') return 'badge badge-danger'
  if (estado === PENDIENTE) return 'badge badge-info'
  return 'badge badge-warning'
}

const parseCodigos = (texto) => [...new Set(texto.split(/[\s,]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n)))]

export default function Bloques() {
  const { hasPermission } = useAuth()
  const puedeReenviar = hasPermission(PERMISOS.ENVIO_EJECUTAR)
  const puedeEliminar = hasPermission(PERMISOS.DESTINATARIOS_EDITAR)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reenviando, setReenviando] = useState(false)

  // Agregar empleados al envío en curso
  const [codigosAgregar, setCodigosAgregar] = useState('')
  const [plantillaAgregar, setPlantillaAgregar] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [resultadoAgregar, setResultadoAgregar] = useState(null)
  const [bloques, setBloques] = useState([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [codigoEnvio, setCodigoEnvio] = useState('')

  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [filtroResultado, setFiltroResultado] = useState('') // '', 'ok', 'error'
  const [busqueda, setBusqueda] = useState('')

  const fetchBloques = async (d = desde, h = hasta) => {
    setLoading(true)
    try {
      const { data } = await getBloques({ desde: d || undefined, hasta: h || undefined })
      setBloques(data)
    } catch (err) { alert(err.response?.data?.message || 'Error al cargar el historial') }
    finally { setLoading(false) }
  }

  const abrirBloque = async (id) => {
    setCargandoDetalle(true)
    setFiltroResultado('')
    setBusqueda('')
    setResultadoAgregar(null)
    setCodigosAgregar('')
    setPlantillaAgregar('')
    try {
      const { data } = await getBloque(id)
      setDetalle(data)
      setSearchParams({ id: String(id) }, { replace: true })
    } catch (err) { alert(err.response?.data?.message || 'Error al cargar el detalle del bloque') }
    finally { setCargandoDetalle(false) }
  }

  // Mientras el envío está en curso, refrescar su detalle y la lista sin perder filtros
  useEffect(() => {
    if (!detalle || detalle.estado !== EN_CURSO) return
    const id = detalle.id
    const timer = setInterval(async () => {
      try {
        const { data } = await getBloque(id)
        setDetalle(actual => (actual?.id === id ? data : actual))
        if (data.estado !== EN_CURSO) fetchBloques()
      } catch { /* se reintenta en el siguiente ciclo */ }
    }, 3000)
    return () => clearInterval(timer)
  }, [detalle?.id, detalle?.estado])

  const agregarEmpleados = async () => {
    const codigos = parseCodigos(codigosAgregar)
    if (codigos.length === 0) return alert('Escribe al menos un código de empleado')
    const plantillas = detalle.plantillasEnvio || []
    if (plantillas.length > 1 && !plantillaAgregar) return alert('Selecciona la plantilla del envío')
    setAgregando(true)
    try {
      const { data } = await agregarAlBloque(detalle.id, {
        codigosEmpleado: codigos,
        plantillaId: plantillaAgregar ? parseInt(plantillaAgregar) : undefined,
      })
      setResultadoAgregar(data)
      if (data.agregados > 0) {
        setCodigosAgregar('')
        if (detalle.estado === PENDIENTE) recargarDetalle()
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al agregar empleados')
    } finally { setAgregando(false) }
  }

  // Refresca el detalle abierto (y la lista) sin perder lo que se está mostrando
  const recargarDetalle = async () => {
    try {
      const { data } = await getBloque(detalle.id)
      setDetalle(data)
      fetchBloques()
    } catch (err) { alert(err.response?.data?.message || 'Error al cargar el detalle del envío') }
  }

  // Envío pendiente: quitar un empleado
  const quitarDestinatario = async (d) => {
    if (!confirm(`¿Quitar a ${d.nombre || d.correo} de este envío?`)) return
    try {
      await quitarDelEnvio(detalle.id, d.correlativo)
      recargarDetalle()
    } catch (err) { alert(err.response?.data?.message || 'Error al quitar el empleado') }
  }

  // Envío pendiente: enviarlo
  const enviarPendiente = async () => {
    const nombre = detalle.nombre ? ` "${detalle.nombre}"` : ''
    if (!confirm(`¿Enviar el envío #${detalle.id}${nombre} a ${detalle.total} destinatario(s)?`)) return
    try {
      await iniciarEnvio(detalle.id)
      navigate('/envio')
    } catch (err) { alert(err.response?.data?.message || 'Error al iniciar el envío') }
  }

  // Envío pendiente: eliminarlo con sus destinatarios
  const eliminarPendiente = async () => {
    if (!confirm(`¿Eliminar el envío #${detalle.id}? Se eliminan sus ${detalle.total} destinatario(s) y sus archivos. No se puede deshacer.`)) return
    try {
      await eliminarEnvio(detalle.id)
      cerrarDetalle()
      fetchBloques()
    } catch (err) { alert(err.response?.data?.message || 'Error al eliminar el envío') }
  }

  const cerrarDetalle = () => {
    setDetalle(null)
    setSearchParams({}, { replace: true })
  }

  useEffect(() => {
    fetchBloques()
    const id = searchParams.get('id')
    if (id) abrirBloque(id)
  }, [])

  const limpiarFiltros = () => {
    setDesde('')
    setHasta('')
    setCodigoEnvio('')
    fetchBloques('', '')
  }

  // Busca un bloque por su código de envío (número de bloque) y abre su detalle
  const buscar = async () => {
    const id = parseInt(codigoEnvio.trim())
    if (!codigoEnvio.trim()) return fetchBloques()
    if (isNaN(id)) return alert('El código de envío debe ser un número')
    setLoading(true)
    try {
      const { data } = await getBloque(id)
      const { detalles, destinatarios, ...encabezado } = data
      setBloques([{ ...encabezado, plantillas: [...new Set([...detalles, ...(destinatarios || [])].map(d => d.plantillaNombre).filter(Boolean))] }])
      abrirBloque(id)
    } catch (err) {
      setBloques([])
      setDetalle(null)
      if (err.response?.status !== 404) alert(err.response?.data?.message || 'Error al buscar el envío')
    } finally { setLoading(false) }
  }

  // Reenvía los correos indicados (o, sin ids, todos los que fallaron) como un bloque nuevo
  const reenviar = async (detalleIds, descripcion) => {
    if (!confirm(`¿Reenviar ${descripcion}? Se usará el correo actual del empleado y se registrará como un envío nuevo.`)) return
    setReenviando(true)
    try {
      const { data } = await reenviarBloque(detalle.id, detalleIds)
      const omitidos = data.omitidos?.length
        ? `\n\nNo se reenviaron ${data.omitidos.length}:\n` + data.omitidos.map(o => `• ${o.nombre}: ${o.motivo}`).join('\n')
        : ''
      alert(`${data.message}. Puedes ver el avance en Envíos o en este historial.${omitidos}`)
      fetchBloques()
    } catch (err) {
      const omitidos = err.response?.data?.omitidos?.map(o => `• ${o.nombre}: ${o.motivo}`).join('\n')
      alert((err.response?.data?.message || 'Error al reenviar') + (omitidos ? `\n\n${omitidos}` : ''))
    } finally { setReenviando(false) }
  }

  const detallesFiltrados = useMemo(() => {
    if (!detalle) return []
    const q = busqueda.trim().toLowerCase()
    return detalle.detalles.filter(d =>
      (filtroResultado === '' || (filtroResultado === 'ok' ? d.exitoso : !d.exitoso)) &&
      (!q || [d.codEmpleado, d.nombre, d.correo, d.plantillaNombre].some(v => String(v ?? '').toLowerCase().includes(q)))
    )
  }, [detalle, filtroResultado, busqueda])

  const destinatariosFiltrados = useMemo(() => {
    if (!detalle?.destinatarios) return []
    const q = busqueda.trim().toLowerCase()
    return detalle.destinatarios.filter(d =>
      !q || [d.codEmpleado, d.nombre, d.correo, d.plantillaNombre].some(v => String(v ?? '').toLowerCase().includes(q)))
  }, [detalle, busqueda])

  return (
    <>
      <div className="card mb-6">
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="form-group mb-0">
            <label className="form-label">Código de envío</label>
            <input className="form-input" inputMode="numeric" placeholder="Ej: 15" style={{ width: '140px' }}
                   value={codigoEnvio} onChange={e => setCodigoEnvio(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') buscar() }} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Desde</label>
            <input type="date" className="form-input" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Hasta</label>
            <input type="date" className="form-input" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="flex gap-2" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={buscar}>Buscar</button>
            <button className="btn btn-ghost" onClick={limpiarFiltros}>Limpiar filtros</button>
          </div>
        </div>
      </div>

      <div className="card mb-6" style={{ padding: 0 }}>
        {loading ? <div className="p-6">Cargando...</div> :
         bloques.length === 0 ? <div className="empty-state">{codigoEnvio.trim() ? `No existe el envío #${codigoEnvio.trim()}.` : 'No hay bloques de envío en el rango seleccionado.'}</div> : (
          <div className="table-wrapper" style={{ border: 'none', maxHeight: '360px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Inicio</th>
                  <th>Duración</th>
                  <th>Usuario</th>
                  <th>Plantillas</th>
                  <th>Total</th>
                  <th>Enviados</th>
                  <th>Errores</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {bloques.map(b => (
                  <tr key={b.id} onClick={() => abrirBloque(b.id)}
                      style={{ cursor: 'pointer', background: detalle?.id === b.id ? 'var(--accent-light)' : undefined }}>
                    <td className="text-primary">
                      #{b.id}
                      {b.nombre && <div style={{ fontSize: '12px' }}>{b.nombre}</div>}
                      {b.bloqueOrigenId && <div className="text-muted">Reenvío de #{b.bloqueOrigenId}</div>}
                    </td>
                    <td>
                      {b.fechaInicio ? fmtFecha(b.fechaInicio) : <span className="text-muted">Sin enviar</span>}
                      {!b.fechaInicio && <div className="text-muted" style={{ fontSize: '12px' }}>Creado {fmtFecha(b.fechaCreacion)}</div>}
                    </td>
                    <td>{duracion(b.fechaInicio, b.fechaFin)}</td>
                    <td>{b.usuario}</td>
                    <td>{b.plantillas.join(', ') || '—'}</td>
                    <td>{b.total}</td>
                    <td style={{ color: 'var(--success)' }}>{b.enviados}</td>
                    <td style={{ color: b.errores > 0 ? 'var(--danger)' : undefined }}>{b.errores}</td>
                    <td><span className={badgeEstado(b.estado)}>{b.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cargandoDetalle && <div className="card p-6">Cargando detalle...</div>}

      {detalle && !cargandoDetalle && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="card-title mb-0">
                Detalle del envío #{detalle.id}{detalle.nombre ? ` · ${detalle.nombre}` : ''}{' '}
                <span className={badgeEstado(detalle.estado)}>{detalle.estado}</span>
              </h3>
              {detalle.bloqueOrigenId && (
                <a href="#" className="text-muted" onClick={e => { e.preventDefault(); abrirBloque(detalle.bloqueOrigenId) }}>
                  Reenvío del bloque #{detalle.bloqueOrigenId}
                </a>
              )}
            </div>
            <div className="flex gap-2">
              {detalle.estado === PENDIENTE && puedeReenviar && (
                <button className="btn btn-sm btn-primary" onClick={enviarPendiente} disabled={detalle.total === 0}>▶ Enviar</button>
              )}
              {detalle.estado === PENDIENTE && puedeEliminar && (
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={eliminarPendiente}>🗑 Eliminar envío</button>
              )}
              {puedeReenviar && detalle.estado !== EN_CURSO && detalle.detalles.some(d => !d.exitoso) && (
                <button className="btn btn-sm btn-primary" disabled={reenviando}
                        onClick={() => reenviar(null, `los ${detalle.detalles.filter(d => !d.exitoso).length} correos que fallaron`)}>
                  ↻ Reenviar fallidos ({detalle.detalles.filter(d => !d.exitoso).length})
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={cerrarDetalle}>Cerrar</button>
            </div>
          </div>

          <div className="stat-grid">
            {detalle.estado === PENDIENTE ? (
              <div className="stat-card">
                <div className="stat-label">Creado · {detalle.usuarioCrea || detalle.usuario}</div>
                <div style={{ fontWeight: 600 }}>{fmtFecha(detalle.fechaCreacion)}</div>
                <div className="text-muted">PDF dinámico: {detalle.urlPdf ? 'Sí' : 'No'}</div>
              </div>
            ) : (
              <div className="stat-card">
                <div className="stat-label">Inicio · {detalle.usuario}</div>
                <div style={{ fontWeight: 600 }}>{fmtFecha(detalle.fechaInicio)}</div>
                <div className="text-muted">Fin: {fmtFecha(detalle.fechaFin)}</div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{detalle.total}</div>
            </div>
            <div className="stat-card success">
              <div className="stat-label">Enviados</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{detalle.enviados}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Errores</div>
              <div className="stat-value" style={{ color: detalle.errores > 0 ? 'var(--danger)' : undefined }}>{detalle.errores}</div>
            </div>
          </div>

          {puedeReenviar && (detalle.estado === EN_CURSO || detalle.estado === PENDIENTE) && (detalle.plantillasEnvio || []).length > 0 && (
            <div className="card mb-4" style={{ borderLeft: `4px solid ${detalle.estado === PENDIENTE ? 'var(--info)' : 'var(--warning)'}` }}>
              <h4 className="card-title mb-2">Agregar empleados a este envío</h4>
              <p className="text-muted mb-4">
                {detalle.estado === PENDIENTE ? 'Quedan incluidos en este envío' : 'Se envían en este mismo bloque'} con su configuración
                {detalle.urlPdf ? ', incluido el PDF dinámico del envío' : ''}. No se repiten empleados ya incluidos con la misma plantilla.
              </p>
              <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group mb-0" style={{ flex: '1 1 260px' }}>
                  <label className="form-label">Códigos de empleado (separados por coma, espacio o salto de línea)</label>
                  <textarea className="form-textarea" style={{ minHeight: '60px' }} placeholder="10293, 10294"
                            value={codigosAgregar} onChange={e => setCodigosAgregar(e.target.value)} />
                </div>
                {(detalle.plantillasEnvio || []).length > 1 && (
                  <div className="form-group mb-0" style={{ flex: '0 1 240px' }}>
                    <label className="form-label">Plantilla del envío</label>
                    <select className="form-select" value={plantillaAgregar} onChange={e => setPlantillaAgregar(e.target.value)}>
                      <option value="">Selecciona...</option>
                      {detalle.plantillasEnvio.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                )}
                <button className="btn btn-primary" onClick={agregarEmpleados} disabled={agregando}>
                  {agregando ? <span className="spinner"></span> : '+ Agregar al envío'}
                </button>
              </div>
              {(detalle.plantillasEnvio || []).length === 1 && (
                <div className="form-hint mt-2">Plantilla: {detalle.plantillasEnvio[0].nombre}</div>
              )}
              {resultadoAgregar && (
                <div className="mt-4">
                  <div className="form-hint mb-2">
                    {resultadoAgregar.agregados} agregado(s){resultadoAgregar.errores > 0 ? `, ${resultadoAgregar.errores} no agregado(s)` : ''}.
                  </div>
                  <div className="table-wrapper" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    <table className="table-sm">
                      <tbody>
                        {resultadoAgregar.resultados.map((r, i) => (
                          <tr key={i}>
                            <td>{r.codEmpleado}</td>
                            <td style={{ color: r.exitoso ? 'var(--success)' : 'var(--danger)' }}>{r.mensaje}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {detalle.estado === PENDIENTE ? (
            <>
              <div className="flex justify-between items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
                <h4 className="card-title mb-0">Destinatarios del envío ({detalle.destinatarios.length})</h4>
                <input className="form-input" style={{ maxWidth: '320px' }} placeholder="Buscar por código, nombre, correo o plantilla"
                       value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              </div>
              <div className="table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Empleado</th>
                      <th>Correo</th>
                      <th>Plantilla</th>
                      <th>Adjunto</th>
                      {puedeReenviar && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {destinatariosFiltrados.length === 0 ? (
                      <tr><td colSpan={puedeReenviar ? 6 : 5} className="text-center p-6 text-muted">Sin destinatarios</td></tr>
                    ) : destinatariosFiltrados.map(d => (
                      <tr key={d.correlativo}>
                        <td>{d.correlativo}</td>
                        <td className="text-primary">
                          {d.nombre} <span className="text-muted">({d.codEmpleado ?? '—'})</span>
                          {!d.habilitado && <span className="badge badge-warning ml-2">Deshabilitado</span>}
                        </td>
                        <td>{d.correo}</td>
                        <td>{d.plantillaNombre || '—'}</td>
                        <td>{d.adjunto || '—'}</td>
                        {puedeReenviar && (
                          <td>
                            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} title="Quitar del envío"
                                    onClick={() => quitarDestinatario(d)}>
                              × Quitar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (<>
          <div className="flex justify-between items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
            <div className="tabs mb-0">
              <div className={`tab ${filtroResultado === '' ? 'active' : ''}`} onClick={() => setFiltroResultado('')}>Todos ({detalle.detalles.length})</div>
              <div className={`tab ${filtroResultado === 'ok' ? 'active' : ''}`} onClick={() => setFiltroResultado('ok')}>Enviados</div>
              <div className={`tab ${filtroResultado === 'error' ? 'active' : ''}`} onClick={() => setFiltroResultado('error')}>Con error</div>
            </div>
            <input className="form-input" style={{ maxWidth: '320px' }} placeholder="Buscar por código, nombre, correo o plantilla"
                   value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>

          <div className="table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Empleado</th>
                  <th>Correo</th>
                  <th>Plantilla / Asunto</th>
                  <th>Adjunto</th>
                  <th>Resultado</th>
                  <th>Hora</th>
                  {puedeReenviar && <th></th>}
                </tr>
              </thead>
              <tbody>
                {detallesFiltrados.length === 0 ? (
                  <tr><td colSpan={puedeReenviar ? 8 : 7} className="text-center p-6 text-muted">Sin registros</td></tr>
                ) : detallesFiltrados.map(d => (
                  <tr key={d.id}>
                    <td>{d.correlativo || '—'}</td>
                    <td className="text-primary">{d.nombre} <span className="text-muted">({d.codEmpleado ?? '—'})</span></td>
                    <td>{d.correo}</td>
                    <td>
                      <div>{d.plantillaNombre || '—'}</div>
                      {d.asunto && <div className="text-muted">{d.asunto}</div>}
                    </td>
                    <td>{d.adjunto || '—'}</td>
                    <td>
                      {d.exitoso
                        ? <span className="badge badge-success">Enviado</span>
                        : <span className="badge badge-danger" title={d.error}>Error</span>}
                      {!d.exitoso && d.error && <div className="text-muted" style={{ maxWidth: '280px' }}>{d.error}</div>}
                    </td>
                    <td>{new Date(d.fecha).toLocaleTimeString()}</td>
                    {puedeReenviar && (
                      <td>
                        <button className="btn btn-sm btn-ghost" title="Reenviar este correo"
                                disabled={reenviando || detalle.estado === EN_CURSO}
                                onClick={() => reenviar([d.id], `el correo a ${d.nombre || d.correo}`)}>
                          ↻ Reenviar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>)}
        </div>
      )}
    </>
  )
}
