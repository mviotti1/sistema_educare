import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
               'Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_HDR = ['L','M','X','J','V','S','D'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseYMD(s) {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}
function buildGrid(year, month) {
  const first  = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mon = 0
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return d;
  });
}

function CalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2.5" width="14" height="12.5" rx="2"/>
      <line x1="5"  y1="1" x2="5"  y2="4.5"/>
      <line x1="11" y1="1" x2="11" y2="4.5"/>
      <line x1="1"  y1="7" x2="15" y2="7"/>
    </svg>
  );
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className   = '',
  style,
  disabled,
}) {
  const today    = new Date();
  const todayStr = ymd(today);
  const initial  = parseYMD(value) || today;

  const [viewYear,  setViewYear]  = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [open,      setOpen]      = useState(false);
  const [navDir,    setNavDir]    = useState('next');
  const [animKey,   setAnimKey]   = useState(0);
  const [pos,       setPos]       = useState({ top: 0, left: 0, maxHeight: null, compact: false });
  const [mounted,   setMounted]   = useState(false);

  const triggerRef = useRef(null);
  const panelRef   = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    function onMouse(e) {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target))
        setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [open]);

  function openPicker() {
    if (disabled) return;
    // Sync view to current value when opening
    const d = parseYMD(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }

    const r = triggerRef.current.getBoundingClientRect();
    const W = 268;

    let left = r.left;
    if (left + W > window.innerWidth - 8) left = r.right - W;
    if (left < 8) left = 8;

    const top        = r.bottom + 6;
    const spaceBelow = window.innerHeight - top - 8;
    const COMPACT_H  = 230;

    if (spaceBelow < COMPACT_H) {
      // No cabe ni en modo compacto → abrir centrado como popup
      const centeredMaxH = window.innerHeight - 80;
      setPos({ centered: true, maxHeight: centeredMaxH, compact: centeredMaxH < 290 });
    } else {
      setPos({ top, left, maxHeight: spaceBelow, compact: spaceBelow < 290, centered: false });
    }
    setOpen(o => !o);
  }

  function navigate(dir) {
    setNavDir(dir > 0 ? 'next' : 'prev');
    setAnimKey(k => k + 1);
    setViewMonth(m => {
      const next = m + dir;
      if (next < 0)  { setViewYear(y => y - 1); return 11; }
      if (next > 11) { setViewYear(y => y + 1); return 0; }
      return next;
    });
  }

  function select(day) {
    onChange(ymd(day));
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange('');
  }

  const display = (() => {
    const d = parseYMD(value);
    if (!d) return null;
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  })();

  const grid = buildGrid(viewYear, viewMonth);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`dp-trigger${open ? ' dp-trigger--open' : ''}${!display ? ' dp-trigger--empty' : ''} ${className}`}
        style={style}
        onClick={openPicker}
        disabled={disabled}
      >
        <span className="dp-trigger-icon"><CalIcon /></span>
        <span className="dp-trigger-text">{display || placeholder}</span>
        {display
          ? <span className="dp-trigger-clear" onClick={clear}>✕</span>
          : <span className="dp-trigger-chevron">{open ? '▴' : '▾'}</span>
        }
      </button>

      {mounted && open && createPortal(
        <>
          {pos.centered && <div className="dp-overlay" onClick={() => setOpen(false)} />}
          <div
            ref={panelRef}
            className={`dp-panel${pos.compact ? ' dp-panel--compact' : ''}${pos.centered ? ' dp-panel--centered' : ''}`}
            style={pos.centered
              ? { maxHeight: pos.maxHeight, overflowY: 'auto' }
              : { top: pos.top, left: pos.left, maxHeight: pos.maxHeight, overflowY: 'auto' }
            }
          >
          <div className="dp-nav-row">
            <button className="dp-nav-btn" type="button" onClick={() => navigate(-1)}>‹</button>
            <span className="dp-month-name">{MESES[viewMonth]} {viewYear}</span>
            <button className="dp-nav-btn" type="button" onClick={() => navigate(1)}>›</button>
          </div>

          <div className="dp-weekdays">
            {DIAS_HDR.map(d => <div key={d} className="dp-wday">{d}</div>)}
          </div>

          <div className={`dp-grid dp-grid--${navDir}`} key={animKey}>
            {grid.map((day, i) => {
              const ds      = ymd(day);
              const inMonth = day.getMonth() === viewMonth;
              const isToday = ds === todayStr;
              const isSel   = ds === value;
              const isSun   = day.getDay() === 0;
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={inMonth ? 0 : -1}
                  className={[
                    'dp-day',
                    !inMonth && 'dp-day--out',
                    isToday  && 'dp-day--today',
                    isSel    && 'dp-day--sel',
                    isSun    && 'dp-day--sun',
                  ].filter(Boolean).join(' ')}
                  onClick={() => select(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
        </>,
        document.body
      )}
    </>
  );
}
