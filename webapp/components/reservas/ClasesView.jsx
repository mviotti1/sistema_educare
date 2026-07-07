import { useState, useEffect, useRef } from 'react';
import { HORARIOS } from '../../lib/horarios';
import { ESTADOS, ESTADO_COLORS, ESTADO_LABELS, resolveClase } from '../../lib/clases';
import SearchSelect from '../SearchSelect';
import DatePicker from '../DatePicker';

const EMPTY_F = {
  id_clase: '', duracion: '', fecha: '', fecha_desde: '', fecha_hasta: '',
  hora_inicio: '', hora_fin: '',
  alumno: '', profesor: '', materia: '', modalidad: '', estado: '',
};

const ESTADOS_NOTIFICAR = new Set(['1', '3', '4', '5']);

export default function ClasesView({ onSelect, meta, filtroInicial, reloadSignal, showToast, notificados, setNotificados }) {
  const [todas, setTodas]       = useState([]);
  const [visibles, setVisibles] = useState([]);
  const [filtros, setFiltros]   = useState(filtroInicial || EMPTY_F);
  const [orden, setOrden]       = useState('id_desc');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(new Set());
  const tbodyRef                    = useRef(null);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reloadSignal > 0) cargar();
  }, [reloadSignal]);

  function aplicarFiltros(clases, f) {
    return clases.filter(c => {
      if (f.id_clase    && !String(c.id_clase).includes(f.id_clase.trim())) return false;
      if (f.duracion    && String(c.duracion) !== f.duracion)               return false;
      if (f.fecha       && c.fecha !== f.fecha)          return false;
      if (f.fecha_desde && c.fecha < f.fecha_desde)     return false;
      if (f.fecha_hasta && c.fecha > f.fecha_hasta)     return false;
      if (f.hora_inicio && c.hora_inicio !== f.hora_inicio)                 return false;
      if (f.hora_fin    && c.hora_fin !== f.hora_fin)                       return false;
      if (f.alumno   && String(c.id_alumno)   !== f.alumno)   return false;
      if (f.profesor && String(c.id_profesor) !== f.profesor) return false;
      if (f.materia  && String(c.id_materia)  !== f.materia)  return false;
      if (f.modalidad && c.modalidad !== f.modalidad)         return false;
      if (f.estado   && String(c.id_estado)   !== f.estado)   return false;
      return true;
    });
  }

  async function cargar() {
    setCargando(true);
    try {
      const res      = await fetch('/api/clases');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data     = await res.json();
      const resolved = data.map(c => resolveClase(c, meta))
        .sort((a, b) => Number(b.id_clase) - Number(a.id_clase));
      setTodas(resolved);
      setVisibles(aplicarFiltros(resolved, filtros));
    } catch (err) {
      console.error('[ClasesView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!cargando && visibles.length > 0 && tbodyRef.current) {
      import('animejs').then(({ animate, stagger }) => {
        const rows = Array.from(tbodyRef.current?.querySelectorAll('tr') || []).slice(0, 25);
        if (!rows.length) return;
        animate(rows, {
          opacity: [0, 1],
          translateY: [5, 0],
          duration: 200,
          delay: stagger(15),
          ease: 'outQuart',
        });
      });
    }
  }, [cargando, visibles]);

  function filtrar() {
    setVisibles(aplicarFiltros(todas, filtros));
  }

  function limpiar() { setFiltros(EMPTY_F); setOrden('id_desc'); setVisibles(todas); }

  async function enviarNotificacion(clase) {
    const idClase = clase.id_clase;
    if (enviando.has(idClase) || notificados.has(idClase)) return;

    const profesor      = (meta?.profesores || []).find(p => String(p.id) === String(clase.id_profesor));
    const materiaObj    = (meta?.materias   || []).find(m => String(m.id) === String(clase.id_materia));
    const telefono      = profesor?.telefono || '';
    const nombre_materia = materiaObj?.nombre || '';
    const tipo_materia   = materiaObj?.tipo   || '';

    if (!telefono) {
      showToast?.('El profesor no tiene teléfono cargado', 'error');
      return;
    }

    setEnviando(prev => new Set(prev).add(idClase));
    try {
      const res = await fetch('/api/notificar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clase, telefono_profesor: telefono, nombre_materia, tipo_materia }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error al notificar');
      setNotificados(prev => new Set(prev).add(idClase));
      showToast?.('Notificación enviada', 'success');
    } catch (err) {
      console.error('[ClasesView] enviarNotificacion:', err);
      showToast?.(err.message || 'Error al enviar notificación', 'error');
    } finally {
      setEnviando(prev => { const s = new Set(prev); s.delete(idClase); return s; });
    }
  }

  const sf = (k, v) => setFiltros(p => ({ ...p, [k]: v }));

  const horaOpts    = HORARIOS.map(h => ({ value: h, label: h }));
  const durOpts     = [{ value: '60', label: '60 min' }, { value: '90', label: '90 min' }, { value: '120', label: '120 min' }];
  const alumnoOpts  = (meta?.alumnos   || []).map(a => ({ value: String(a.id), label: a.nombre }));
  const profOpts    = (meta?.profesores || []).map(p => ({ value: String(p.id), label: p.nombre }));
  const materiaOpts = (meta?.materias   || []).map(m => ({ value: String(m.id), label: m.label || m.nombre }));
  const modalOpts   = [{ value: 'PRESENCIAL', label: 'Presencial' }, { value: 'VIRTUAL', label: 'Virtual' }];
  const estadoOpts  = ESTADOS.map(e => ({ value: e.id, label: e.nombre }));

  return (
    <>
      <div className="filters">
        <div className="filter-field">
          <span className="filter-label">ID</span>
          <input className="filter-input w-sm" value={filtros.id_clase} onChange={e => sf('id_clase', e.target.value)} placeholder="—" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Duración</span>
          <SearchSelect className="filter-select" value={filtros.duracion}    onChange={e => sf('duracion',    e.target.value)} options={durOpts}     placeholder="Todas" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Fecha exacta</span>
          <DatePicker className="filter-input" value={filtros.fecha} onChange={v => sf('fecha', v)} placeholder="—" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Desde</span>
          <DatePicker className="filter-input" value={filtros.fecha_desde} onChange={v => sf('fecha_desde', v)} placeholder="—" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Hasta</span>
          <DatePicker className="filter-input" value={filtros.fecha_hasta} onChange={v => sf('fecha_hasta', v)} placeholder="—" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Hora inicio</span>
          <SearchSelect className="filter-select" value={filtros.hora_inicio} onChange={e => sf('hora_inicio', e.target.value)} options={horaOpts}    placeholder="Todas" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Hora fin</span>
          <SearchSelect className="filter-select" value={filtros.hora_fin}    onChange={e => sf('hora_fin',    e.target.value)} options={horaOpts}    placeholder="Todas" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Alumno</span>
          <SearchSelect className="filter-select" value={filtros.alumno}      onChange={e => sf('alumno',      e.target.value)} options={alumnoOpts}  placeholder="Todos" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Profesor</span>
          <SearchSelect className="filter-select" value={filtros.profesor}    onChange={e => sf('profesor',    e.target.value)} options={profOpts}    placeholder="Todos" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Materia</span>
          <SearchSelect className="filter-select" value={filtros.materia}     onChange={e => sf('materia',     e.target.value)} options={materiaOpts} placeholder="Todas" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Modalidad</span>
          <SearchSelect className="filter-select" value={filtros.modalidad}   onChange={e => sf('modalidad',   e.target.value)} options={modalOpts}   placeholder="Todas" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Estado</span>
          <SearchSelect className="filter-select" value={filtros.estado}      onChange={e => sf('estado',      e.target.value)} options={estadoOpts}  placeholder="Todos" />
        </div>
        <div className="filter-field">
          <span className="filter-label">Ordenar por</span>
          <SearchSelect
            className="filter-select"
            value={orden}
            onChange={e => setOrden(e.target.value)}
            options={[
              { value: 'id_desc',       label: 'ID (↓ reciente)'    },
              { value: 'fecha_desc',    label: 'Fecha ↓ (reciente)'  },
              { value: 'fecha_asc',     label: 'Fecha ↑ (antigua)'   },
              { value: 'profesor_asc',  label: 'Profesor A → Z'      },
              { value: 'profesor_desc', label: 'Profesor Z → A'      },
            ]}
            placeholder="—"
          />
        </div>
        <div className="filter-actions">
          <button className="btn btn-ghost" onClick={limpiar}>Limpiar</button>
          <button className="btn btn-primary" onClick={filtrar}>Filtrar</button>
          <button className="btn" onClick={cargar} title="Recargar desde Sheets">↻</button>
        </div>
      </div>

      <div className="table-wrap">
        {cargando ? (
          <div className="loading">Cargando clases...</div>
        ) : (
          <table className="clases-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Dur.</th>
                <th>Alumno</th>
                <th>Profesor</th>
                <th>Materia</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Link</th>
                <th style={{ textAlign: 'center' }}>Notificar</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {[...visibles].sort((a, b) => {
                if (orden === 'fecha_desc')    return (b.fecha || '') > (a.fecha || '') ? 1 : -1;
                if (orden === 'fecha_asc')     return (a.fecha || '') > (b.fecha || '') ? 1 : -1;
                if (orden === 'profesor_asc')  return (a.nombre_profesor || '').localeCompare(b.nombre_profesor || '', 'es');
                if (orden === 'profesor_desc') return (b.nombre_profesor || '').localeCompare(a.nombre_profesor || '', 'es');
                return 0;
              }).map(c => {
                const col   = ESTADO_COLORS[String(c.id_estado)] || ESTADO_COLORS['6'];
                const label = ESTADO_LABELS[String(c.id_estado)] || c.estado;
                const isVirtual   = c.modalidad === 'VIRTUAL';
                const isPendiente = String(c.id_estado) === '2';
                const rowClass    = [isVirtual && 'row-virtual', isPendiente && 'row-pendiente']
                  .filter(Boolean).join(' ');
                return (
                  <tr
                    key={c.id_clase}
                    className={rowClass}
                    onDoubleClick={() => onSelect(c)}
                    title="Doble click para editar"
                  >
                    <td className="td-id">{c.id_clase}</td>
                    <td className="td-fecha">{c.fecha}</td>
                    <td className="td-hora">{c.hora_inicio}</td>
                    <td className="td-hora">{c.hora_fin}</td>
                    <td className="td-dur">{c.duracion}</td>
                    <td>{c.nombre_alumno}</td>
                    <td>{c.nombre_profesor}</td>
                    <td>{c.nombre_materia}</td>
                    <td>{c.modalidad}</td>
                    <td>
                      <span
                        className="estado-chip"
                        style={{ background: col.bg, borderColor: col.bd, color: col.fg }}
                      >
                        {label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.modalidad === 'VIRTUAL' && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: c.link_clase ? '#8DC63F' : '#aaa' }}>
                          {c.link_clase ? 'CREADO' : 'NO CREADO'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ESTADOS_NOTIFICAR.has(String(c.id_estado)) && (
                        <button
                          title={notificados.has(c.id_clase) ? 'Notificación enviada' : 'Enviar notificación al profesor'}
                          disabled={enviando.has(c.id_clase)}
                          onClick={e => { e.stopPropagation(); enviarNotificacion(c); }}
                          style={{
                            width: 18, height: 18,
                            borderRadius: '50%',
                            border: `2px solid ${notificados.has(c.id_clase) ? '#8DC63F' : 'rgba(30,115,190,0.4)'}`,
                            background: notificados.has(c.id_clase) ? '#8DC63F' : 'transparent',
                            cursor: notificados.has(c.id_clase) ? 'default' : enviando.has(c.id_clase) ? 'wait' : 'pointer',
                            opacity: enviando.has(c.id_clase) ? 0.5 : 1,
                            display: 'inline-block',
                            padding: 0,
                            flexShrink: 0,
                            transition: 'background 0.2s, border-color 0.2s',
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && !cargando && (
                <tr><td colSpan={12} className="empty-state">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="row-hint">
        <span>{visibles.length} clase(s)</span>
        <span>Doble click para editar</span>
      </div>
    </>
  );
}
