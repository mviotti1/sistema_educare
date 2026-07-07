import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import BottomTabs from '../components/BottomTabs';
import ClasesView from '../components/reservas/ClasesView';
import EditarView from '../components/reservas/EditarView';
import AgendarView from '../components/reservas/AgendarView';
import DisponibilidadView from '../components/disponibilidad/DisponibilidadView';
import ProfesoresView from '../components/disponibilidad/ProfesoresView';
import MateriasView from '../components/disponibilidad/MateriasView';
import AlumnosView from '../components/alumnos/AlumnosView';
import CalendarioView from '../components/calendario/CalendarioView';

const TABS_RESERVAS = [
  { id: 'clases',  label: 'Clases'  },
  { id: 'agendar', label: 'Agendar' },
];

const TABS_PROF = [
  { id: 'profesores',     label: 'Profesores'     },
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'materias',       label: 'Materias'       },
];

export default function App() {
  const [section, setSection]         = useState('reservas');
  const [subTab, setSubTab]           = useState('clases');
  const [subTabDisp, setSubTabDisp]   = useState('profesores');
  const [editando, setEditando]         = useState(null);
  const [meta, setMeta]                 = useState(null);
  const [toast, setToast]               = useState(null);
  const [filtroClases, setFiltroClases] = useState(null);
  const [reloadClases, setReloadClases]   = useState(0);
  const [notificados, setNotificados]     = useState(new Set());
  const contentRef                    = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function cargarMeta() {
      fetch('/api/meta')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => { if (!cancelled) setMeta(data); })
        .catch(() => { if (!cancelled) setTimeout(cargarMeta, 5000); });
    }
    cargarMeta();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const sync = () => fetch('/api/sync-calendar', { method: 'POST' }).catch(() => {});
    const id   = setInterval(sync, 20 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
    const CLAVE     = 'purge_last_run';
    let ultimo = 0;
    try { ultimo = Number(localStorage.getItem(CLAVE) || 0); } catch {}
    if (Date.now() - ultimo < SEMANA_MS) return;
    fetch('/api/purge', { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        try { localStorage.setItem(CLAVE, String(Date.now())); } catch {}
        if (d.purgadas > 0) console.log(`[purge] ${d.purgadas} clases canceladas antiguas eliminadas`);
        if (d.warning) console.warn('[purge]', d.warning);
      })
      .catch(e => console.error('[purge] error:', e));
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function animateTransition(callback) {
    import('animejs').then(({ animate }) => {
      if (!contentRef.current) { callback(); return; }
      animate(contentRef.current, {
        opacity: [1, 0],
        translateY: [0, -10],
        duration: 110,
        ease: 'inQuart',
        onComplete: () => {
          callback();
          requestAnimationFrame(() => {
            animate(contentRef.current, {
              opacity: [0, 1],
              translateY: [12, 0],
              duration: 220,
              ease: 'outQuart',
            });
          });
        },
      });
    });
  }

  function handleTabChange(tab) {
    animateTransition(() => {
      setSubTab(tab);
      setEditando(null);
      if (tab !== 'clases') setFiltroClases(null);
    });
  }

  function handleSectionChange(s) {
    if (s === section) return;
    animateTransition(() => {
      setSection(s);
      setEditando(null);
      setFiltroClases(null);
    });
  }

  function irAClase(clase) {
    animateTransition(() => {
      setSection('reservas');
      setSubTab('clases');
      setEditando(null);
      setFiltroClases({
        id_clase: String(clase.id_clase),
        duracion: '', fecha: '', hora_inicio: '', hora_fin: '',
        alumno: '', profesor: '', materia: '', modalidad: '', estado: '',
      });
    });
  }

  if (!meta) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EDF2F7',
      gap: 16,
    }}>
      <img src="/logoEducare.png" alt="Educare" style={{ height: 64, opacity: 0.85 }} />
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#A0B8CC', letterSpacing: '0.08em' }}>
        cargando...
      </span>
    </div>
  );

  const enEdicion = !!editando;

  return (
    <div className="app-shell">
      <Header active={section} onChange={handleSectionChange} />

      <main className="main">
        <div ref={contentRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {section === 'reservas' && (
            <>
              <div className="section-content">
                {enEdicion ? (
                  <EditarView
                    clase={editando}
                    meta={meta}
                    onBack={() => setEditando(null)}
                    onSaved={(changed) => { setEditando(null); setReloadClases(r => r + 1); if (changed) setNotificados(new Set()); }}
                    onDeleted={() => { setEditando(null); setSubTab('clases'); }}
                    showToast={showToast}
                  />
                ) : subTab === 'clases' ? (
                  <ClasesView onSelect={setEditando} meta={meta} filtroInicial={filtroClases} reloadSignal={reloadClases} showToast={showToast} notificados={notificados} setNotificados={setNotificados} />
                ) : (
                  <AgendarView
                    meta={meta}
                    onCreated={() => handleTabChange('clases')}
                    showToast={showToast}
                  />
                )}
              </div>
              <BottomTabs tabs={TABS_RESERVAS} active={subTab} onChange={handleTabChange} />
            </>
          )}

          {section === 'alumnos' && (
            <div className="section-content">
              <AlumnosView showToast={showToast} />
            </div>
          )}

          {section === 'calendario' && (
            <div className="section-content">
              <CalendarioView meta={meta} showToast={showToast} onIrAClase={irAClase} />
            </div>
          )}

          {section === 'profesores' && (
            <>
              <div className="section-content">
                {subTabDisp === 'profesores' ? (
                  <ProfesoresView showToast={showToast} />
                ) : subTabDisp === 'materias' ? (
                  <MateriasView showToast={showToast} meta={meta} />
                ) : (
                  <DisponibilidadView meta={meta} showToast={showToast} />
                )}
              </div>
              <BottomTabs tabs={TABS_PROF} active={subTabDisp} onChange={setSubTabDisp} />
            </>
          )}
        </div>
      </main>

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
