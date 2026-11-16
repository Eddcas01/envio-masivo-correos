import { useState, useEffect, useRef } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { getPlantillas, createPlantilla, updatePlantilla, deletePlantilla, getVariablesPlantilla, vistaPreviaPlantilla } from '../api/api'
import { useAuth, PERMISOS } from '../context/AuthContext'

export default function Plantillas() {
  const { hasPermission } = useAuth()
  const puedeEditar = hasPermission(PERMISOS.PLANTILLAS_EDITAR)
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', subject: '', remitenteNombre: '', remitenteEmail: '', bodyHtml: '' })
  const [variables, setVariables] = useState([])
  const [preview, setPreview] = useState(null)
  const quillRef = useRef(null)

  const fetchPlantillas = async () => {
    try {
      const { data } = await getPlantillas()
      setPlantillas(data)
    } catch (err) { alert('Error al cargar plantillas') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchPlantillas()
    getVariablesPlantilla().then(res => setVariables(res.data)).catch(() => setVariables([]))
  }, [])

  const openModal = (p = null) => {
    if (p) {
      setEditing(p)
      setFormData({ ...p })
    } else {
      setEditing(null)
      setFormData({ nombre: '', descripcion: '', subject: '', remitenteNombre: '', remitenteEmail: '', bodyHtml: '' })
    }
    setShowModal(true)
  }

  const save = async () => {
    try {
      if (editing) await updatePlantilla(editing.id, formData)
      else await createPlantilla(formData)
      setShowModal(false)
      fetchPlantillas()
    } catch (err) { alert(err.response?.data?.message || 'Error guardando plantilla') }
  }

  const remove = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta plantilla?')) return
    try {
      await deletePlantilla(id)
      fetchPlantillas()
    } catch (err) { alert(err.response?.data?.message || 'Error al eliminar') }
  }

  // Inserta la variable en la posición del cursor del editor
  const insertarVariable = (variable) => {
    const editor = quillRef.current?.getEditor()
    if (!editor) return
    const range = editor.getSelection(true)
    const index = range ? range.index : editor.getLength()
    editor.insertText(index, variable, 'user')
    editor.setSelection(index + variable.length, 0)
  }

  const verVistaPrevia = async (p) => {
    try {
      const { data } = await vistaPreviaPlantilla({ subject: p.subject, bodyHtml: p.bodyHtml })
      setPreview({ ...data, remitente: `${p.remitenteNombre} <${p.remitenteEmail}>` })
    } catch (err) { alert(err.response?.data?.message || 'Error generando la vista previa') }
  }

  const modules = { toolbar: [[{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'color': [] }, { 'background': [] }], [{ 'align': [] }], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image'], ['clean']] }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="section-title mb-0">Tus Plantillas HTML</h2>
        {puedeEditar && <button className="btn btn-primary" onClick={() => openModal()}>+ Nueva Plantilla</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div className="p-6">Cargando...</div> :
         plantillas.length === 0 ? <div className="empty-state">No hay plantillas creadas.</div> : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Asunto</th>
                  <th>Remitente</th>
                  <th>Creación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plantillas.map(p => (
                  <tr key={p.id}>
                    <td className="text-primary">{p.nombre}</td>
                    <td>{p.subject}</td>
                    <td>{p.remitenteNombre} &lt;{p.remitenteEmail}&gt;</td>
                    <td>{new Date(p.fechaCreacion).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" title="Vista previa" onClick={() => verVistaPrevia(p)}>👁️</button>
                        {puedeEditar && <button className="btn btn-sm btn-ghost" title="Editar" onClick={() => openModal(p)}>✏️</button>}
                        {puedeEditar && <button className="btn btn-sm btn-ghost" title="Eliminar" onClick={() => remove(p.id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Plantilla' : 'Nueva Plantilla'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="form-row-3">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre interno</label>
                <input className="form-input" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Invitación Evento 2024" />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" value={formData.descripcion || ''} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Asunto del correo (Subject)</label>
              <input className="form-input" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} placeholder="Constancia de vacaciones - {nombre}" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre del Remitente</label>
                <input className="form-input" value={formData.remitenteNombre} onChange={e => setFormData({...formData, remitenteNombre: e.target.value})} placeholder="Recursos Humanos" />
              </div>
              <div className="form-group">
                <label className="form-label">Email del Remitente</label>
                <input className="form-input" type="email" value={formData.remitenteEmail} onChange={e => setFormData({...formData, remitenteEmail: e.target.value})} placeholder="rrhh@empresa.com" />
              </div>
            </div>

            <div className="form-group mt-2">
              <label className="form-label">Cuerpo del Email (HTML)</label>
              <ReactQuill ref={quillRef} theme="snow" value={formData.bodyHtml} onChange={v => setFormData({...formData, bodyHtml: v})} modules={modules} />
              {variables.length > 0 && (
                <>
                  <div className="form-hint mt-2">
                    Variables dinámicas (clic para insertar en el cuerpo; también funcionan en el asunto). Se reemplazan con los datos de cada colaborador al enviar.
                  </div>
                  <div className="chip-list">
                    {variables.map(v => (
                      <span key={v.variable} className="chip" title={v.descripcion} onClick={() => insertarVariable(v.variable)}>
                        {v.variable}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => verVistaPrevia(formData)}>👁️ Vista previa</button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar Plantilla</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <div className="modal-title">Vista previa del correo</div>
              <button className="modal-close" onClick={() => setPreview(null)}>×</button>
            </div>
            <div className="form-hint mb-2"><strong>De:</strong> {preview.remitente}</div>
            <div className="form-hint mb-4"><strong>Asunto:</strong> {preview.subject}</div>
            <iframe title="Vista previa" className="preview-frame" sandbox="" srcDoc={preview.html} />
            <div className="form-hint mt-2">Las variables se muestran con datos de ejemplo. El correo se envía siempre en tema claro.</div>
          </div>
        </div>
      )}
    </>
  )
}
