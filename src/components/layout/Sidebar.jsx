import { NavLink } from 'react-router-dom'
import { useAuth, PERMISOS } from '../../context/AuthContext'

const SECCIONES = [
  {
    label: 'Principal',
    items: [
      { to: '/cargas', icon: '📥', text: 'Destinatarios', permiso: PERMISOS.DESTINATARIOS_VER },
      { to: '/envio', icon: '🚀', text: 'Envíos', permiso: PERMISOS.ENVIO_VER },
      { to: '/bloques', icon: '📋', text: 'Historial de Envíos', permiso: PERMISOS.ENVIO_VER },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { to: '/plantillas', icon: '📄', text: 'Plantillas', permiso: PERMISOS.PLANTILLAS_VER },
      { to: '/pdfurls', icon: '🔗', text: 'URLs PDF Dinámico', permiso: PERMISOS.PDFURLS_VER },
    ],
  },
  {
    label: 'Seguridad',
    items: [
      { to: '/usuarios', icon: '👥', text: 'Usuarios y Roles', permiso: PERMISOS.USUARIOS_ADMINISTRAR },
    ],
  },
]

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuth()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📧</div>
        <div>
          <div className="sidebar-logo-text">Email Masivo</div>
          <div className="sidebar-logo-sub">Sistema de Envíos</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {SECCIONES.map((seccion, i) => {
          const items = seccion.items.filter(item => hasPermission(item.permiso))
          if (items.length === 0) return null
          return (
            <div key={seccion.label}>
              <div className="nav-section-label" style={i > 0 ? { marginTop: '12px' } : undefined}>{seccion.label}</div>
              {items.map(item => (
                <NavLink key={item.to} to={item.to} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.text}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">
            {user?.nombreCompleto?.charAt(0) || user?.username?.charAt(0) || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.nombreCompleto || user?.username}</div>
            <div className="user-role">{user?.rol || 'Sin rol'}</div>
          </div>
          <button onClick={logout} className="logout-btn" title="Cerrar sesión">
            🚪
          </button>
        </div>
      </div>
    </aside>
  )
}
