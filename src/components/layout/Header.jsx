import { useTema } from '../../theme'

export default function Header({ title, sub }) {
  const [tema, alternarTema] = useTema()

  return (
    <header className="header">
      <div>
        <h1 className="header-title">{title}</h1>
        {sub && <div className="header-sub">{sub}</div>}
      </div>
      <div className="header-actions">
        <button className="theme-toggle" onClick={alternarTema} title="Cambiar tema">
          {tema === 'dark' ? '☀️ Tema claro' : '🌙 Tema oscuro'}
        </button>
      </div>
    </header>
  )
}
