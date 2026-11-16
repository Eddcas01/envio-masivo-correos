import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import App from './App.jsx'
import './index.css'
import { aplicarTemaGuardado } from './theme'

// Antes del primer render, para que no parpadee el tema
aplicarTemaGuardado()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
