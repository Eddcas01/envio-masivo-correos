// ─────────────────────────────────────────────────────────────────────────────
//  Adaptador DEMO para axios: simula el backend en memoria.
//  Permite usar toda la interfaz sin servidor (GitHub Pages). Los datos son
//  ficticios y se reinician al recargar la página.
//  Para conectar el backend real: VITE_DEMO=false y VITE_API_URL=<url>.
// ─────────────────────────────────────────────────────────────────────────────

const PERMISOS = [
  { codigo: 'destinatarios.ver', pantalla: 'Destinatarios', descripcion: 'Ver destinatarios y cola' },
  { codigo: 'destinatarios.editar', pantalla: 'Destinatarios', descripcion: 'Crear y eliminar envíos' },
  { codigo: 'envio.ver', pantalla: 'Envíos', descripcion: 'Ver envíos e historial' },
  { codigo: 'envio.ejecutar', pantalla: 'Envíos', descripcion: 'Ejecutar y reenviar envíos' },
  { codigo: 'plantillas.ver', pantalla: 'Plantillas', descripcion: 'Ver plantillas' },
  { codigo: 'plantillas.editar', pantalla: 'Plantillas', descripcion: 'Crear y editar plantillas' },
  { codigo: 'pdfurls.ver', pantalla: 'PDF dinámico', descripcion: 'Ver URLs de PDF' },
  { codigo: 'pdfurls.editar', pantalla: 'PDF dinámico', descripcion: 'Editar URLs de PDF' },
  { codigo: 'usuarios.administrar', pantalla: 'Usuarios', descripcion: 'Administrar usuarios y roles' },
]
const TODOS = PERMISOS.map(p => p.codigo)

const NOMBRES = ['Ana López', 'Bruno Díaz', 'Carla Méndez', 'Daniel Ruiz', 'Elena Torres', 'Felipe Castro',
  'Gabriela Soto', 'Héctor Vega', 'Irene Rojas', 'Jorge Navarro', 'Karla Pineda', 'Luis Herrera',
  'María Fuentes', 'Nicolás Paz', 'Olga Ramos', 'Pablo Ortiz', 'Rosa Medina', 'Sergio León']
const empleados = NOMBRES.map((nombre, i) => ({
  codEmpleado: 1001 + i,
  nombre,
  correo: i === 7 ? null : `${nombre.split(' ')[0].toLowerCase()}.${nombre.split(' ')[1].toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')}@empresa-demo.com`,
  ciaCodigo: i % 3 === 0 ? 2 : 1,
}))
const empleado = (cod) => empleados.find(e => e.codEmpleado === cod)

const hace = (dias, horas = 0, minutos = 0) => new Date(Date.now() - (dias * 24 + horas) * 3600e3 + minutos * 60e3).toISOString()

