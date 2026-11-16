import { useState, useCallback } from 'react'

// Tema de la interfaz (oscuro por defecto). Se guarda por navegador en localStorage.
const CLAVE = 'tema'

const leerTema = () => {
  try { return localStorage.getItem(CLAVE) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

const aplicar = (tema) => {
  if (tema === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
}

export const aplicarTemaGuardado = () => aplicar(leerTema())

export function useTema() {
  const [tema, setTema] = useState(leerTema)

  const alternarTema = useCallback(() => {
    setTema(actual => {
      const nuevo = actual === 'dark' ? 'light' : 'dark'
      aplicar(nuevo)
      try { localStorage.setItem(CLAVE, nuevo) } catch { /* sin almacenamiento: solo para esta sesión */ }
      return nuevo
    })
  }, [])

  return [tema, alternarTema]
}
