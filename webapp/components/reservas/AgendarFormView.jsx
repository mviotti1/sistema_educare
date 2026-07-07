import ClaseForm from './ClaseForm';
import { mensajeSlot } from '../../lib/motivos';

export default function AgendarFormView({ meta, onCreated, showToast }) {

  async function handleAgendar(data) {
    if (!data.fecha)           return showToast('Falta la fecha', 'error');
    if (!data.hora_inicio)     return showToast('Falta la hora de inicio', 'error');
    if (!data.hora_fin)        return showToast('Falta seleccionar la duración', 'error');
    if (!data.id_alumno)       return showToast('Falta seleccionar el alumno', 'error');
    if (!data.id_profesor)     return showToast('Falta seleccionar el profesor', 'error');
    if (!data.id_materia)      return showToast('Falta seleccionar la materia', 'error');
    if (!data.id_modalidad)    return showToast('Falta seleccionar la modalidad', 'error');
    if (!data.id_estado)       return showToast('Falta seleccionar el estado', 'error');

    const res = await fetch('/api/clases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json();
      showToast(mensajeSlot(e, 'Error al agendar'), 'error');
      return;
    }
    onCreated();
  }

  return (
    <div className="view-container">
      <div className="view-topbar">
        <span className="view-title">Nueva clase</span>
      </div>
      <ClaseForm
        meta={meta}
        onSubmit={handleAgendar}
        submitLabel="Agendar clase"
        readonlyHoraFin
      />
    </div>
  );
}
