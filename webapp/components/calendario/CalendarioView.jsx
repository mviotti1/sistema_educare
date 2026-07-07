import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { resolveClase, ESTADOS, ESTADO_COLORS, ESTADO_LABELS } from '../../lib/clases';
import SearchSelect from '../SearchSelect';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const H_START = 9;
const H_END   = 21;
const PX_H    = 64;

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function mondayOf(d) { const day = d.getDay(); return addDays(d, day === 0 ? -6 : 1 - day); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function parseH(s) {
  if (!s && s !== 0) return 0;
  // Sheets puede devolver decimales (0.4167 = 10:00) con UNFORMATTED_VALUE
  if (typeof s === 'number') return s * 24;
  if (typeof s !== 'string' || !s.includes(':')) return 0;
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
}
function colOf(clase) { return ESTADO_COLORS[String(clase.id_estado)] || ESTADO_COLORS['6']; }

function PopupEvento({ clase, onClose, onIrAClase }) {
  const col = colOf(clase);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cal-popup-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-popup">
        <button className="cal-popup-close" onClick={onClose}>✕</button>
        <div className="cal-popup-estado" style={{ background: col.bg, borderColor: col.bd, color: col.fg }}>
          {ESTADO_LABELS[String(clase.id_estado)] || clase.estado || '—'}
        </div>
        <div className="cal-popup-alumno">{clase.nombre_alumno || '—'}</div>
        <div className="cal-popup-rows">
          <div className="cal-popup-row"><span>Profesor</span>  <span>{clase.nombre_profesor || '—'}</span></div>
          <div className="cal-popup-row"><span>Materia</span>   <span>{clase.nombre_materia  || '—'}</span></div>
          <div className="cal-popup-row"><span>Fecha</span>     <span>{clase.fecha           || '—'}</span></div>
          <div className="cal-popup-row">
            <span>Horario</span>
            <span>{clase.hora_inicio} – {clase.hora_fin} ({clase.duracion} min)</span>
          </div>
          <div className="cal-popup-row"><span>Modalidad</span> <span>{clase.modalidad       || '—'}</span></div>
        </div>
        {clase.descripcion && (
          <div className="cal-popup-desc">{clase.descripcion}</div>
        )}
        {onIrAClase && (
          <button className="cal-popup-ir" onClick={() => { onIrAClase(clase); onClose(); }}>
            Ir a la clase →
          </button>
        )}
      </div>
    </div>
  );
}

const PANEL_W = 260;
const PANEL_MAX_H = 320;

