import { useState, useEffect } from 'react';
import { HORARIOS } from '../../lib/horarios';
import { ESTADOS, MODALIDADES } from '../../lib/clases';
import SearchSelect from '../SearchSelect';
import DatePicker from '../DatePicker';
import { useDialog } from '../../lib/useDialog';

const DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const EMPTY = {
  dia_semana: '', hora_inicio: '', hora_fin: '',
  id_alumno: '', nombre_alumno: '',
  id_profesor: '', nombre_profesor: '',
  id_materia: '', nombre_materia: '',
  id_modalidad: '', modalidad: '',
  id_estado: '', estado: '',
  fecha_inicio: '', fecha_fin: '',
};

function isValid(f) {
  return f.dia_semana && f.hora_inicio && f.hora_fin &&
    f.hora_inicio < f.hora_fin &&
    f.id_alumno && f.id_profesor && f.id_materia &&
    f.id_modalidad && f.id_estado;
}

export default function RecurrentesView({ showToast, meta }) {
  const { showConfirm, dialogNode } = useDialog();
  const [templates, setTemplates] = useState([]);
  const [cargando, setCargando]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [guardando, setGuardando] = useState(false);
  const [syncando, setSyncando]   = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/recurrentes');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setTemplates(await res.json());
    } catch (err) {
      console.error('[RecurrentesView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  function selectTemplate(t) {
    setAgregando(false);
    setSelected(t);
    setForm({ ...t });
  }

  function startAgregar() {
    setSelected(null);
    setAgregando(true);
    setForm({ ...EMPTY });
  }

  function cancelar() { setSelected(null); setAgregando(false); }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function setAlumno(id) {
    const a = (meta.alumnos || []).find(a => String(a.id) === id);
    setForm(p => ({ ...p, id_alumno: id, nombre_alumno: a ? a.nombre : '' }));
  }
  function setProfesor(id) {
    const p = (meta.profesores || []).find(p => String(p.id) === id);
    setForm(prev => ({ ...prev, id_profesor: id, nombre_profesor: p ? p.nombre : '' }));
  }
  function setMateria(id) {
    const m = (meta.materias || []).find(m => String(m.id) === id);
    setForm(p => ({ ...p, id_materia: id, nombre_materia: m ? m.nombre : '' }));
  }
  function setModalidad(id) {
    const m = MODALIDADES.find(m => String(m.id) === id);
    setForm(p => ({ ...p, id_modalidad: id, modalidad: m ? m.nombre : '' }));
  }
  function setEstado(id) {
    const e = ESTADOS.find(e => String(e.id) === id);
    setForm(p => ({ ...p, id_estado: id, estado: e ? e.nombre : '' }));
  }

  async function syncGCal() {
    setSyncando(true);
    try {
      const res  = await fetch('/api/recurrentes/sync-gcal', { method: 'POST' });
      const data = await res.json();
      showToast(`GCal: ${data.created} creados, ${data.updated} actualizados, ${data.skipped} omitidos`);
      await cargar();
    } catch {
      showToast('Error al sincronizar GCal', 'error');
    } finally {
      setSyncando(false);
    }
  }

  async function eliminar() {
    if (!await showConfirm(`¿Eliminar la clase fija de ${selected.nombre_alumno} los ${selected.dia_semana}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/recurrentes/${selected.id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Error al eliminar', 'error'); return; }
    setSelected(null);
    await cargar();
    showToast('Clase fija eliminada');
  }

  async function guardar() {
    if (!isValid(form)) return showToast('Completá todos los campos obligatorios', 'error');
    setGuardando(true);
    try {
      if (agregando) {
        const r = await fetch('/api/recurrentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!r.ok) { showToast((await r.json()).error || 'Error al crear', 'error'); return; }
        showToast('Clase fija creada');
      } else {
        const r = await fetch(`/api/recurrentes/${selected.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!r.ok) { showToast((await r.json()).error || 'Error al guardar', 'error'); return; }
        showToast('Clase fija actualizada');
      }
      cancelar();
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  const horaOpts    = HORARIOS.map(h => ({ value: h, label: h }));
  const diaOpts     = DIAS_SEMANA.map(d => ({ value: d, label: d }));
  const alumnoOpts  = (meta.alumnos   || []).map(a => ({ value: String(a.id), label: a.nombre }));
  const profOpts    = (meta.profesores || []).map(p => ({ value: String(p.id), label: p.nombre }));
  const materiaOpts = (meta.materias  || []).map(m => ({ value: String(m.id), label: m.label || m.nombre }));
  const modalOpts   = MODALIDADES.map(m => ({ value: String(m.id), label: m.label || m.nombre }));
  const estadoOpts  = ESTADOS.map(e => ({ value: String(e.id), label: e.nombre }));

  const panelVisible = !!(selected || agregando);

  return (
    <div className="recur-shell">
      <div className="recur-topbar">
        <span className="view-title">Clases fijas</span>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', height: 30, padding: '0 10px', fontSize: 11 }}
          onClick={syncGCal}
          disabled={syncando}
          title="Sincronizar todas las clases fijas con Google Calendar"
        >
          {syncando ? 'Sincronizando...' : '↻ Sync GCal'}
        </button>
        <button className="btn btn-primary" onClick={startAgregar}>
          + Nueva clase fija
        </button>
      </div>

      <div className="recur-layout">
        <div className="recur-table-col">
          <div className="table-wrap">
            {cargando ? (
              <div className="loading">Cargando...</div>
            ) : (
              <table className="clases-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Horario</th>
                    <th>Alumno</th>
                    <th>Profesor</th>
                    <th>Materia</th>
                    <th>Modalidad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr
                      key={t.id}
                      className={selected?.id === t.id ? 'row-selected' : ''}
                      onClick={() => selectTemplate(t)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><span className="recur-dia-badge">{t.dia_semana}</span></td>
                      <td className="td-hora">{t.hora_inicio}–{t.hora_fin}</td>
                      <td>{t.nombre_alumno}</td>
                      <td>{t.nombre_profesor}</td>
                      <td>{t.nombre_materia}</td>
                      <td className="td-muted">{t.modalidad}</td>
                      <td><span className="estado-chip">{t.estado}</span></td>
                    </tr>
                  ))}
                  {templates.length === 0 && !cargando && (
                    <tr><td colSpan={7} className="empty-state">Sin clases fijas definidas</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="row-hint">
            <span>{templates.length} clase{templates.length !== 1 ? 's' : ''} fija{templates.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {panelVisible && (
          <div className="alumnos-panel">
            <div className="panel-header">
              <span className="panel-title">
                {agregando ? 'Nueva clase fija' : `Clase fija #${selected.id}`}
              </span>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                {!agregando && (
                  <button className="bloque-btn-delete" onClick={eliminar} title="Eliminar">✕</button>
                )}
                <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={cancelar}>
                  Cancelar
                </button>
              </div>
            </div>

            <div className="panel-scroll">
              <div className="panel-section">
                <div className="panel-section-title">Horario</div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Día de la semana *</label>
                    <SearchSelect className="panel-input" value={form.dia_semana} onChange={e => set('dia_semana', e.target.value)} options={diaOpts} placeholder="— Día —" />
                  </div>
                  <div className="panel-field">
                    <label>Modalidad *</label>
                    <SearchSelect className="panel-input" value={form.id_modalidad} onChange={e => setModalidad(e.target.value)} options={modalOpts} placeholder="— Modalidad —" />
                  </div>
                </div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Hora inicio *</label>
                    <SearchSelect className="panel-input" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} options={horaOpts} placeholder="—" />
                  </div>
                  <div className="panel-field">
                    <label>Hora fin *</label>
                    <SearchSelect className="panel-input" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} options={horaOpts} placeholder="—" />
                  </div>
                </div>
                <div className="panel-row-2">
                  <div className="panel-field">
                    <label>Fecha inicio</label>
                    <DatePicker className="panel-input" value={form.fecha_inicio} onChange={v => set('fecha_inicio', v)} placeholder="Inicio" />
                  </div>
                  <div className="panel-field">
                    <label>Fecha fin</label>
                    <DatePicker className="panel-input" value={form.fecha_fin} onChange={v => set('fecha_fin', v)} placeholder="Fin" />
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Participantes</div>
                <div className="panel-field">
                  <label>Alumno *</label>
                  <SearchSelect className="panel-input" value={form.id_alumno} onChange={e => setAlumno(e.target.value)} options={alumnoOpts} placeholder="— Alumno —" />
                </div>
                <div className="panel-field">
                  <label>Profesor *</label>
                  <SearchSelect className="panel-input" value={form.id_profesor} onChange={e => setProfesor(e.target.value)} options={profOpts} placeholder="— Profesor —" />
                </div>
                <div className="panel-field">
                  <label>Materia *</label>
                  <SearchSelect className="panel-input" value={form.id_materia} onChange={e => setMateria(e.target.value)} options={materiaOpts} placeholder="— Materia —" />
                </div>
              </div>

              <div className="panel-section">
                <div className="panel-section-title">Estado</div>
                <div className="panel-field">
                  <label>Estado *</label>
                  <SearchSelect className="panel-input" value={form.id_estado} onChange={e => setEstado(e.target.value)} options={estadoOpts} placeholder="— Estado —" />
                </div>
              </div>

              <div className="panel-section">
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={guardar}
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : agregando ? 'Crear clase fija' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {dialogNode}
    </div>
  );
}
