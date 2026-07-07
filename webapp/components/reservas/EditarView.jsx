import ClaseForm from './ClaseForm';
import { useDialog } from '../../lib/useDialog';
import { mensajeSlot } from '../../lib/motivos';

export default function EditarView({ clase, meta, onBack, onSaved, onDeleted, showToast }) {
  const { showConfirm, dialogNode } = useDialog();

  async function handleGuardar(data) {
    if (!data.fecha)        return showToast('Falta la fecha', 'error');
    if (!data.hora_inicio)  return showToast('Falta la hora de inicio', 'error');
    if (!data.hora_fin)     return showToast('Falta seleccionar la duración', 'error');
    if (!data.id_alumno)    return showToast('Falta seleccionar el alumno', 'error');
    if (!data.id_profesor)  return showToast('Falta seleccionar el profesor', 'error');
    if (!data.id_materia)   return showToast('Falta seleccionar la materia', 'error');
    if (!data.id_modalidad) return showToast('Falta seleccionar la modalidad', 'error');
    if (!data.id_estado)    return showToast('Falta seleccionar el estado', 'error');

    const res = await fetch(`/api/clases/${clase.id_clase}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json();
      showToast(mensajeSlot(e, 'Error al guardar'), 'error');
      return;
    }
    const FIELDS = ['fecha', 'hora_inicio', 'hora_fin', 'id_alumno', 'id_profesor', 'id_materia', 'id_modalidad', 'id_estado'];
    const changed = FIELDS.some(f => String(data[f] ?? '') !== String(clase[f] ?? ''));
    onSaved(changed);
    showToast('Cambios guardados');
  }

  async function handleEliminar() {
    if (!await showConfirm(`¿Eliminar la clase #${clase.id_clase}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/clases/${clase.id_clase}`, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json();
      showToast(e.error || 'Error al eliminar', 'error');
      return;
    }
    onDeleted();
    showToast('Clase eliminada');
  }

  return (
    <div className="view-container">
      <div className="view-topbar">
        <button className="btn btn-ghost" onClick={onBack}>← Volver</button>
        <span className="view-title">Modificar clase</span>
      </div>

      <div className="clase-card">
        <span className="clase-card-id">#{clase.id_clase}</span>
        <div className="clase-card-sep" />
        <div className="clase-card-field">
          <span className="clase-card-label">Alumno</span>
          <span className="clase-card-value">{clase.nombre_alumno || '—'}</span>
        </div>
        <div className="clase-card-field">
          <span className="clase-card-label">Profesor</span>
          <span className="clase-card-value">{clase.nombre_profesor || '—'}</span>
        </div>
        <div className="clase-card-field">
          <span className="clase-card-label">Fecha</span>
          <span className="clase-card-value">{clase.fecha || '—'}</span>
        </div>
        <div className="clase-card-field">
          <span className="clase-card-label">Horario</span>
          <span className="clase-card-value">{clase.hora_inicio} → {clase.hora_fin}</span>
        </div>
        <div className="clase-card-field">
          <span className="clase-card-label">Estado</span>
          <span className="clase-card-value">{clase.estado || '—'}</span>
        </div>
      </div>

      <ClaseForm
        inicial={clase}
        meta={meta}
        onSubmit={handleGuardar}
        onDelete={handleEliminar}
        submitLabel="Guardar cambios"
        readonlyHoraFin
      />
      {dialogNode}
    </div>
  );
}