const db = {
  sec: 100,
  roles: [
    { id: 1, nombre: 'Administrador', descripcion: 'Acceso total', protegido: true, permisos: [...TODOS] },
    { id: 2, nombre: 'Operador', descripcion: 'Prepara y ejecuta envíos', protegido: false,
      permisos: TODOS.filter(p => p !== 'usuarios.administrar') },
    { id: 3, nombre: 'Consulta', descripcion: 'Solo lectura', protegido: false,
      permisos: TODOS.filter(p => p.endsWith('.ver')) },
  ],
  usuarios: [
    { id: 1, username: 'demo', nombreCompleto: 'Usuario Demo', email: 'demo@empresa-demo.com', rolId: 1, activo: true, tienePassword: true, vinculadoMicrosoft: true, ultimoAcceso: hace(0) },
    { id: 2, username: 'operador', nombreCompleto: 'Olga Ramos', email: 'olga.ramos@empresa-demo.com', rolId: 2, activo: true, tienePassword: false, vinculadoMicrosoft: true, ultimoAcceso: hace(1, 3) },
    { id: 3, username: 'consulta', nombreCompleto: 'Pablo Ortiz', email: 'pablo.ortiz@empresa-demo.com', rolId: 3, activo: false, tienePassword: true, vinculadoMicrosoft: false, ultimoAcceso: hace(20) },
  ],
  plantillas: [
    { id: 1, nombre: 'Boleta de pago', subject: 'Tu boleta de pago de {{Periodo}}', remitenteNombre: 'Recursos Humanos', remitenteEmail: 'rrhh@empresa-demo.com',
      bodyHtml: '<p>Hola <strong>{{Nombre}}</strong>,</p><p>Adjuntamos tu boleta de pago correspondiente a {{Periodo}}.</p><p>Saludos,<br>Recursos Humanos</p>', fechaCreacion: hace(40) },
    { id: 2, nombre: 'Constancia anual', subject: 'Constancia de ingresos {{Anio}}', remitenteNombre: 'Recursos Humanos', remitenteEmail: 'rrhh@empresa-demo.com',
      bodyHtml: '<p>Estimado(a) {{Nombre}}:</p><p>Te compartimos tu constancia de ingresos del año {{Anio}}.</p>', fechaCreacion: hace(15) },
    { id: 3, nombre: 'Comunicado general', subject: 'Comunicado importante', remitenteNombre: 'Comunicación Interna', remitenteEmail: 'comunicacion@empresa-demo.com',
      bodyHtml: '<h2>Comunicado</h2><p>Hola {{Nombre}}, te recordamos que el viernes es día de convivencia.</p>', fechaCreacion: hace(3) },
  ],
  pdfUrls: [
    { id: 1, nombre: 'Boleta de pago (servicio de reportes)', url: 'https://reportes.empresa-demo.com/boleta?empleado={codEmpleado}', fechaCreacion: hace(30) },
    { id: 2, nombre: 'Constancia de ingresos', url: 'https://reportes.empresa-demo.com/constancia?empleado={codEmpleado}', fechaCreacion: hace(10) },
  ],
  cargas: [],      // destinatarios de todos los envíos
  bloques: [],     // envíos
  envio: null,     // envío en curso
}

const sec = () => ++db.sec
const plantilla = (id) => db.plantillas.find(p => p.id === Number(id))

function crearDestinatario(bloqueId, cod, plantillaId, adjunto) {
  const e = empleado(cod)
  if (!e) return { codEmpleado: cod, exitoso: false, mensaje: 'El código no existe' }
  if (!e.correo) return { codEmpleado: cod, exitoso: false, mensaje: 'El colaborador no tiene correo interno' }
  const p = plantilla(plantillaId)
  db.cargas.push({ correlativo: sec(), bloqueId, codEmpleado: cod, nombre: e.nombre, correo: e.correo,
    plantillaId: p.id, plantillaNombre: p.nombre, asunto: p.subject.replace('{{Periodo}}', 'octubre 2026').replace('{{Anio}}', '2026'),
    adjunto: adjunto || null, habilitado: true, fechaEnvio: null, exitoso: null, error: null })
  return { codEmpleado: cod, exitoso: true, mensaje: 'Cargado' }
}

function resumenBloque(b) {
  const det = db.cargas.filter(c => c.bloqueId === b.id)
  const enviados = det.filter(c => c.exitoso === true).length
  const errores = det.filter(c => c.exitoso === false).length
  const plantillasEnvio = [...new Map(det.map(c => [c.plantillaId, { id: c.plantillaId, nombre: c.plantillaNombre }])).values()]
  return { ...b, total: det.length, enviados, errores,
    plantillas: plantillasEnvio.map(p => p.nombre), plantillasEnvio, usuario: b.usuarioCrea }
}

