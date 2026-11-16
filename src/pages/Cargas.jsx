import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCargas, getResumen, getPlantillas, getPdfUrls, cargarPorCodigos, procesarArchivos, subirArchivos, limpiarTemporales, toggleHabilitado, deleteCarga, deleteAllCargas, deleteEnviadosCargas, getEmpresas, getEmpleadosActivos, crearEnvio, eliminarEnvio } from '../api/api'
import { useAuth, PERMISOS } from '../context/AuthContext'

const parseCodigos = (texto) => [...new Set(texto.split(/[\s,]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n)))]

// Tamaño máximo por petición al subir archivos. IIS rechaza por defecto peticiones de más de ~28.6 MB
// (requestLimits/maxAllowedContentLength) y la API acepta hasta 50 MB: se suben en grupos más pequeños.
const MAX_MB_POR_SUBIDA = 25
const MAX_BYTES_POR_SUBIDA = MAX_MB_POR_SUBIDA * 1024 * 1024

const agruparArchivos = (archivos) => {
  const grupos = []
  let actual = [], tamano = 0
  for (const f of archivos) {
    if (actual.length > 0 && tamano + f.size > MAX_BYTES_POR_SUBIDA) {
      grupos.push(actual)
      actual = []
      tamano = 0
    }
    actual.push(f)
    tamano += f.size
  }
  if (actual.length > 0) grupos.push(actual)
  return grupos
}

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function Cargas() {
  const { hasPermission } = useAuth()
  const puedeEditar = hasPermission(PERMISOS.DESTINATARIOS_EDITAR)
  const navigate = useNavigate()

  const [cargas, setCargas] = useState([])
  const [resumen, setResumen] = useState(null)
  const [plantillas, setPlantillas] = useState([])
  const [pdfUrls, setPdfUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('') // '', 'pendiente', 'enviado'

  // Asistente: 1 = cuerpo del correo, 2 = archivos
  const [paso, setPaso] = useState(1)

  // Paso 1: cuerpo del correo
  const [nombreEnvio, setNombreEnvio] = useState('')
  const [plantillaId, setPlantillaId] = useState('')
  const [codigos, setCodigos] = useState('')
  const [empresas, setEmpresas] = useState([])
  const [empresaSel, setEmpresaSel] = useState('')
  const [cargandoActivos, setCargandoActivos] = useState(false)
  const [infoActivos, setInfoActivos] = useState('')

  // Búsqueda dentro de la caja de códigos
  const codigosRef = useRef(null)
  const resaltadoRef = useRef(null)
  const [codigoBuscado, setCodigoBuscado] = useState('')

  // Paso 2: archivos ('ninguno' | 'dinamico' | 'archivos')
  const [modoAdjunto, setModoAdjunto] = useState('ninguno')
  const [urlPdf, setUrlPdf] = useState(() => localStorage.getItem('urlPdf') || '')
  const [tipoId, setTipoId] = useState('cod_empleado')
  const [archivos, setArchivos] = useState([])
  const [arrastrando, setArrastrando] = useState(false)

  // Creación del envío
  const [creando, setCreando] = useState(false)
  const [avance, setAvance] = useState('')
  const [noCargados, setNoCargados] = useState([])

  useEffect(() => {
    localStorage.setItem('urlPdf', urlPdf)
  }, [urlPdf])

  const fetchData = async (estado = filtroEstado) => {
    setLoading(true)
    try {
      const sinDatos = { data: [] }
      const [resCargas, resResumen, resPlantillas, resPdfUrls] = await Promise.all([
        getCargas(estado), getResumen(),
        getPlantillas().catch(() => sinDatos), getPdfUrls().catch(() => sinDatos)
      ])
      setCargas(resCargas.data)
      setResumen(resResumen.data)
      setPlantillas(resPlantillas.data)
      setPdfUrls(resPdfUrls.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (!puedeEditar) return
    getEmpresas().then(res => setEmpresas(res.data)).catch(err => console.error(err))
  }, [puedeEditar])

  const listaCodigos = useMemo(() => parseCodigos(codigos), [codigos])

  const handleAgregarActivos = async () => {
    setCargandoActivos(true)
    setInfoActivos('')
    try {
      const { data } = await getEmpleadosActivos(empresaSel)
      const nuevos = data.empleados.map(e => e.codEmpleado).filter(c => !listaCodigos.includes(c))
      setCodigos([...listaCodigos, ...nuevos].join('\n'))

      const empresa = empresas.find(e => String(e.ciaCodigo) === String(empresaSel))
      setInfoActivos(
        `Se agregaron ${nuevos.length} colaboradores activos${empresa ? ` de ${empresa.descripcion}` : ''}.` +
        (data.sinCorreo > 0 ? ` ${data.sinCorreo} no tienen correo interno y se omitirán al crear el envío.` : '')
      )
    } catch (err) {
      alert(err.response?.data?.message || 'Error al consultar empleados activos')
    } finally {
      setCargandoActivos(false)
    }
  }

  // Búsqueda mientras se escribe: código exacto y códigos que empiezan con lo escrito
  const busqueda = useMemo(() => {
    const texto = codigoBuscado.trim()
    if (!/^\d+$/.test(texto)) return null
    const buscado = parseInt(texto)
    const indice = listaCodigos.indexOf(buscado)
    return {
      texto,
      total: listaCodigos.length,
      exacto: indice >= 0 ? { codigo: buscado, posicion: indice + 1 } : null,
      coincidencias: listaCodigos.filter(c => String(c).startsWith(texto)),
    }
  }, [codigoBuscado, listaCodigos])

  // Capa detrás de la caja con las coincidencias resaltadas (la caja tiene fondo transparente)
  const resaltado = useMemo(() => {
    if (!busqueda) return codigos
    return codigos.split(/(\d+)/).map((parte, i) => {
      if (i % 2 === 0 || !parte.startsWith(busqueda.texto)) return parte
      const exacto = parseInt(parte) === parseInt(busqueda.texto)
      return <mark key={i} className={exacto ? 'exacto' : undefined}>{parte}</mark>
    })
  }, [codigos, busqueda])

  // Al escribir, desplazar la caja hasta la coincidencia (sin quitar el foco del buscador)
  useEffect(() => {
    const capa = resaltadoRef.current
    const caja = codigosRef.current
    if (!busqueda || !capa || !caja) return
    const marca = capa.querySelector('mark.exacto') || capa.querySelector('mark')
    if (!marca) return
    caja.scrollTop = Math.max(0, marca.offsetTop - caja.clientHeight / 2 + marca.offsetHeight / 2)
    capa.scrollTop = caja.scrollTop
  }, [busqueda])

  // Enter: selecciona el código exacto dentro de la caja
  const ubicarCodigo = () => {
    if (!busqueda?.exacto || !codigosRef.current) return
    const match = new RegExp(`(^|[\\s,])(${busqueda.exacto.codigo})(?=$|[\\s,])`).exec(codigos)
    if (!match) return
    const inicio = match.index + match[1].length
    const textarea = codigosRef.current
    // El navegador no desplaza la caja hasta la selección: se mide la altura real del texto
    // que hay antes del código (dejando solo ese texto un instante) y se centra ahí
    const textoCompleto = textarea.value
    textarea.value = textoCompleto.slice(0, inicio)
    const altoHastaCodigo = textarea.scrollHeight
    textarea.value = textoCompleto
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(inicio, inicio + match[2].length)
    // scrollHeight nunca es menor que el alto visible: si el código ya cabe en la primera vista, ir al inicio
    textarea.scrollTop = altoHastaCodigo <= textarea.clientHeight ? 0 : altoHastaCodigo - textarea.clientHeight / 2
  }

  const limpiarCodigos = () => {
    if (codigos.trim() && !confirm('¿Limpiar todos los códigos de la caja?')) return
    setCodigos('')
    setCodigoBuscado('')
    setInfoActivos('')
  }

  // ─── Archivos PDF ───────────────────────────────────────────────────────────
  const agregarArchivos = (lista) => {
    const validos = Array.from(lista || []).filter(f => /\.(pdf|zip)$/i.test(f.name))
    const rechazados = Array.from(lista || []).length - validos.length
    const grandes = validos.filter(f => f.size > MAX_BYTES_POR_SUBIDA)
    if (rechazados > 0) alert(`${rechazados} archivo(s) ignorado(s): solo se aceptan PDF y ZIP.`)
    if (grandes.length > 0) {
      alert(`Estos archivos superan ${MAX_MB_POR_SUBIDA} MB y no se pueden subir:\n` +
        grandes.map(f => `• ${f.name} (${fmtMB(f.size)})`).join('\n') +
        '\n\nSi es un ZIP, divídelo en varios más pequeños.')
    }
    const aceptados = validos.filter(f => f.size <= MAX_BYTES_POR_SUBIDA)
    setArchivos(actuales => {
      const claves = new Set(actuales.map(f => `${f.name}|${f.size}`))
      return [...actuales, ...aceptados.filter(f => !claves.has(`${f.name}|${f.size}`))]
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setArrastrando(false)
    agregarArchivos(e.dataTransfer ? e.dataTransfer.files : e.target.files)
    if (e.target?.value) e.target.value = ''
  }

  const quitarArchivo = (indice) => setArchivos(actuales => actuales.filter((_, i) => i !== indice))
  const tamanoArchivos = archivos.reduce((t, f) => t + f.size, 0)

  const handleLimpiarTemporales = async () => {
    if (!confirm('¿Seguro que deseas eliminar todos los archivos temporales subidos al servidor? Los envíos pendientes que tengan adjuntos se quedarían sin ellos.')) return
    try {
      const res = await limpiarTemporales()
      alert(res.data.message || 'Archivos temporales eliminados')
    } catch (err) {
      alert('Error al limpiar archivos temporales')
    }
  }

  // ─── Validación del asistente ───────────────────────────────────────────────
  const paso1Valido = !!nombreEnvio.trim() && !!plantillaId
  const faltantes = []
  if (!nombreEnvio.trim()) faltantes.push('el nombre del envío')
  if (!plantillaId) faltantes.push('la plantilla')
  if (modoAdjunto !== 'archivos' && listaCodigos.length === 0) faltantes.push('los colaboradores')
  if (modoAdjunto === 'dinamico' && !urlPdf) faltantes.push('la URL del PDF dinámico')
  if (modoAdjunto === 'archivos' && archivos.length === 0) faltantes.push('los archivos PDF')
  const listoParaCrear = faltantes.length === 0

  const nombrePlantilla = plantillas.find(p => String(p.id) === String(plantillaId))?.nombre
  const nombrePdf = pdfUrls.find(u => u.url === urlPdf)?.nombre

  const reiniciarAsistente = () => {
    setNombreEnvio('')
    setCodigos('')
    setCodigoBuscado('')
    setInfoActivos('')
    setArchivos([])
    setModoAdjunto('ninguno')
    setPaso(1)
  }

  // ─── Crear el lote de envío ─────────────────────────────────────────────────
  const handleCrearLote = async () => {
    if (!listoParaCrear) return
    setCreando(true)
    setNoCargados([])
    let bloqueId = null
    try {
      setAvance('Creando el envío...')
      const { data: lote } = await crearEnvio({
        nombre: nombreEnvio.trim(),
        generarPdf: modoAdjunto === 'dinamico',
        urlPdf: modoAdjunto === 'dinamico' ? urlPdf : null,
        vacio: true,
      })
      bloqueId = lote.id

      let cargados = 0
      const errores = []

      if (modoAdjunto === 'archivos') {
        const grupos = agruparArchivos(archivos)
        for (let i = 0; i < grupos.length; i++) {
          setAvance(`Subiendo archivos (${i + 1} de ${grupos.length})...`)
          const formData = new FormData()
          grupos[i].forEach(f => formData.append('files', f))
          const { data: subida } = await subirArchivos(formData)
          subida.resultados.filter(r => !r.exitoso).forEach(r => errores.push({ archivo: r.nombre, mensaje: r.mensaje }))
          const rutas = subida.resultados.filter(r => r.exitoso).map(r => r.ruta)
          if (rutas.length === 0) continue

          setAvance(`Asociando archivos a colaboradores (${i + 1} de ${grupos.length})...`)
          const { data: proceso } = await procesarArchivos({
            rutasArchivos: rutas,
            tipoIdentificador: tipoId,
            plantillaId: parseInt(plantillaId),
            bloqueId,
            codigosPermitidos: listaCodigos.length > 0 ? listaCodigos : undefined,
          })
          cargados += proceso.cargados
          proceso.resultados.filter(r => !r.exitoso).forEach(r => errores.push(r))
        }
      } else {
        setAvance(modoAdjunto === 'dinamico'
          ? `Cargando ${listaCodigos.length} colaboradores y generando sus PDF...`
          : `Cargando ${listaCodigos.length} colaboradores...`)
        const { data } = await cargarPorCodigos({
          plantillaId: parseInt(plantillaId),
          codigosEmpleado: listaCodigos,
          generarPdf: modoAdjunto === 'dinamico',
          urlPdf: modoAdjunto === 'dinamico' ? urlPdf : null,
          bloqueId,
        })
        cargados = data.cargados
        data.resultados.filter(r => !r.exitoso).forEach(r => errores.push(r))
      }

      if (cargados === 0) {
        await eliminarEnvio(bloqueId).catch(() => {})
        setNoCargados(errores)
        alert('No se pudo cargar ningún destinatario, así que el envío no se creó. Revisa el detalle debajo del asistente.')
        return
      }

      reiniciarAsistente()
      navigate('/envio', { state: { creado: { id: bloqueId, nombre: lote.nombre, cargados, errores } } })
    } catch (err) {
      // Si falló a medias, se elimina el envío para no dejarlo incompleto
      if (bloqueId) await eliminarEnvio(bloqueId).catch(() => {})
      const status = err.response?.status
      alert(status === 413
        ? 'El servidor rechazó los archivos por tamaño. Intenta con menos archivos o ZIP más pequeños.'
        : (err.response?.data?.message || 'Error al crear el envío') + (bloqueId ? '. El envío no se creó.' : ''))
    } finally {
      setCreando(false)
      setAvance('')
    }
  }

  // ─── Cola (registros sueltos sin envío y enviados) ─────────────────────────
  const handleToggle = async (c) => {
    await toggleHabilitado(c.correlativo, !c.habilitado)
    fetchData()
  }

  const handleDelete = async (c) => {
    if (confirm('¿Eliminar registro?')) { await deleteCarga(c.correlativo); fetchData() }
  }

  const handleClear = async () => {
    if (confirm('¿Seguro que deseas limpiar TODOS los registros de la cola y sus archivos adjuntos? Los envíos ya creados no se tocan. Esto no se puede deshacer.')) {
      await deleteAllCargas(); fetchData()
    }
  }

  const handleClearEnviados = async () => {
    if (confirm('¿Seguro que deseas limpiar solo los registros YA ENVIADOS y sus archivos adjuntos?')) {
      await deleteEnviadosCargas(); fetchData()
    }
  }

  // Registros que quedaron en la cola sin envío (cargados con la versión anterior)
  const handlePasarColaAEnvio = async () => {
    const nombre = nombreEnvio.trim() || 'Registros de la cola'
    if (!confirm(`¿Crear el envío "${nombre}" con los ${resumen?.pendientes} registro(s) pendientes de la cola?`)) return
    try {
      const { data } = await crearEnvio({ nombre })
      navigate('/envio', { state: { creado: { id: data.id, nombre, cargados: data.total, errores: [] } } })
    } catch (err) {
      alert(err.response?.data?.message || 'Error al crear el envío')
    }
  }

  const handleCambiarFiltro = (nuevoEstado) => {
    setFiltroEstado(nuevoEstado)
    fetchData(nuevoEstado)
  }

  return (
    <>
      {puedeEditar && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="card-title mb-0">Nuevo envío</h3>
            {(nombreEnvio || codigos || archivos.length > 0) && !creando && (
              <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm('¿Descartar la configuración del envío?')) reiniciarAsistente() }}>
                Descartar
              </button>
            )}
          </div>

          <div className="tabs">
            <div className={`tab ${paso === 1 ? 'active' : ''}`} onClick={() => !creando && setPaso(1)}>
              1. Cuerpo del correo {paso1Valido && '✓'}
            </div>
            <div className={`tab ${paso === 2 ? 'active' : ''}`}
                 style={!paso1Valido ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                 title={!paso1Valido ? 'Primero indica el nombre del envío y la plantilla' : ''}
                 onClick={() => paso1Valido && !creando && setPaso(2)}>
              2. Archivos {paso1Valido && listoParaCrear && '✓'}
            </div>
            <div className="tab" style={{ opacity: 0.5, cursor: 'default' }} title="Al crear el lote se abre la pestaña Envíos">
              3. Envíos
            </div>
          </div>

          {paso === 1 && (
            <div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Nombre del envío</label>
                  <input className="form-input" maxLength={150} value={nombreEnvio}
                         onChange={e => setNombreEnvio(e.target.value)}
                         placeholder="Ej. Constancias de vacaciones noviembre" />
                </div>
                <div className="form-group">
                  <label className="form-label">Plantilla (cuerpo del correo)</label>
                  <select className="form-select" value={plantillaId} onChange={e => setPlantillaId(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Empresa</label>
                <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
                  <select className="form-select" style={{ flex: '1 1 260px' }} value={empresaSel} onChange={e => setEmpresaSel(e.target.value)}>
                    <option value="">Todas las empresas</option>
                    {empresas.map(e => (
                      <option key={e.ciaCodigo} value={e.ciaCodigo}>{e.descripcion}</option>
                    ))}
                  </select>
                  <button className="btn btn-ghost" onClick={handleAgregarActivos} disabled={cargandoActivos}>
                    {cargandoActivos ? <span className="spinner"></span> : '+ Agregar todos los activos'}
                  </button>
                </div>
                {infoActivos && <div className="form-hint mt-2">{infoActivos}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Colaboradores: códigos de empleado (separados por coma, espacio o salto de línea)
                  {listaCodigos.length > 0 && <span className="text-muted"> · {listaCodigos.length} códigos</span>}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    className="form-input"
                    style={{ flex: '0 0 35%' }}
                    inputMode="numeric"
                    placeholder="Buscar un código en la caja"
                    value={codigoBuscado}
                    onChange={e => setCodigoBuscado(e.target.value)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return
                      // Sin esto, el Enter llega a la caja (que recibe el foco) y reemplaza el código seleccionado
                      e.preventDefault()
                      ubicarCodigo()
                    }}
                  />
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={limpiarCodigos} disabled={!codigos.trim()}>
                    Limpiar caja
                  </button>
                </div>
                {busqueda && (
                  busqueda.exacto ? (
                    <div className="form-hint" style={{ color: 'var(--success)' }}>
                      ✓ El código {busqueda.exacto.codigo} está en la caja (posición {busqueda.exacto.posicion} de {busqueda.total}).
                      {busqueda.coincidencias.length > 1 && ` Otros ${busqueda.coincidencias.length - 1} empiezan con ${busqueda.texto}.`}
                    </div>
                  ) : busqueda.coincidencias.length > 0 ? (
                    <div className="form-hint" style={{ color: 'var(--warning)' }}>
                      {busqueda.coincidencias.length} código(s) empiezan con {busqueda.texto}: {busqueda.coincidencias.slice(0, 5).join(', ')}{busqueda.coincidencias.length > 5 ? '…' : ''}
                    </div>
                  ) : (
                    <div className="form-hint" style={{ color: 'var(--danger)' }}>
                      ✗ Ningún código de la caja coincide con {busqueda.texto}.
                    </div>
                  )
                )}
                <div className="codigos-caja">
                  <div ref={resaltadoRef} className="form-textarea codigos-resaltado" aria-hidden="true">
                    {resaltado}{'\n'}
                  </div>
                  <textarea
                    ref={codigosRef}
                    className="form-textarea"
                    placeholder={'10293\n10294\n10295'}
                    value={codigos}
                    onChange={e => setCodigos(e.target.value)}
                    onScroll={e => { if (resaltadoRef.current) resaltadoRef.current.scrollTop = e.target.scrollTop }}
                  ></textarea>
                </div>
                <div className="form-hint mt-2">
                  Si los adjuntos serán archivos PDF, los colaboradores pueden quedar vacíos: se toman del nombre de cada archivo.
                  Si escribes códigos, solo se cargan los archivos de esos colaboradores.
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="form-hint">{!paso1Valido && 'Indica el nombre del envío y la plantilla para continuar.'}</div>
                <button className="btn btn-primary" disabled={!paso1Valido} onClick={() => setPaso(2)}>Siguiente: Archivos →</button>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div>
              <div className="form-group">
                <label className="form-label">¿Qué se adjunta en cada correo?</label>
                <div className="grid-3">
                  {[
                    { valor: 'ninguno', titulo: 'Sin adjunto', texto: 'Solo el cuerpo del correo.' },
                    { valor: 'dinamico', titulo: 'PDF dinámico', texto: 'Se genera un PDF por colaborador desde un reporte (p. ej. constancia de vacaciones).' },
                    { valor: 'archivos', titulo: 'Archivos PDF', texto: 'Subes los PDF (o ZIP); cada archivo se asocia al colaborador por su nombre.' },
                  ].map(op => (
                    <label key={op.valor} className="card" style={{
                      padding: '14px', cursor: 'pointer',
                      borderColor: modoAdjunto === op.valor ? 'var(--accent)' : undefined,
                      background: modoAdjunto === op.valor ? 'var(--accent-light)' : undefined,
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <input type="radio" name="modoAdjunto" checked={modoAdjunto === op.valor} onChange={() => setModoAdjunto(op.valor)} />
                        <strong>{op.titulo}</strong>
                      </div>
                      <div className="text-muted" style={{ fontSize: '13px' }}>{op.texto}</div>
                    </label>
                  ))}
                </div>
              </div>

              {modoAdjunto === 'dinamico' && (
                <div className="form-group">
                  <label className="form-label">URL del PDF dinámico</label>
                  <select className="form-select" value={urlPdf} onChange={e => setUrlPdf(e.target.value)}>
                    <option value="">-- Selecciona una URL --</option>
                    {pdfUrls.map(u => <option key={u.id} value={u.url}>{u.nombre}</option>)}
                  </select>
                  <div className="form-hint mt-2">Las URLs se configuran en 'URLs PDF Dinámico'. El PDF se genera al crear el lote, para cada uno de los {listaCodigos.length} colaboradores.</div>
                </div>
              )}

              {modoAdjunto === 'archivos' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Identificador en el nombre del archivo</label>
                    <select className="form-select" style={{ maxWidth: '320px' }} value={tipoId} onChange={e => setTipoId(e.target.value)}>
                      <option value="cod_empleado">Código Empleado</option>
                      <option value="nit">NIT</option>
                      <option value="cui">CUI (DPI)</option>
                    </select>
                    <div className="form-hint mt-2">El nombre debe ser: identificador-resto.pdf (p. ej. 10293-constancia.pdf)</div>
                  </div>

                  <div
                    className={`dropzone ${arrastrando ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    <div className="dropzone-icon">📄</div>
                    <div className="dropzone-title">Arrastra PDFs o ZIPs aquí o haz clic</div>
                    <div className="dropzone-sub">Los ZIP se descomprimen en el servidor. Máximo {MAX_MB_POR_SUBIDA} MB por archivo; se suben al crear el lote.</div>
                    <input id="fileInput" type="file" multiple accept=".pdf,.zip" hidden onChange={handleDrop} />
                  </div>

                  {archivos.length > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="form-hint">{archivos.length} archivo(s) · {fmtMB(tamanoArchivos)}</div>
                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setArchivos([])}>Quitar todos</button>
                      </div>
                      <div className="table-wrapper" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        <table className="table-sm">
                          <tbody>
                            {archivos.map((f, i) => (
                              <tr key={`${f.name}-${i}`}>
                                <td>{f.name}</td>
                                <td className="text-muted">{fmtMB(f.size)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px' }} onClick={() => quitarArchivo(i)}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-right mt-2">
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleLimpiarTemporales}>
                      Limpiar archivos temporales del servidor
                    </button>
                  </div>
                </>
              )}

              <div className="card mt-4" style={{ padding: '14px', background: 'var(--bg-lighter)' }}>
                <div className="form-label mb-2">Resumen</div>
                <div className="text-muted" style={{ fontSize: '13px', lineHeight: 1.7 }}>
                  <div>Envío: <strong>{nombreEnvio || '—'}</strong></div>
                  <div>Plantilla: <strong>{nombrePlantilla || '—'}</strong></div>
                  <div>Colaboradores: <strong>{listaCodigos.length > 0 ? listaCodigos.length : (modoAdjunto === 'archivos' ? 'según los archivos' : '—')}</strong></div>
                  <div>Adjunto: <strong>{
                    modoAdjunto === 'ninguno' ? 'Sin adjunto'
                      : modoAdjunto === 'dinamico' ? `PDF dinámico${nombrePdf ? ` (${nombrePdf})` : ''}`
                      : `${archivos.length} archivo(s) PDF/ZIP`
                  }</strong></div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => setPaso(1)} disabled={creando}>← Cuerpo del correo</button>
                <div className="flex items-center gap-3">
                  {creando
                    ? <span className="form-hint"><span className="spinner"></span> {avance}</span>
                    : !listoParaCrear && <span className="form-hint">Falta: {faltantes.join(', ')}.</span>}
                  <button className="btn btn-primary" disabled={!listoParaCrear || creando} onClick={handleCrearLote}>
                    ✉ Crear lote de envío
                  </button>
                </div>
              </div>
            </div>
          )}

          {noCargados.length > 0 && (
            <div className="card mt-4" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="flex justify-between items-center mb-2">
                <h4 style={{ color: 'var(--warning)', margin: 0 }}>No se cargaron ({noCargados.length})</h4>
                <button className="btn btn-sm btn-ghost" onClick={() => setNoCargados([])}>Ocultar</button>
              </div>
              <div className="table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="table-sm">
                  <thead><tr><th>Código / Archivo</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {noCargados.map((e, i) => (
                      <tr key={i}><td>{e.codEmpleado ?? e.archivo}</td><td>{e.mensaje}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title mb-0">Cola de Envío</h3>
            <div className="form-hint">Registros sueltos sin envío y registros ya enviados. Los envíos creados se ven en la pestaña Envíos.</div>
          </div>
          {puedeEditar && <div className="flex gap-2">
            {resumen?.pendientes > 0 && (
              <button className="btn btn-sm btn-primary" onClick={handlePasarColaAEnvio}>
                ✉ Pasar a un envío ({resumen.pendientes})
              </button>
            )}
            {resumen?.yaEnviados > 0 && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleClearEnviados}>
                Vaciar Enviados
              </button>
            )}
            {cargas.length > 0 && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleClear}>
                Vaciar Cola
              </button>
            )}
          </div>}
        </div>

        <div className="tabs mb-4">
          <div className={`tab ${filtroEstado === '' ? 'active' : ''}`} onClick={() => handleCambiarFiltro('')}>Todos ({resumen?.totalRegistros || 0})</div>
          <div className={`tab ${filtroEstado === 'pendiente' ? 'active' : ''}`} onClick={() => handleCambiarFiltro('pendiente')}>Pendientes ({resumen?.pendientes || 0})</div>
          <div className={`tab ${filtroEstado === 'enviado' ? 'active' : ''}`} onClick={() => handleCambiarFiltro('enviado')}>Enviados ({resumen?.yaEnviados || 0})</div>
        </div>

        <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Empleado</th>
                <th>Correo</th>
                <th>Plantilla</th>
                <th>Estado</th>
                <th>Envío</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-6 text-muted">Cargando...</td></tr>
              ) : cargas.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-6 text-muted">No hay registros en la cola.</td></tr>
              ) : cargas.map(c => (
                <tr key={c.correlativo}>
                  <td>{c.correlativo}</td>
                  <td className="text-primary">{c.nombre} <span className="text-muted">({c.codEmpleado})</span></td>
                  <td>{c.correo}</td>
                  <td>{c.plantillaNombre}</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={c.habilitado} onChange={() => handleToggle(c)} disabled={!!c.fechaEnvio || !puedeEditar} />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>
                  <td>
                    {c.fechaEnvio ? <span className="badge badge-success">Enviado</span> : <span className="badge badge-warning">Pendiente</span>}
                    {!c.fechaEnvio && puedeEditar && <button className="btn btn-ghost btn-sm ml-2" style={{ padding: '4px' }} onClick={() => handleDelete(c)}>×</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
