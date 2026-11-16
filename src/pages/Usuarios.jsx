import { useState, useEffect } from 'react'
import { getUsuarios, createUsuario, updateUsuario, resetPasswordUsuario, getRoles, getPermisos, updateRolPermisos, createRol, updateRol, deleteRol } from '../api/api'
import { useAuth } from '../context/AuthContext'

const FORM_VACIO = { username: '', nombreCompleto: '', email: '', password: '', rolId: 3, activo: true }

export default function Usuarios() {
  const { user } = useAuth()
  const [tab, setTab] = useState('usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [permisos, setPermisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState(FORM_VACIO)
  // Matriz editable rolId -> Set(permisos)
  const [matriz, setMatriz] = useState({})
  const [guardandoRol, setGuardandoRol] = useState(null)
  // Mantenimiento de roles: null = cerrado; { id?, nombre, descripcion, permisos: Set }
  const [rolForm, setRolForm] = useState(null)

  const fetchData = async () => {
    try {
      const [resUsuarios, resRoles, resPermisos] = await Promise.all([getUsuarios(), getRoles(), getPermisos()])
      setUsuarios(resUsuarios.data)
      setRoles(resRoles.data)
      setPermisos(resPermisos.data)
      setMatriz(Object.fromEntries(resRoles.data.map(r => [r.id, new Set(r.permisos)])))
    } catch (err) { alert(err.response?.data?.message || 'Error al cargar usuarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const openModal = (u = null) => {
    setEditing(u)
    setFormData(u ? { ...FORM_VACIO, ...u, password: '' } : FORM_VACIO)
    setShowModal(true)
  }

  const save = async () => {
    try {
      if (editing) {
        await updateUsuario(editing.id, {
          nombreCompleto: formData.nombreCompleto,
          email: formData.email,
          rolId: parseInt(formData.rolId),
          activo: formData.activo,
        })
      } else {
        await createUsuario({ ...formData, rolId: parseInt(formData.rolId) })
      }
      setShowModal(false)
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error guardando usuario') }
  }

  const resetPassword = async (u) => {
    const password = prompt(`Nueva contraseña para ${u.username} (mínimo 8 caracteres):`)
    if (!password) return
    try {
      await resetPasswordUsuario(u.id, password)
      alert('Contraseña actualizada')
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error al cambiar la contraseña') }
  }

  const togglePermiso = (rolId, codigo) => {
    setMatriz(prev => {
      const set = new Set(prev[rolId])
      set.has(codigo) ? set.delete(codigo) : set.add(codigo)
      return { ...prev, [rolId]: set }
    })
  }

  const guardarRol = async (rol) => {
    setGuardandoRol(rol.id)
    try {
      await updateRolPermisos(rol.id, [...matriz[rol.id]])
      alert(`Permisos de ${rol.nombre} actualizados. Aplican en menos de un minuto.`)
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error guardando permisos') }
    finally { setGuardandoRol(null) }
  }

  const abrirRol = (rol = null) => setRolForm(rol
    ? { id: rol.id, nombre: rol.nombre, descripcion: rol.descripcion || '' }
    : { nombre: '', descripcion: '', permisos: new Set() })

  const togglePermisoNuevoRol = (codigo) => setRolForm(prev => {
    const set = new Set(prev.permisos)
    set.has(codigo) ? set.delete(codigo) : set.add(codigo)
    return { ...prev, permisos: set }
  })

  const guardarDatosRol = async () => {
    if (!rolForm.nombre.trim()) return alert('El nombre del rol es requerido')
    try {
      if (rolForm.id) await updateRol(rolForm.id, { nombre: rolForm.nombre, descripcion: rolForm.descripcion })
      else await createRol({ nombre: rolForm.nombre, descripcion: rolForm.descripcion, permisos: [...rolForm.permisos] })
      setRolForm(null)
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error guardando el rol') }
  }

  const eliminarRol = async (rol) => {
    if (!confirm(`¿Eliminar el rol ${rol.nombre}?`)) return
    try {
      await deleteRol(rol.id)
      fetchData()
    } catch (err) { alert(err.response?.data?.message || 'Error eliminando el rol') }
  }

  const esYo = (u) => u.id === user?.id

  if (loading) return <div className="card p-6">Cargando...</div>

  return (
    <>
      <div className="tabs mb-4">
        <div className={`tab ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}>Usuarios</div>
        <div className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>Roles y permisos</div>
      </div>

      {tab === 'usuarios' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="section-title mb-0">Usuarios del sistema</h2>
            <button className="btn btn-primary" onClick={() => openModal()}>+ Nuevo Usuario</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Acceso</th>
                    <th>Estado</th>
                    <th>Último acceso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id}>
                      <td className="text-primary">{u.username}</td>
                      <td>{u.nombreCompleto}</td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-accent">{u.rolNombre}</span></td>
                      <td>
                        <div className="flex gap-2">
                          {u.tienePassword && <span className="badge badge-info">Local</span>}
                          {u.vinculadoMicrosoft && <span className="badge badge-info">Microsoft</span>}
                          {!u.tienePassword && !u.vinculadoMicrosoft && <span className="badge badge-warning">Pendiente Microsoft</span>}
                        </div>
                      </td>
                      <td>{u.activo ? <span className="badge badge-success">Activo</span> : <span className="badge badge-danger">Inactivo</span>}</td>
                      <td>{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString() : '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => openModal(u)}>✏️</button>
                          <button className="btn btn-sm btn-ghost" title="Cambiar contraseña local" onClick={() => resetPassword(u)}>🔑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'roles' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <p className="text-muted mb-0">
              Marca qué puede hacer cada rol en cada pantalla. El rol Administrador siempre conserva la administración de usuarios.
            </p>
            <button className="btn btn-primary" onClick={() => abrirRol()}>+ Nuevo Rol</button>
          </div>
          <div className="table-wrapper">
            <table className="perm-table">
              <thead>
                <tr>
                  <th>Pantalla / Permiso</th>
                  {roles.map(r => (
                    <th key={r.id} title={r.descripcion}>
                      <div>{r.nombre}</div>
                      <div className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>{r.usuarios} usuario(s)</div>
                      <div className="flex gap-2" style={{ justifyContent: 'center', marginTop: '4px' }}>
                        <button className="btn btn-sm btn-ghost" title="Editar nombre y descripción" onClick={() => abrirRol(r)}>✏️</button>
                        <button className="btn btn-sm btn-ghost"
                                title={r.protegido ? 'Este rol no se puede eliminar' : r.usuarios > 0 ? 'Tiene usuarios asignados' : 'Eliminar rol'}
                                disabled={r.protegido || r.usuarios > 0}
                                onClick={() => eliminarRol(r)}>🗑️</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permisos.map(p => (
                  <tr key={p.codigo}>
                    <td>
                      <div className="text-primary">{p.pantalla}</div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>{p.descripcion}</div>
                    </td>
                    {roles.map(r => (
                      <td key={r.id}>
                        <input
                          type="checkbox"
                          checked={!!matriz[r.id]?.has(p.codigo)}
                          disabled={r.id === 1 && p.codigo === 'usuarios.administrar'}
                          onChange={() => togglePermiso(r.id, p.codigo)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td></td>
                  {roles.map(r => (
                    <td key={r.id}>
                      <button className="btn btn-sm btn-primary" onClick={() => guardarRol(r)} disabled={guardandoRol === r.id}>
                        {guardandoRol === r.id ? <span className="spinner"></span> : 'Guardar'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rolForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div className="modal-title">{rolForm.id ? `Editar rol ${rolForm.nombre}` : 'Nuevo Rol'}</div>
              <button className="modal-close" onClick={() => setRolForm(null)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" maxLength={50} value={rolForm.nombre}
                     onChange={e => setRolForm({ ...rolForm, nombre: e.target.value })} placeholder="Ej: Supervisor RRHH" />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <input className="form-input" maxLength={250} value={rolForm.descripcion}
                     onChange={e => setRolForm({ ...rolForm, descripcion: e.target.value })} placeholder="Qué puede hacer este rol" />
            </div>
            {!rolForm.id ? (
              <div className="form-group">
                <label className="form-label">Permisos iniciales</label>
                {permisos.map(p => (
                  <label key={p.codigo} className="flex items-center gap-2" style={{ cursor: 'pointer', padding: '2px 0' }}>
                    <input type="checkbox" checked={rolForm.permisos.has(p.codigo)} onChange={() => togglePermisoNuevoRol(p.codigo)} />
                    <span><strong>{p.pantalla}</strong> <span className="text-muted">· {p.descripcion}</span></span>
                  </label>
                ))}
                <div className="form-hint mt-2">Después puedes ajustarlos en la tabla de permisos.</div>
              </div>
            ) : (
              <div className="form-hint">Los permisos de este rol se editan en la tabla de permisos.</div>
            )}
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRolForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarDatosRol}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? `Editar ${editing.username}` : 'Nuevo Usuario'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {!editing && (
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input className="form-input" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="Ej: jperez" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nombre completo</label>
              <input className="form-input" value={formData.nombreCompleto} onChange={e => setFormData({ ...formData, nombreCompleto: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Correo</label>
              <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="usuario@empresa.com" />
              <div className="form-hint mt-2">Con este correo se enlaza la cuenta de Microsoft en su primer ingreso.</div>
            </div>
            {!editing && (
              <div className="form-group">
                <label className="form-label">Contraseña local (opcional)</label>
                <input className="form-input" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                <div className="form-hint mt-2">Déjala vacía si el usuario solo ingresará con Microsoft.</div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-select" value={formData.rolId} disabled={editing && esYo(editing)} onChange={e => setFormData({ ...formData, rolId: e.target.value })}>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              {editing && (
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginTop: '10px' }}>
                    <input type="checkbox" checked={formData.activo} disabled={esYo(editing)} onChange={e => setFormData({ ...formData, activo: e.target.checked })} />
                    Activo
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
