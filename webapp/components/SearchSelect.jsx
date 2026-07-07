import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function SearchSelect({
  value,
  onChange,
  options = [],
  placeholder = '— Seleccionar —',
  className = '',
  disabled = false,
  style,
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [dropPos, setDropPos] = useState(null);
  const [mounted, setMounted] = useState(false);

  const wrapRef    = useRef(null);
  const triggerRef = useRef(null);
  const inputRef   = useRef(null);
  const dropRef    = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => { setMounted(true); }, []);

  function computePos() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropW = Math.max(r.width, 220);
    const ESTIMATE_H = 280;

    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const openUp = spaceBelow < ESTIMATE_H && spaceAbove > spaceBelow;

    const wouldOverflowRight = r.left + dropW > window.innerWidth - 8;
    const triggerIsRightSide = r.left > window.innerWidth * 0.45;
    const useRight = wouldOverflowRight || triggerIsRightSide;

    const vertPos = openUp
      ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(spaceAbove, ESTIMATE_H) }
      : { top: r.bottom + 4,                      maxHeight: Math.min(spaceBelow, ESTIMATE_H) };

    const horizPos = useRight
      ? { right: window.innerWidth - r.right }
      : { left: r.left };

    setDropPos({ minWidth: dropW, ...vertPos, ...horizPos });
  }

  useEffect(() => {
    if (open) {
      computePos();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    function onDown(e) {
      const inWrap = wrapRef.current?.contains(e.target);
      const inDrop = dropRef.current?.contains(e.target);
      if (!inWrap && !inDrop) { setOpen(false); setQuery(''); }
    }
    function onScroll() { if (open) computePos(); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    setOpen(o => { if (o) setQuery(''); return !o; });
  }

  function pick(val) {
    onChange({ target: { value: val } });
    setOpen(false);
    setQuery('');
  }

  const dropdown = open && dropPos && (
    <div ref={dropRef} className="ss-drop" style={{ position: 'fixed', zIndex: 9999, ...dropPos }}>
      <div className="ss-search-wrap">
        <input
          ref={inputRef}
          className="ss-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar..."
        />
      </div>
      <div className="ss-opts">
        <div className={`ss-opt ${!value ? 'ss-active' : ''}`} onMouseDown={() => pick('')}>
          <span className="ss-ph">{placeholder}</span>
        </div>
        {filtered.map(o => (
          <div
            key={o.value}
            className={`ss-opt ${String(o.value) === String(value) ? 'ss-active' : ''}`}
            onMouseDown={() => pick(String(o.value))}
          >
            {o.label}
          </div>
        ))}
        {filtered.length === 0 && query && (
          <div className="ss-no-res">Sin resultados</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="ss-wrap" ref={wrapRef} style={style}>
      <button type="button" ref={triggerRef} className={`ss-trigger ${className}`} onClick={toggle} disabled={disabled}>
        <span className={!selected ? 'ss-ph' : ''}>
          {selected ? selected.label : placeholder}
        </span>
        {!disabled && <span className="ss-caret">{open ? '▴' : '▾'}</span>}
      </button>
      {mounted && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