function DayPanel({ day, clases, rect, onClickClase, onClose }) {
  const panelRef = useRef(null);

  let left = rect.right + 6;
  let top  = rect.top;
  if (left + PANEL_W > window.innerWidth - 8) left = rect.left - PANEL_W - 6;
  if (top + PANEL_MAX_H > window.innerHeight - 8) top = window.innerHeight - PANEL_MAX_H - 8;
  top = Math.max(8, top);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onMouse(e) { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onMouse); };
  }, [onClose]);

  const dayLabel = DIAS_CORTO[(day.getDay() + 6) % 7];

  return createPortal(
    <div ref={panelRef} className="cal-day-panel" style={{ left, top, width: PANEL_W }}>
      <div className="cal-day-panel-header">
        <span>{dayLabel} {day.getDate()} {MESES[day.getMonth()]}</span>
        <button className="cal-day-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="cal-day-panel-list">
        {clases.map(c => {
          const col = colOf(c);
          return (
            <div key={c.id_clase} className="cal-day-panel-row" onClick={() => { onClickClase(c); onClose(); }}>
              <span className="cal-day-panel-dot" style={{ background: col.bg, borderColor: col.bd }} />
              <span className="cal-day-panel-hora">{c.hora_inicio}</span>
              <span className="cal-day-panel-nombre">{c.nombre_alumno}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

function MesView({ clases, cursor, today, onClickClase, onClickDia }) {
  const [panel, setPanel] = useState(null);
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDay = mondayOf(firstOfMonth);
  const weeks = [];
  let day = new Date(startDay);
  for (let w = 0; w < 5; w++) {
    const week = [];
    for (let di = 0; di < 7; di++) { week.push(new Date(day)); day = addDays(day, 1); }
    weeks.push(week);
  }

  function openPanel(e, d, dayClases) {
    e.stopPropagation();
    const cell = e.currentTarget.closest('.cal-mes-day');
    const rect = cell ? cell.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
    setPanel({ day: d, clases: dayClases, rect });
  }

  return (
    <div className="cal-mes">
      <div className="cal-mes-header">
        {DIAS_CORTO.map(d => <div key={d} className="cal-mes-col-label">{d}</div>)}
      </div>
      <div className="cal-mes-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="cal-mes-week">
            {week.map((d, di) => {
              const ds = dateStr(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = isSameDay(d, today);
              const dayClases = clases.filter(c => c.fecha === ds)
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
              const MAX_VISIBLE = 2;
              const visible   = dayClases.slice(0, MAX_VISIBLE);
              const remaining = dayClases.length - MAX_VISIBLE;
              return (
                <div key={di} className={`cal-mes-day${!inMonth ? ' out-month' : ''}${isToday ? ' is-today' : ''}${d.getDay() === 0 ? ' is-sunday' : ''}`}>
                  <span className={`cal-day-num${isToday ? ' today-dot' : ''} cal-day-num--clickable`} onClick={() => onClickDia(d)}>{d.getDate()}</span>
                  <div className="cal-mes-events">
                    {visible.map(c => {
                      const col = colOf(c);
                      return (
                        <div
                          key={c.id_clase}
                          className={`cal-chip${c.modalidad === 'VIRTUAL' ? ' cal-chip-virtual' : ''}`}
                          style={{ background: col.bg, borderColor: col.bd, color: col.fg }}
                          onClick={() => onClickClase(c)}
                        >
                          <span className="cal-chip-hora">{c.hora_inicio}</span>
                          <span className="cal-chip-nombre">{c.nombre_alumno}</span>
                        </div>
                      );
                    })}
                  </div>
                  {remaining > 0 && (
                    <div className="cal-chip-mas" onClick={e => openPanel(e, d, dayClases)}>
                      +{remaining} {remaining === 1 ? 'más' : 'más'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {panel && (
        <DayPanel
          day={panel.day}
          clases={panel.clases}
          rect={panel.rect}
          onClickClase={onClickClase}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

// Asigna columnas a eventos solapados dentro de un día.
// Retorna [{ event, col, totalCols }] donde col es el índice (0-based)
// y totalCols es cuántas columnas ocupa el grupo de solapamiento.
function layoutEvents(events) {
  if (!events.length) return [];

  const sorted = [...events].sort((a, b) => {
    const d = parseH(a.hora_inicio) - parseH(b.hora_inicio);
    return d !== 0 ? d : parseH(b.hora_fin) - parseH(a.hora_fin);
  });

  // Greedy: cada evento va a la primera columna cuyo último evento ya terminó
  const colEnds = []; // tiempo de fin del último evento en cada columna
  const assigned = sorted.map(event => {
    const s = parseH(event.hora_inicio);
    const e = Math.max(parseH(event.hora_fin), s + 0.25);
    let col = colEnds.findIndex(end => end <= s);
    if (col === -1) { col = colEnds.length; colEnds.push(e); }
    else colEnds[col] = e;
    return { event, col };
  });

  // Para cada evento: cuántas columnas hay activas al mismo tiempo (el grupo de overlap)
  return assigned.map(({ event, col }) => {
    const s = parseH(event.hora_inicio);
    const e = Math.max(parseH(event.hora_fin), s + 0.25);
    const group = assigned.filter(r => {
      const rs = parseH(r.event.hora_inicio);
      const re = Math.max(parseH(r.event.hora_fin), rs + 0.25);
      return rs < e && re > s;
    });
    const totalCols = Math.max(...group.map(r => r.col)) + 1;
    return { event, col, totalCols };
  });
}

function TimeGrid({ dias, clases, today, onClickClase, onClickDia, onPrev, onNext }) {
  const horas = [];
  for (let h = H_START; h < H_END; h++) horas.push(h);
  const totalH = (H_END - H_START) * PX_H;
  const N = dias.length;

  return (
    <div className="cal-tgrid-wrap">
      {N === 1 && <button className="cal-dia-arrow cal-dia-arrow--prev" onClick={onPrev}>‹</button>}
      {N === 1 && <button className="cal-dia-arrow cal-dia-arrow--next" onClick={onNext}>›</button>}
      <div className="cal-tgrid-header" style={{ gridTemplateColumns: `60px repeat(${N}, 1fr)` }}>
        <div className="cal-tgrid-corner" />
        {dias.map(({ date, label }) => {
          const isToday  = isSameDay(date, today);
          const isSunday = date.getDay() === 0;
          return (
            <div key={dateStr(date)} className={`cal-tgrid-dayhdr${isToday ? ' is-today' : ''}${isSunday ? ' is-sunday' : ''}`}>
              <span className="cal-tgrid-dayname">{label}</span>
              <span className={`cal-tgrid-daynum${isToday ? ' today-dot' : ''} cal-day-num--clickable`} onClick={() => onClickDia(date)}>{date.getDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="cal-tgrid-body">
        <div className="cal-tgrid-hours" style={{ height: totalH }}>
          {horas.map(h => (
            <div key={h} className="cal-tgrid-hourlbl" style={{ top: (h - H_START) * PX_H }}>
              {pad(h)}:00
            </div>
          ))}
        </div>
        <div className="cal-tgrid-days" style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, height: totalH }}>
          {dias.map(({ date }) => {
            const ds        = dateStr(date);
            const dayClases = clases.filter(c => c.fecha === ds);
            const isSun     = date.getDay() === 0;
            return (
              <div key={ds} className={`cal-tgrid-daycol${isSun ? ' is-sunday' : ''}`} style={{ height: totalH }}>
                {horas.map(h => (
                  <div key={h} className="cal-tgrid-hline" style={{ top: (h - H_START) * PX_H }} />
                ))}
                {layoutEvents(dayClases).map(({ event: c, col: colIdx, totalCols }) => {
                  const top    = (parseH(c.hora_inicio) - H_START) * PX_H;
                  const height = (parseH(c.hora_fin) - parseH(c.hora_inicio)) * PX_H;
                  if (top < 0 || top >= totalH) return null;
                  const evColor  = colOf(c);
                  const GAP      = 2;
                  const narrow   = totalCols >= 4;
                  const medium   = totalCols === 3;
                  return (
                    <div
                      key={c.id_clase}
                      className={`cal-event${c.modalidad === 'VIRTUAL' ? ' cal-event-virtual' : ''}${totalCols > 1 ? ' cal-event-stacked' : ''}`}
                      style={{
                        top:         top + 1,
                        height:      Math.max(22, height - 3),
                        background:  evColor.bg,
                        borderColor: evColor.bd,
                        color:       evColor.fg,
                        left:        `calc(${colIdx / totalCols * 100}% + ${GAP}px)`,
                        width:       `calc(${1 / totalCols * 100}% - ${GAP * 2}px)`,
                        right:       'auto',
                        zIndex:      colIdx + 1,
                      }}
                      onClick={() => onClickClase(c)}
                    >
                      {!narrow && (
                        <div className="cal-event-hora">{c.hora_inicio}–{c.hora_fin}</div>
                      )}
                      <div className={`cal-event-alumno${narrow ? ' cal-event-alumno--xs' : ''}`}>
                        {c.nombre_alumno}
                      </div>
                      {height >= 52 && !medium && !narrow && (
                        <div className="cal-event-materia">{c.nombre_materia}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CalendarioView({ meta, showToast, onIrAClase }) {
  const [clases, setClases]     = useState([]);
  const [cargando, setCargando] = useState(false);
  const [syncando, setSyncando] = useState(false);
  const [view, setView]         = useState('semana');
  const [cursor, setCursor]     = useState(new Date());
  const [popup, setPopup]       = useState(null);
  const [filtros, setFiltros]   = useState({ profesor: '', materia: '', estado: '' });

  const today = new Date();

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/clases');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setClases(data.map(c => resolveClase(c, meta)));
    } catch (err) {
      console.error('[CalendarioView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  async function sincronizarGCal() {
    setSyncando(true);
    try {
      const res  = await fetch('/api/sync-calendar', { method: 'POST' });
      const data = await res.json();
      showToast?.(`GCal: ${data.created} creados, ${data.updated} actualizados, ${data.skipped} sin cambios`);
      await cargar();
    } catch {
      showToast?.('Error al sincronizar Google Calendar', 'error');
    } finally {
      setSyncando(false);
    }
  }

  const sf = (k, v) => setFiltros(p => ({ ...p, [k]: v }));
  const hayFiltros = filtros.profesor || filtros.materia || filtros.estado;

  const clasesFiltradas = clases.filter(c => {
    if (filtros.profesor && String(c.id_profesor) !== filtros.profesor) return false;
    if (filtros.materia  && String(c.id_materia)  !== filtros.materia)  return false;
    if (filtros.estado   && String(c.id_estado)   !== filtros.estado)   return false;
    return true;
  });

  function navPrev() {
    setCursor(prev => {
      if (view === 'mes')    { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; }
      if (view === 'semana') return addDays(prev, -7);
      return addDays(prev, -1);
    });
  }
  function navNext() {
    setCursor(prev => {
      if (view === 'mes')    { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; }
      if (view === 'semana') return addDays(prev, 7);
      return addDays(prev, 1);
    });
  }
  function goHoy() { setCursor(new Date()); }
  function goDay(date) { setCursor(date); setView('dia'); }

  function navLabel() {
    if (view === 'mes') return `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === 'semana') {
      const mon = mondayOf(cursor);
      const sun = addDays(mon, 6);
      if (mon.getMonth() === sun.getMonth())
        return `${mon.getDate()} – ${sun.getDate()} de ${MESES[sun.getMonth()]} ${sun.getFullYear()}`;
      return `${mon.getDate()} ${MESES[mon.getMonth()].slice(0,3)} – ${sun.getDate()} ${MESES[sun.getMonth()].slice(0,3)} ${sun.getFullYear()}`;
    }
    const dayIdx = (cursor.getDay() + 6) % 7;
    return `${DIAS_CORTO[dayIdx]} ${cursor.getDate()} de ${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`;
  }

  const monday = mondayOf(cursor);
  const semanaDias = DIAS_CORTO.map((label, i) => ({ date: addDays(monday, i), label }));
  const diaDias    = [{ date: cursor, label: DIAS_CORTO[(cursor.getDay() + 6) % 7] }];

  const profOpts    = (meta.profesores || []).map(p => ({ value: String(p.id), label: p.nombre }));
  const materiaOpts = (meta.materias   || []).map(m => ({ value: String(m.id), label: m.label || m.nombre }));
  const estadoOpts  = ESTADOS.map(e => ({ value: e.id, label: e.nombre }));

  return (
    <div className="cal-shell">
      <div className="cal-toolbar">
        <div className="cal-view-btns">
          {[['mes','Mes'],['semana','Semana'],['dia','Día']].map(([v, l]) => (
            <button key={v} className={`cal-view-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
              <span>{l}</span>
            </button>
          ))}
        </div>

        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={navPrev}>‹</button>
          <button className="cal-nav-hoy" onClick={goHoy}>Hoy</button>
          <button className="cal-nav-btn" onClick={navNext}>›</button>
          <span className="cal-nav-label">{navLabel()}</span>
        </div>

        <div className="cal-filters">
          <SearchSelect
            className="cal-filter-pill"
            value={filtros.profesor}
            onChange={e => sf('profesor', e.target.value)}
            options={profOpts}
            placeholder="Profesor"
            style={{ minWidth: 0 }}
          />
          <SearchSelect
            className="cal-filter-pill"
            value={filtros.materia}
            onChange={e => sf('materia', e.target.value)}
            options={materiaOpts}
            placeholder="Materia"
            style={{ minWidth: 0 }}
          />
          <SearchSelect
            className="cal-filter-pill"
            value={filtros.estado}
            onChange={e => sf('estado', e.target.value)}
            options={estadoOpts}
            placeholder="Estado"
            style={{ minWidth: 0 }}
          />
          {hayFiltros && (
            <button
              className="cal-filter-clear"
              onClick={() => setFiltros({ profesor: '', materia: '', estado: '' })}
            >
              ✕ Limpiar
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ height: 30, padding: '0 10px', fontSize: 11, marginLeft: 'auto' }}
            onClick={sincronizarGCal}
            disabled={syncando}
            title="Sincronizar clases sin evento en Google Calendar"
          >
            {syncando ? 'Sincronizando...' : '↻ Sync GCal'}
          </button>
        </div>
      </div>

      <div className="cal-body">
        {cargando ? (
          <div className="loading">Cargando clases...</div>
        ) : view === 'mes' ? (
          <MesView clases={clasesFiltradas} cursor={cursor} today={today} onClickClase={setPopup} onClickDia={goDay} />
        ) : (
          <TimeGrid
            dias={view === 'semana' ? semanaDias : diaDias}
            clases={clasesFiltradas}
            today={today}
            onClickClase={setPopup}
            onClickDia={goDay}
            onPrev={navPrev}
            onNext={navNext}
          />
        )}
      </div>

      {popup && <PopupEvento clase={popup} onClose={() => setPopup(null)} onIrAClase={onIrAClase} />}
    </div>
  );
}
