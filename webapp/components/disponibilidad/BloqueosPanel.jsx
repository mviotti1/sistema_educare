import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
               'Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_HDR = ['L','M','X','J','V','S','D'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function buildGrid(year, month) {
  const first  = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon = 0
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}
// "2026-07-06" → "06/07/2026"
function ddmm(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}
// Expande [inicio, fin] (ISO) a la lista de días inclusive
function expandirRango(inicio, fin) {
  const [y1, m1, d1] = inicio.split('-').map(Number);
  const [y2, m2, d2] = fin.split('-').map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const out = [];
  while (cur <= end) { out.push(ymd(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

export default function BloqueosPanel({ prof, showToast, onClose, onChanged }) {
  const hoy      = new Date();
  const todayStr = ymd(hoy);

  const [bloqueos, setBloqueos]   = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [calOpen, setCalOpen]     = useState(false);
  const [selStart, setSelStart]   = useState(null);
  const [selEnd, setSelEnd]       = useState(null);
  const [viewYear, setViewYear]   = useState(hoy.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoy.getMonth());

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') calOpen ? cerrarCalendario() : onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [calOpen, onClose]);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/bloqueos?id_profesor=${encodeURIComponent(prof.id)}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setBloqueos(data.map(b => b.fecha).sort());
    } catch (err) {
      console.error('[BloqueosPanel] cargar:', err);
      showToast('Error al cargar bloqueos', 'error');
    } finally {
      setCargando(false);
    }
  }

  function cerrarCalendario() {
    setCalOpen(false);
    setSelStart(null);
    setSelEnd(null);
  }

  function clickDia(ds) {
    if (ds < todayStr) return;
    if (!selStart || selEnd) { setSelStart(ds); setSelEnd(null); return; }
    if (ds < selStart) { setSelEnd(selStart); setSelStart(ds); }
    else setSelEnd(ds);
  }

  const seleccion = selStart ? expandirRango(selStart, selEnd || selStart) : [];
  const nuevasSeleccion = seleccion.filter(f => !bloqueos.includes(f));

  async function handleAgregar() {
    if (!nuevasSeleccion.length) return;
    setGuardando(true);
    try {
      const res = await fetch('/api/bloqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_profesor: prof.id, fechas: nuevasSeleccion }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');
      setBloqueos(prev => [...new Set([...prev, ...nuevasSeleccion])].sort());
      cerrarCalendario();
      onChanged?.();
      showToast(`${nuevasSeleccion.length} fecha(s) bloqueada(s)`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(fecha) {
    const prev = bloqueos;
    setBloqueos(b => b.filter(f => f !== fecha));
    const res = await fetch(`/api/bloqueos?id_profesor=${encodeURIComponent(prof.id)}&fecha=${fecha}`, { method: 'DELETE' });
    if (!res.ok) {
      setBloqueos(prev);
      showToast((await res.json()).error || 'Error al eliminar', 'error');
      return;
    }
    onChanged?.();
  }

  function navigate(dir) {
    setViewMonth(m => {
      const next = m + dir;
      if (next < 0)  { setViewYear(y => y - 1); return 11; }
      if (next > 11) { setViewYear(y => y + 1); return 0; }
      return next;
    });
  }

  const grid = buildGrid(viewYear, viewMonth);
  const rangoIni = selStart;
  const rangoFin = selEnd || selStart;

  return createPortal(
    <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bq-card" role="dialog" aria-modal="true">
        <div className="bq-header">
          <div>
            <span className="bq-title">Fechas bloqueadas</span>
            <span className="bq-subtitle">{prof.nombre} {prof.apellido}</span>
          </div>
          <div className="bq-header-actions">
            <button className="btn btn-primary" onClick={() => calOpen ? cerrarCalendario() : setCalOpen(true)}>
              Agregar Fecha
            </button>
            <button className="bq-close" onClick={onClose} title="Cerrar">✕</button>
          </div>
        </div>

        {calOpen && (
          <div className="bq-cal">
            <div className="dp-nav-row">
              <button className="dp-nav-btn" type="button" onClick={() => navigate(-1)}>‹</button>
              <span className="dp-month-name">{MESES[viewMonth]} {viewYear}</span>
              <button className="dp-nav-btn" type="button" onClick={() => navigate(1)}>›</button>
            </div>
            <div className="dp-weekdays">
              {DIAS_HDR.map(d => <div key={d} className="dp-wday">{d}</div>)}
            </div>
            <div className="dp-grid">
              {grid.map((day, i) => {
                const ds       = ymd(day);
                const inMonth  = day.getMonth() === viewMonth;
                const pasado   = ds < todayStr;
                const isEdge   = ds === rangoIni || ds === rangoFin;
                const inRange  = rangoIni && ds > rangoIni && ds < rangoFin;
                const bloqueado = bloqueos.includes(ds);
                return (
                  <button
                    key={i}
                    type="button"
                    tabIndex={inMonth && !pasado ? 0 : -1}
                    disabled={pasado}
                    className={[
                      'dp-day',
                      !inMonth   && 'dp-day--out',
                      pasado     && 'dp-day--out',
                      ds === todayStr && 'dp-day--today',
                      isEdge     && 'dp-day--sel',
                      inRange    && 'bq-day--inrange',
                      bloqueado && !isEdge && !inRange && 'bq-day--blocked',
                    ].filter(Boolean).join(' ')}
                    onClick={() => clickDia(ds)}
                    title={bloqueado ? 'Ya bloqueado' : undefined}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="bq-cal-footer">
              <span className="bq-cal-hint">
                {!selStart
                  ? 'Seleccioná un día o el inicio de un rango'
                  : !selEnd
                    ? `${ddmm(selStart)} — clickeá el fin del rango (o Agregar para un solo día)`
                    : `${ddmm(selStart)} → ${ddmm(selEnd)} · ${seleccion.length} día(s)`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost" style={{ height: 28, fontSize: 12 }} onClick={cerrarCalendario}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  style={{ height: 28, fontSize: 12 }}
                  disabled={!selStart || !nuevasSeleccion.length || guardando}
                  onClick={handleAgregar}
                >
                  {guardando ? 'Guardando…' : `Agregar${selStart ? ` (${nuevasSeleccion.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bq-body">
          {cargando ? (
            <div className="loading">Cargando bloqueos...</div>
          ) : bloqueos.length === 0 ? (
            <div className="bq-empty">Sin fechas bloqueadas</div>
          ) : (
            <div className="bq-chips">
              {bloqueos.map(f => (
                <div key={f} className={`bq-chip${f < todayStr ? ' bq-chip--past' : ''}`}>
                  <span>{ddmm(f)}</span>
                  <button className="bq-chip-x" title="Eliminar bloqueo" onClick={() => handleEliminar(f)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
