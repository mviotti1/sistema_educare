import { useState } from 'react';
import { HORARIOS, calcDuracion, horaFinDesde } from '../../lib/horarios';
import { MODALIDADES, ESTADOS } from '../../lib/clases';
import SearchSelect from '../SearchSelect';
import DatePicker from '../DatePicker';

const DURATIONS = [60, 90, 120];

export default function ClaseForm({ inicial = {}, meta, onSubmit, submitLabel = 'Guardar', onDelete, readonlyHoraFin = false }) {
  const [f, setF] = useState(() => {
    // Si la clase existente no trae correos (vienen de rowToClase que no los incluye),
    // los buscamos en meta para que las notificaciones funcionen al guardar.
    const prof = inicial.id_profesor && meta?.profesores
      ? meta.profesores.find(x => String(x.id) === String(inicial.id_profesor))
      : null;
    const alum = inicial.id_alumno && meta?.alumnos
      ? meta.alumnos.find(x => String(x.id) === String(inicial.id_alumno))
      : null;
    return {
      fecha:                  inicial.fecha           || '',
      hora_inicio:            inicial.hora_inicio     || '',
      hora_fin:               inicial.hora_fin        || '',
      id_alumno:              inicial.id_alumno       || '',
      nombre_alumno:          inicial.nombre_alumno   || '',
      correo_alumno:          inicial.correo_alumno   || alum?.correo || '',
      id_profesor:            inicial.id_profesor     || '',
      nombre_profesor:        inicial.nombre_profesor || '',
      correo_profesor:        inicial.correo_profesor || prof?.correo || '',
      id_calendario_profesor: inicial.id_calendario_profesor || prof?.id_calendario || '',
      id_materia:             inicial.id_materia      || '',
      nombre_materia:         inicial.nombre_materia  || '',
      id_modalidad:           inicial.id_modalidad    || (MODALIDADES.find(m => m.nombre === inicial.modalidad)?.id || ''),
      modalidad:              inicial.modalidad       || '',
      id_estado:              inicial.id_estado       || '',
      estado:                 inicial.estado          || '',
      descripcion:            inicial.descripcion     || '',
      link_clase:             inicial.link_clase      || '',
    };
  });
  const [saving, setSaving] = useState(false);

  const duracion    = calcDuracion(f.hora_inicio, f.hora_fin);
  const durSelected = DURATIONS.includes(duracion) ? String(duracion) : '';

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  function handleDuracion(e) {
    const dur = parseInt(e.target.value);
    if (!dur || !f.hora_inicio) return;
    const fin = horaFinDesde(f.hora_inicio, dur);
    if (fin) set('hora_fin', fin);
  }

  function handleHoraInicio(val) {
    if (readonlyHoraFin && duracion > 0) {
      const fin = horaFinDesde(val, duracion);
      setF(p => ({ ...p, hora_inicio: val, hora_fin: fin || p.hora_fin }));
    } else {
      set('hora_inicio', val);
    }
  }

  function selAlumno(e) {
    const a = meta.alumnos.find(x => String(x.id) === e.target.value) || { id: '', nombre: '', correo: '' };
    setF(p => ({ ...p, id_alumno: a.id, nombre_alumno: a.nombre, correo_alumno: a.correo || '' }));
  }
  function selProfesor(e) {
    const p = meta.profesores.find(x => String(x.id) === e.target.value) || { id: '', nombre: '', correo: '', id_calendario: '' };
    setF(prev => ({ ...prev, id_profesor: p.id, nombre_profesor: p.nombre, correo_profesor: p.correo || '', id_calendario_profesor: p.id_calendario || '' }));
  }
  function selMateria(e) {
    const m = meta.materias.find(x => String(x.id) === e.target.value) || { id: '', nombre: '' };
    setF(p => ({ ...p, id_materia: m.id, nombre_materia: m.nombre }));
  }
  function selModalidad(e) {
    const m = MODALIDADES.find(x => x.id === e.target.value) || { id: '', nombre: '' };
    setF(p => ({ ...p, id_modalidad: m.id, modalidad: m.nombre, link_clase: m.nombre === 'VIRTUAL' ? p.link_clase : '' }));
  }
  function selEstado(e) {
    const es = ESTADOS.find(x => x.id === e.target.value) || { id: '', nombre: '' };
    setF(p => ({ ...p, id_estado: es.id, estado: es.nombre }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit(f);
    } finally {
      setSaving(false);
    }
  }

  const horaOpts      = HORARIOS.map(h => ({ value: h, label: h }));
  const durOpts       = DURATIONS.map(d => ({ value: String(d), label: `${d} min` }));
  const alumnoOpts    = meta.alumnos.map(a => ({ value: String(a.id), label: a.nombre }));
  const profesorOpts  = meta.profesores.map(p => ({ value: String(p.id), label: p.nombre }));
  const materiaOpts   = meta.materias.map(m => ({ value: String(m.id), label: m.label || m.nombre }));
  const modalidadOpts = MODALIDADES.map(m => ({ value: m.id, label: m.label }));
  const estadoOpts    = ESTADOS.map(e => ({ value: e.id, label: e.nombre }));

  return (
    <div className="form-panel">
      <div className="form-grid">
        <div className="form-field">
          <label className="form-label">Fecha</label>
          <DatePicker className="form-input" value={f.fecha} onChange={v => set('fecha', v)} />
        </div>

        <div className="form-field">
          <label className="form-label">Hora inicio</label>
          <SearchSelect
            className="form-select"
            value={f.hora_inicio}
            onChange={e => handleHoraInicio(e.target.value)}
            options={horaOpts}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Hora fin</label>
          <SearchSelect
            className="form-select"
            value={f.hora_fin}
            onChange={e => set('hora_fin', e.target.value)}
            options={horaOpts}
            placeholder={readonlyHoraFin ? '—' : '— Seleccionar —'}
            disabled={readonlyHoraFin}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Duración</label>
          <SearchSelect
            className="form-select"
            value={durSelected}
            onChange={handleDuracion}
            options={durOpts}
            placeholder={duracion && !DURATIONS.includes(duracion) ? `${duracion} min` : '— Seleccionar —'}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Alumno</label>
          <SearchSelect
            className="form-select"
            value={String(f.id_alumno)}
            onChange={selAlumno}
            options={alumnoOpts}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Profesor</label>
          <SearchSelect
            className="form-select"
            value={String(f.id_profesor)}
            onChange={selProfesor}
            options={profesorOpts}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Materia</label>
          <SearchSelect
            className="form-select"
            value={String(f.id_materia)}
            onChange={selMateria}
            options={materiaOpts}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Modalidad</label>
          <SearchSelect
            className="form-select"
            value={String(f.id_modalidad)}
            onChange={selModalidad}
            options={modalidadOpts}
          />
        </div>

        <div className="form-field">
          <label className="form-label">Estado</label>
          <SearchSelect
            className="form-select"
            value={String(f.id_estado)}
            onChange={selEstado}
            options={estadoOpts}
          />
        </div>

        {f.id_modalidad === '2' && (
          <div className="form-field span-full">
            <label className="form-label">Link de la clase</label>
            <input
              className="form-input"
              type="url"
              value={f.link_clase}
              onChange={e => set('link_clase', e.target.value)}
              placeholder="https://meet.google.com/... o https://zoom.us/..."
            />
          </div>
        )}

        <div className="form-field span-full">
          <label className="form-label">Descripción</label>
          <textarea
            className="form-textarea"
            value={f.descripcion}
            maxLength={150}
            onChange={e => set('descripcion', e.target.value)}
            placeholder="Notas sobre la clase..."
            rows={3}
          />
          <div className={`char-count ${f.descripcion.length > 130 ? 'warn' : ''}`}>
            {f.descripcion.length} / 150
          </div>
        </div>
      </div>

      <div className="form-actions">
        {onDelete && (
          <button className="btn btn-danger" onClick={onDelete}>Eliminar clase</button>
        )}
        <button className="btn btn-primary btn-lg" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
