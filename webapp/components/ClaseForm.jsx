import { useState } from 'react';
import { useDialog } from '../lib/useDialog';
import { ESTADOS } from '../lib/clases';
import { HORARIOS } from '../lib/horarios';

const EMPTY = {
  fecha: '', hora_inicio: '', hora_fin: '',
  id_alumno: '', nombre_alumno: '', correo_alumno: '',
  id_profesor: '', nombre_profesor: '', correo_profesor: '',
  id_materia: '', nombre_materia: '',
  id_modalidad: '', modalidad: '',
  id_estado: '', estado: '',
  descripcion: '',
};

export default function ClaseForm({ meta, inicial = {}, onSubmit, submitLabel = 'Guardar' }) {
  const [form, setForm] = useState({ ...EMPTY, ...inicial });
  const [enviando, setEnviando] = useState(false);
  const { showAlert, dialogNode } = useDialog();

  const duracion = calcDuracion(form.hora_inicio, form.hora_fin);

  function set(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function selectAlumno(e) {
    const alumno = meta.alumnos.find(a => String(a.id) === e.target.value);
    setForm(prev => ({
      ...prev,
      id_alumno:     alumno?.id     || '',
      nombre_alumno: alumno?.nombre || '',
      correo_alumno: alumno?.correo || '',
    }));
  }

  function selectProfesor(e) {
    const prof = meta.profesores.find(p => String(p.id) === e.target.value);
    setForm(prev => ({
      ...prev,
      id_profesor:     prof?.id     || '',
      nombre_profesor: prof?.nombre || '',
      correo_profesor: prof?.correo || '',
    }));
  }

  function selectMateria(e) {
    const mat = meta.materias.find(m => String(m.id) === e.target.value);
    setForm(prev => ({ ...prev, id_materia: mat?.id || '', nombre_materia: mat?.nombre || '' }));
  }

  function selectModalidad(e) {
    const mod = meta.modalidades.find(m => String(m.id) === e.target.value);
    setForm(prev => ({ ...prev, id_modalidad: mod?.id || '', modalidad: mod?.nombre || '' }));
  }

  function selectEstado(e) {
    const est = ESTADOS.find(es => String(es.id) === e.target.value);
    setForm(prev => ({ ...prev, id_estado: est?.id || '', estado: est?.nombre || '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fecha)           { await showAlert('Seleccioná una fecha'); return; }
    if (!form.hora_inicio)     { await showAlert('Seleccioná hora de inicio'); return; }
    if (!form.hora_fin)        { await showAlert('Seleccioná hora de fin'); return; }
    if (duracion < 60)         { await showAlert('El mínimo es 60 minutos entre inicio y fin'); return; }
    if (!form.nombre_alumno)   { await showAlert('Seleccioná un alumno'); return; }
    if (!form.nombre_profesor) { await showAlert('Seleccioná un profesor'); return; }
    if (!form.nombre_materia)  { await showAlert('Seleccioná una materia'); return; }

    setEnviando(true);
    await onSubmit(form);
    setEnviando(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <table>
        <tbody>
          <tr>
            <td><label>Fecha</label></td>
            <td><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required /></td>
          </tr>
          <tr>
            <td><label>Hora inicio</label></td>
            <td>
              <select value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} required>
                <option value="">-- Seleccionar --</option>
                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Hora fin</label></td>
            <td>
              <select value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} required>
                <option value="">-- Seleccionar --</option>
                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Duración</label></td>
            <td>{duracion !== null ? `${duracion} min` : '—'}</td>
          </tr>
          <tr>
            <td><label>Alumno</label></td>
            <td>
              <select value={String(form.id_alumno)} onChange={selectAlumno} required>
                <option value="">-- Seleccionar --</option>
                {meta.alumnos.map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Profesor</label></td>
            <td>
              <select value={String(form.id_profesor)} onChange={selectProfesor} required>
                <option value="">-- Seleccionar --</option>
                {meta.profesores.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Materia</label></td>
            <td>
              <select value={String(form.id_materia)} onChange={selectMateria} required>
                <option value="">-- Seleccionar --</option>
                {meta.materias.map(m => <option key={m.id} value={String(m.id)}>{m.nombre}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Modalidad</label></td>
            <td>
              <select value={String(form.id_modalidad)} onChange={selectModalidad}>
                <option value="">-- Seleccionar --</option>
                {meta.modalidades.map(m => <option key={m.id} value={String(m.id)}>{m.nombre}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Estado</label></td>
            <td>
              <select value={String(form.id_estado)} onChange={selectEstado}>
                <option value="">-- Seleccionar --</option>
                {ESTADOS.map(e => <option key={e.id} value={String(e.id)}>{e.nombre}</option>)}
              </select>
            </td>
          </tr>
          <tr>
            <td><label>Descripción</label></td>
            <td><textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} cols={40} /></td>
          </tr>
        </tbody>
      </table>

      <button type="submit" disabled={enviando}>
        {enviando ? 'Guardando...' : submitLabel}
      </button>
      {dialogNode}
    </form>
  );
}

function calcDuracion(inicio, fin) {
  if (!inicio || !fin) return null;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? diff : null;
}
