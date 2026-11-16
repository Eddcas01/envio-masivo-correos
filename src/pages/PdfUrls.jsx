import { useState, useEffect } from 'react'
import { getPdfUrls, createPdfUrl, updatePdfUrl, deletePdfUrl } from '../api/api'
import { useAuth, PERMISOS } from '../context/AuthContext'

export default function PdfUrls() {
  const { hasPermission } = useAuth()
  const puedeEditar = hasPermission(PERMISOS.PDFURLS_EDITAR)
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ nombre: '', url: '' })

  const fetchUrls = async () => {
    try {
      const { data } = await getPdfUrls()
      setUrls(data)
    } catch (err) { alert('Error al cargar URLs de PDFs') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUrls() }, [])

  const openModal = (u = null) => {
    if (u) {
      setEditing(u)
      setFormData({ ...u })
    } else {
      setEditing(null)
      setFormData({ nombre: '', url: '' })
    }
    setShowModal(true)
  }

  const save = async () => {
    if (!formData.nombre || !formData.url) {
      alert('Nombre y URL son requeridos');
      return;
    }
    try {
      if (editing) await updatePdfUrl(editing.id, formData)
      else await createPdfUrl(formData)
      setShowModal(false)
      fetchUrls()
    } catch (err) { alert(err.response?.data?.message || 'Error guardando URL') }
  }

  const remove = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta URL?')) return
    try {
      await deletePdfUrl(id)
      fetchUrls()
    } catch (err) { alert('Error al eliminar') }
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="section-title mb-0">URLs para PDFs Dinámicos</h2>
        {puedeEditar && <button className="btn btn-primary" onClick={() => openModal()}>+ Nueva URL</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div className="p-6">Cargando...</div> : 
         urls.length === 0 ? <div className="empty-state">No hay URLs creadas.</div> : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>URL Base</th>
                  <th>Creación</th>
                  {puedeEditar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {urls.map(u => (
                  <tr key={u.id}>
                    <td className="text-primary font-medium">{u.nombre}</td>
                    <td style={{ wordBreak: 'break-all', maxWidth: '400px' }}>{u.url}</td>
                    <td>{new Date(u.fechaCreacion).toLocaleDateString()}</td>
                    {puedeEditar && <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" onClick={() => openModal(u)}>✏️</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => remove(u.id)}>🗑️</button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar URL de PDF' : 'Nueva URL de PDF'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Nombre de referencia</label>
              <input className="form-input" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Recibo de Pago (Evo)" />
            </div>

            <div className="form-group mt-4">
              <label className="form-label">URL del servicio</label>
              <input className="form-input" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://api.empresa.com/pdf?cod={codigo}" />
              <small className="text-gray-500 mt-1 block">Usa {'{codigo}'} donde deba insertarse el código del empleado.</small>
            </div>

            <div className="modal-footer mt-6">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Guardar URL</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