// Historial de ejemplo: un envío completado y uno con error
;(function sembrar() {
  const b1 = { id: sec(), nombre: 'Boletas septiembre 2026', estado: 'Completado', usuarioCrea: 'demo', fechaCreacion: hace(45),
    fechaInicio: hace(45), fechaFin: hace(45, 0, 4), urlPdf: db.pdfUrls[0].url, bloqueOrigenId: null }
  db.bloques.push(b1)
  empleados.slice(0, 10).forEach(e => crearDestinatario(b1.id, e.codEmpleado, 1, `boleta_${e.codEmpleado}.pdf`))
  db.cargas.filter(c => c.bloqueId === b1.id).forEach(c => { c.exitoso = true; c.fechaEnvio = hace(45) })

  const b2 = { id: sec(), nombre: 'Comunicado convivencia', estado: 'Con error', usuarioCrea: 'operador', fechaCreacion: hace(2),
    fechaInicio: hace(2), fechaFin: hace(2, 0, 3), urlPdf: null, bloqueOrigenId: null }
  db.bloques.push(b2)
  empleados.slice(4, 12).forEach(e => crearDestinatario(b2.id, e.codEmpleado, 3))
  db.cargas.filter(c => c.bloqueId === b2.id).forEach((c, i) => {
    c.fechaEnvio = hace(2); c.exitoso = i !== 2; c.error = i === 2 ? 'Buzón lleno (552 5.2.2)' : null
  })

  const b3 = { id: sec(), nombre: 'Constancias 2026', estado: 'Pendiente', usuarioCrea: 'demo', fechaCreacion: hace(0, 2),
    fechaInicio: null, fechaFin: null, urlPdf: db.pdfUrls[1].url, bloqueOrigenId: null }
  db.bloques.push(b3)
  empleados.slice(0, 6).forEach(e => crearDestinatario(b3.id, e.codEmpleado, 2, `constancia_${e.codEmpleado}.pdf`))

  // Registros sueltos en la cola (sin envío asignado)
  empleados.slice(12, 15).forEach(e => crearDestinatario(null, e.codEmpleado, 3))
})()

// Avanza el envío en curso un poco en cada consulta de progreso
function avanzarEnvio() {
  const env = db.envio
  if (!env || env.completado) return
  const pendientes = db.cargas.filter(c => c.bloqueId === env.bloqueId && c.habilitado && c.fechaEnvio === null)
  pendientes.slice(0, 2).forEach(c => {
    c.fechaEnvio = new Date().toISOString()
    c.exitoso = Math.random() > 0.08
    c.error = c.exitoso ? null : 'Tiempo de espera agotado con el servidor SMTP'
    env.log.push({ timestamp: c.fechaEnvio, correo: c.correo, exitoso: c.exitoso, error: c.error })
  })
  const det = db.cargas.filter(c => c.bloqueId === env.bloqueId && c.habilitado)
  const enviados = det.filter(c => c.exitoso === true).length
  const errores = det.filter(c => c.exitoso === false).length
  const restantes = det.filter(c => c.fechaEnvio === null).length
  Object.assign(env, { enviados, errores, pendientes: restantes,
    porcentaje: det.length ? Math.round(((det.length - restantes) / det.length) * 100) : 100 })
  if (restantes === 0) {
    env.completado = true
    const b = db.bloques.find(x => x.id === env.bloqueId)
    Object.assign(b, { estado: errores ? 'Con error' : 'Completado', fechaFin: new Date().toISOString() })
  }
}

