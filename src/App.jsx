import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, PERMISOS } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Plantillas from './pages/Plantillas'
import PdfUrls from './pages/PdfUrls'
import Cargas from './pages/Cargas'
import Envio from './pages/Envio'
import Usuarios from './pages/Usuarios'
import Bloques from './pages/Bloques'

// Orden de preferencia para la página de inicio según permisos
const RUTAS = [
    { path: '/cargas', permiso: PERMISOS.DESTINATARIOS_VER },
    { path: '/envio', permiso: PERMISOS.ENVIO_VER },
    { path: '/plantillas', permiso: PERMISOS.PLANTILLAS_VER },
    { path: '/pdfurls', permiso: PERMISOS.PDFURLS_VER },
    { path: '/usuarios', permiso: PERMISOS.USUARIOS_ADMINISTRAR },
]

const SinAcceso = () => (
    <div className="card empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Sin acceso</div>
        <p className="text-muted">Tu rol no tiene permisos asignados. Contacta al administrador.</p>
    </div>
)

const ProtectedRoute = ({ children, permiso }) => {
    const { isAuthenticated, hasPermission } = useAuth()
    if (!isAuthenticated) return <Navigate to="/login" />
    if (permiso && !hasPermission(permiso)) return <Navigate to="/" />
    return <Layout>{children}</Layout>
}

const Inicio = () => {
    const { hasPermission } = useAuth()
    const primera = RUTAS.find(r => hasPermission(r.permiso))
    return primera ? <Navigate to={primera.path} /> : <SinAcceso />
}

function AppRoutes() {
    const { isAuthenticated } = useAuth()

    return (
        <Router>
            <Routes>
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />

                <Route path="/" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />
                <Route path="/plantillas" element={<ProtectedRoute permiso={PERMISOS.PLANTILLAS_VER}><Plantillas /></ProtectedRoute>} />
                <Route path="/pdfurls" element={<ProtectedRoute permiso={PERMISOS.PDFURLS_VER}><PdfUrls /></ProtectedRoute>} />
                <Route path="/cargas" element={<ProtectedRoute permiso={PERMISOS.DESTINATARIOS_VER}><Cargas /></ProtectedRoute>} />
                <Route path="/envio" element={<ProtectedRoute permiso={PERMISOS.ENVIO_VER}><Envio /></ProtectedRoute>} />
                <Route path="/bloques" element={<ProtectedRoute permiso={PERMISOS.ENVIO_VER}><Bloques /></ProtectedRoute>} />
                <Route path="/usuarios" element={<ProtectedRoute permiso={PERMISOS.USUARIOS_ADMINISTRAR}><Usuarios /></ProtectedRoute>} />

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}

export default App
