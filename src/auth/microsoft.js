// Login con Microsoft Entra ID usando MSAL.
// El id_token obtenido se envía al backend, que lo valida y emite el JWT propio de la aplicación.
// En equipos unidos al dominio (Edge / Windows) la sesión de Windows se reutiliza: no se pide correo ni contraseña.
let instancia = null
let instanciaKey = null

const SCOPES = ['openid', 'profile', 'email']

async function obtenerCliente({ clientId, tenantId }) {
  const key = `${clientId}|${tenantId}`
  if (instancia && instanciaKey === key) return instancia

  const { PublicClientApplication } = await import('@azure/msal-browser')
  instancia = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      // Página en blanco para el popup y el ingreso silencioso; registrar esta URL como "SPA redirect URI" en Entra ID
      redirectUri: new URL('redirect.html', window.location.href.split('#')[0]).href,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await instancia.initialize()
  instanciaKey = key
  return instancia
}

/**
 * Ingreso automático, sin ventana: usa la sesión de Microsoft/Windows que ya tiene el usuario.
 * Devuelve el id_token, o null si no hay sesión utilizable (entonces se muestra el botón).
 */
export async function intentarIngresoSilencioso(config) {
  try {
    const cliente = await obtenerCliente(config)
    const cuenta = cliente.getAllAccounts()[0]
    const resultado = cuenta
      ? await cliente.acquireTokenSilent({ scopes: SCOPES, account: cuenta })
      : await cliente.ssoSilent({ scopes: SCOPES })
    return resultado.idToken || null
  } catch {
    // Sin sesión, requiere interacción o el navegador bloquea el inicio silencioso
    return null
  }
}

/**
 * Botón "Ingresar con Microsoft": abre el popup. Si ya hay sesión, Microsoft lo cierra solo sin pedir nada;
 * solo pide la cuenta cuando de verdad hace falta. Devuelve el id_token, o null si el usuario cerró la ventana.
 */
export async function obtenerIdTokenMicrosoft(config) {
  const cliente = await obtenerCliente(config)
  try {
    const resultado = await cliente.loginPopup({ scopes: SCOPES })
    return resultado.idToken
  } catch (err) {
    if (err?.errorCode === 'user_cancelled') return null
    throw err
  }
}

// Tras cerrar sesión a mano no se vuelve a entrar automáticamente en esta pestaña
const CLAVE_SIN_AUTOMATICO = 'loginMicrosoftAutomatico'
export const desactivarIngresoAutomatico = () => {
  try { sessionStorage.setItem(CLAVE_SIN_AUTOMATICO, 'no') } catch { /* sin almacenamiento */ }
}
export const reactivarIngresoAutomatico = () => {
  try { sessionStorage.removeItem(CLAVE_SIN_AUTOMATICO) } catch { /* sin almacenamiento */ }
}
export const ingresoAutomaticoPermitido = () => {
  try { return sessionStorage.getItem(CLAVE_SIN_AUTOMATICO) !== 'no' } catch { return true }
}
