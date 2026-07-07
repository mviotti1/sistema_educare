const NAV = [
  {
    id: 'reservas',
    label: 'Reservas',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'profesores',
    label: 'Profesores',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>
      </svg>
    ),
  },
  {
    id: 'alumnos',
    label: 'Alumnos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: 'calendario',
    label: 'Calendario',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
];

export default function Header({ active, onChange }) {
  return (
    <header className="header">
      <div className="header-logo">
        <img src="/logoEducare.png" alt="Educare" />
        <span className="header-logo-name">Educare</span>
      </div>
      <div className="header-sep" />
      <nav style={{ display: 'flex', gap: 3 }}>
        {NAV.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`header-btn${active === id ? ' active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="header-btn-bg" />
            <span className="header-btn-content">
              {icon}
              {label}
            </span>
          </button>
        ))}
      </nav>
    </header>
  );
}
