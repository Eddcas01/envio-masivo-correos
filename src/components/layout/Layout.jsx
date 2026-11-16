import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children }) {
  const location = useLocation()
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/plantillas': return { title: 'Plantillas de Email', sub: 'Gestiona los diseños y mensajes HTML' }
      case '/cargas': return { title: 'Gestión de Destinatarios', sub: 'Carga empleados y archivos adjuntos para el envío' }
      case '/envio': return { title: 'Envíos', sub: 'Envíos pendientes: envíalos uno a uno y monitorea el avance' }
      case '/bloques': return { title: 'Historial de Envíos', sub: 'Consulta por bloques de envío: encabezado y detalle de cada correo' }
      case '/pdfurls': return { title: 'URLs PDF Dinámico', sub: 'Servicios que generan el PDF adjunto por colaborador (p.ej. constancia de vacaciones)' }
      case '/usuarios': return { title: 'Usuarios y Roles', sub: 'Administra accesos, roles y permisos por pantalla' }
      default: return { title: 'Dashboard', sub: 'Resumen general' }
    }
  }

  const { title, sub } = getPageTitle()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header title={title} sub={sub} />
        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  )
}