// ── Router ───────────────────────────────────────────────────────────────────
const rutas = []
const ruta = (metodo, patron, fn) => rutas.push({ metodo, re: new RegExp('^' + patron.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn })
const ok = (data) => ({ status: 200, data })
const error = (status, message) => ({ status, data: { message } })
const usuarioPublico = (u) => {
  const rol = db.roles.find(r => r.id === u.rolId)
  return { id: u.id, username: u.username, nombreCompleto: u.nombreCompleto, email: u.email, rol: rol?.nombre, permisos: rol?.permisos || [] }
}

ruta('post', '/auth/login', ({ body }) => {
  const u = db.usuarios.find(x => x.username === (body.username || '').trim()) || db.usuarios[0]
  return ok({ token: 'demo-token', ...usuarioPublico(u) })
})
ruta('get', '/auth/me', () => ok(usuarioPublico(db.usuarios[0])))
ruta('get', '/auth/microsoft/config', () => ok({ habilitado: false }))

ruta('get', '/plantillas', () => ok(db.plantillas))
ruta('get', '/plantillas/variables', () => ok([
  { variable: '{{Nombre}}', descripcion: 'Nombre del colaborador' },
  { variable: '{{CodEmpleado}}', descripcion: 'Código de empleado' },
  { variable: '{{Periodo}}', descripcion: 'Periodo de la boleta' },
  { variable: '{{Anio}}', descripcion: 'Año en curso' },
]))
ruta('post', '/plantillas/vista-previa', ({ body }) => {
  const r = (s) => (s || '').replaceAll('{{Nombre}}', 'Ana López').replaceAll('{{CodEmpleado}}', '1001')
    .replaceAll('{{Periodo}}', 'octubre 2026').replaceAll('{{Anio}}', '2026')
  return ok({ subject: r(body.subject), html: r(body.bodyHtml) })
})
ruta('post', '/plantillas', ({ body }) => { const p = { ...body, id: sec(), fechaCreacion: new Date().toISOString() }; db.plantillas.push(p); return ok(p) })
ruta('put', '/plantillas/:id', ({ p, body }) => { Object.assign(plantilla(p.id), body); return ok(plantilla(p.id)) })
ruta('delete', '/plantillas/:id', ({ p }) => { db.plantillas = db.plantillas.filter(x => x.id !== Number(p.id)); return ok({}) })

ruta('get', '/plantillasurlpdf', () => ok(db.pdfUrls))
ruta('get', '/plantillasurlpdf/:id', ({ p }) => ok(db.pdfUrls.find(x => x.id === Number(p.id))))
ruta('post', '/plantillasurlpdf', ({ body }) => { const u = { ...body, id: sec(), fechaCreacion: new Date().toISOString() }; db.pdfUrls.push(u); return ok(u) })
ruta('put', '/plantillasurlpdf/:id', ({ p, body }) => { const u = db.pdfUrls.find(x => x.id === Number(p.id)); Object.assign(u, body); return ok(u) })
ruta('delete', '/plantillasurlpdf/:id', ({ p }) => { db.pdfUrls = db.pdfUrls.filter(x => x.id !== Number(p.id)); return ok({}) })

ruta('get', '/empleados/empresas', () => ok([{ ciaCodigo: 1, descripcion: 'Empresa Demo, S.A.' }, { ciaCodigo: 2, descripcion: 'Servicios Demo, S.A.' }]))
ruta('get', '/empleados/activos', ({ params }) => {
  const lista = empleados.filter(e => !params.ciaCodigo || e.ciaCodigo === Number(params.ciaCodigo))
  return ok({ empleados: lista.filter(e => e.correo), sinCorreo: lista.filter(e => !e.correo).length })
})

ruta('get', '/usuarios', () => ok(db.usuarios.map(u => ({ ...u, rolNombre: db.roles.find(r => r.id === u.rolId)?.nombre }))))
ruta('post', '/usuarios', ({ body }) => { const u = { ...body, id: sec(), tienePassword: !!body.password, vinculadoMicrosoft: false, ultimoAcceso: null }; delete u.password; db.usuarios.push(u); return ok(u) })
ruta('put', '/usuarios/:id', ({ p, body }) => { const u = db.usuarios.find(x => x.id === Number(p.id)); const { password, ...resto } = body; Object.assign(u, resto); return ok(u) })
ruta('put', '/usuarios/:id/password', ({ p }) => { db.usuarios.find(x => x.id === Number(p.id)).tienePassword = true; return ok({ message: 'Contraseña actualizada' }) })
ruta('get', '/usuarios/roles', () => ok(db.roles.map(r => ({ ...r, usuarios: db.usuarios.filter(u => u.rolId === r.id).length }))))
ruta('get', '/usuarios/permisos', () => ok(PERMISOS))
ruta('put', '/usuarios/roles/:id/permisos', ({ p, body }) => { db.roles.find(r => r.id === Number(p.id)).permisos = body.permisos; return ok({}) })
ruta('post', '/usuarios/roles', ({ body }) => { const r = { ...body, id: sec(), protegido: false, permisos: body.permisos || [] }; db.roles.push(r); return ok(r) })
ruta('put', '/usuarios/roles/:id', ({ p, body }) => { Object.assign(db.roles.find(r => r.id === Number(p.id)), body); return ok({}) })
ruta('delete', '/usuarios/roles/:id', ({ p }) => {
  const r = db.roles.find(x => x.id === Number(p.id))
  if (r.protegido) return error(400, 'Este rol no se puede eliminar')
  if (db.usuarios.some(u => u.rolId === r.id)) return error(400, 'El rol tiene usuarios asignados')
  db.roles = db.roles.filter(x => x !== r); return ok({})
})

// Cola de destinatarios
ruta('get', '/cargas', ({ params }) => ok(db.cargas
  .filter(c => !params.estado || (params.estado === 'pendiente' ? !c.fechaEnvio : params.estado === 'enviado' ? !!c.fechaEnvio : true))
  .slice().reverse()))
ruta('get', '/cargas/resumen', () => ok({
  totalRegistros: db.cargas.length,
  pendientes: db.cargas.filter(c => !c.fechaEnvio).length,
  yaEnviados: db.cargas.filter(c => !!c.fechaEnvio).length,
}))
ruta('post', '/cargas/cargar-codigos', ({ body }) => {
  const resultados = body.codigosEmpleado.map(cod => crearDestinatario(body.bloqueId, Number(cod), body.plantillaId,
    body.generarPdf ? `pdf_${cod}.pdf` : null))
  return ok({ cargados: resultados.filter(r => r.exitoso).length, resultados })
})
ruta('post', '/cargas/procesar-archivos', ({ body }) => {
  const resultados = body.rutasArchivos.map(ruta => {
    const cod = Number((ruta.match(/\d{4}/) || [])[0])
    return cod ? crearDestinatario(body.bloqueId, cod, body.plantillaId, ruta)
      : { archivo: ruta, exitoso: false, mensaje: 'No se encontró el identificador en el nombre del archivo' }
  })
  return ok({ cargados: resultados.filter(r => r.exitoso).length, resultados })
})
ruta('patch', '/cargas/:id/habilitado', ({ p, body }) => { db.cargas.find(c => c.correlativo === Number(p.id)).habilitado = body.habilitado; return ok({}) })
ruta('delete', '/cargas/todos', () => { db.cargas = db.cargas.filter(c => c.fechaEnvio); return ok({}) })
ruta('delete', '/cargas/enviados', () => { db.cargas = db.cargas.filter(c => !c.fechaEnvio); return ok({}) })
ruta('delete', '/cargas/:id', ({ p }) => { db.cargas = db.cargas.filter(c => c.correlativo !== Number(p.id)); return ok({}) })

ruta('post', '/archivos/subir', ({ body }) => {
  const archivos = body instanceof FormData ? body.getAll('files') : []
  return ok({ resultados: archivos.map(f => ({ nombre: f.name, ruta: f.name, exitoso: /\.(pdf|zip)$/i.test(f.name),
    mensaje: /\.(pdf|zip)$/i.test(f.name) ? 'Subido' : 'Solo se permiten PDF o ZIP' })) })
})
ruta('delete', '/archivos/limpiar-temporales', () => ok({ message: 'Archivos temporales eliminados (demo)' }))

// Envío
ruta('post', '/envio/iniciar', ({ body }) => {
  if (db.envio && !db.envio.completado) return error(409, 'Ya hay un envío en curso')
  const b = db.bloques.find(x => x.id === Number(body.bloqueId))
  Object.assign(b, { estado: 'En curso', fechaInicio: new Date().toISOString() })
  db.envio = { bloqueId: b.id, enviados: 0, errores: 0, pendientes: resumenBloque(b).total, porcentaje: 0, completado: false, log: [] }
  return ok({ message: 'Envío iniciado' })
})
ruta('get', '/envio/progreso', () => { avanzarEnvio(); return ok(db.envio) })
ruta('get', '/envio/estado', () => { avanzarEnvio(); return ok({ enProceso: !!db.envio && !db.envio.completado }) })

// Envíos (bloques)
ruta('get', '/bloques/pendientes', () => ok(db.bloques.filter(b => b.estado === 'Pendiente').map(resumenBloque).reverse()))
ruta('get', '/bloques', ({ params }) => ok(db.bloques
  .filter(b => (!params.desde || (b.fechaInicio || b.fechaCreacion) >= params.desde) && (!params.hasta || (b.fechaInicio || b.fechaCreacion).slice(0, 10) <= params.hasta))
  .map(resumenBloque).map(b => ({ ...b, fechaInicio: b.fechaInicio || b.fechaCreacion })).reverse()))
ruta('get', '/bloques/:id', ({ p }) => {
  const b = db.bloques.find(x => x.id === Number(p.id))
  if (!b) return error(404, 'El envío no existe')
  const det = db.cargas.filter(c => c.bloqueId === b.id).map(c => ({ ...c, id: c.correlativo, fecha: c.fechaEnvio }))
  // detalles = correos ya procesados (resultado); destinatarios = los que aún no se envían
  return ok({ ...resumenBloque(b), detalles: det.filter(c => c.fechaEnvio), destinatarios: det.filter(c => !c.fechaEnvio) })
})
ruta('post', '/bloques', ({ body }) => {
  const b = { id: sec(), nombre: body.nombre, estado: 'Pendiente', usuarioCrea: 'demo', fechaCreacion: new Date().toISOString(),
    fechaInicio: null, fechaFin: null, urlPdf: body.urlPdf || null, bloqueOrigenId: null }
  db.bloques.push(b)
  if (!body.vacio) db.cargas.filter(c => !c.bloqueId && !c.fechaEnvio).forEach(c => { c.bloqueId = b.id })  // registros sueltos de la cola
  return ok(resumenBloque(b))
})
ruta('delete', '/bloques/:id/destinatarios/:corr', ({ p }) => { db.cargas = db.cargas.filter(c => c.correlativo !== Number(p.corr)); return ok({}) })
ruta('delete', '/bloques/:id', ({ p }) => {
  db.bloques = db.bloques.filter(b => b.id !== Number(p.id)); db.cargas = db.cargas.filter(c => c.bloqueId !== Number(p.id)); return ok({})
})
ruta('post', '/bloques/:id/agregar', ({ p, body }) => {
  const b = db.bloques.find(x => x.id === Number(p.id))
  const plantillaId = body.plantillaId || resumenBloque(b).plantillasEnvio[0]?.id
  const resultados = body.codigosEmpleado.map(cod => crearDestinatario(b.id, Number(cod), plantillaId))
  return ok({ agregados: resultados.filter(r => r.exitoso).length, errores: resultados.filter(r => !r.exitoso).length, resultados })
})
ruta('post', '/bloques/:id/reenviar', ({ p, body }) => {
  const origen = db.bloques.find(x => x.id === Number(p.id))
  const fallidos = db.cargas.filter(c => c.bloqueId === origen.id && (body.detalleIds?.length ? body.detalleIds.includes(c.correlativo) : c.exitoso === false))
  if (!fallidos.length) return error(400, 'No hay correos para reenviar')
  const b = { id: sec(), nombre: `Reenvío de #${origen.id}`, estado: 'Pendiente', usuarioCrea: 'demo', fechaCreacion: new Date().toISOString(),
    fechaInicio: null, fechaFin: null, urlPdf: origen.urlPdf, bloqueOrigenId: origen.id }
  db.bloques.push(b)
  fallidos.forEach(c => crearDestinatario(b.id, c.codEmpleado, c.plantillaId, c.adjunto))
  return ok({ message: `Se creó el envío #${b.id} con ${fallidos.length} correo(s)`, omitidos: [] })
})

export default async function demoAdapter(config) {
  await new Promise(r => setTimeout(r, 150 + Math.random() * 200))   // latencia de red simulada
  const url = (config.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '')
  const metodo = (config.method || 'get').toLowerCase()
  let body = config.data
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* no JSON */ } }
  for (const r of rutas) {
    const m = r.metodo === metodo && url.match(r.re)
    if (!m) continue
    const res = r.fn({ p: m.groups || {}, body: body || {}, params: config.params || {} })
    const respuesta = { ...res, statusText: String(res.status), headers: {}, config }
    if (res.status >= 400) {
      const err = new Error(res.data?.message || 'Error'); err.response = respuesta; err.config = config; throw err
    }
    return respuesta
  }
  const err = new Error(`Ruta demo no implementada: ${metodo.toUpperCase()} ${url}`)
  err.response = { status: 404, data: { message: err.message }, headers: {}, config }
  throw err
}
