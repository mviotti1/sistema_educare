// Escritura CENTRALIZADA de reservas con lock + re-check (fix #1: anti doble-reserva / sobrecupo).
// Único camino con garantía. Lo usan: POST /api/clases (UI), PUT /api/clases/[id] (reprogramación)
// y POST /api/reservas/agendar (bot n8n). El predicado vive una sola vez en lib/disponibilidad.js.
import { leerClases, leerRecurrentes, leerBloqueos, crearClase, modificarClase, crearReservaBot, slotDesdeISO } from './sheets';
import { withLock, lockBookingKey } from './lock';
import { validarSlot } from './disponibilidad';

export class ConflictoSlot extends Error {
  constructor(motivo) {
    super(`slot_ocupado:${motivo}`);
    this.name = 'ConflictoSlot';
    this.status = 409;
    this.motivo = motivo;
  }
}

function esActiva(id_estado) { return [1, 2].includes(Number(id_estado)); }

// Re-lee el estado actual del Sheet y valida el slot. `excluirIdClase` evita que una
// reprogramación choque consigo misma.
async function rechequear(slot, excluirIdClase = null) {
  const [reservas, recurrentes, bloqueos] = await Promise.all([leerClases(), leerRecurrentes(), leerBloqueos()]);
  const base = excluirIdClase != null
    ? reservas.filter((c) => String(c.id_clase) !== String(excluirIdClase))
    : reservas;
  return validarSlot(slot, base, recurrentes, bloqueos);
}

// UI: POST /api/clases (forma fecha / hora_inicio / hora_fin).
export async function crearReservaConLock(data) {
  const slot = {
    id_profesor:  data.id_profesor,
    fecha:        data.fecha,
    hora_inicio:  data.hora_inicio,
    hora_fin:     data.hora_fin,
    id_modalidad: data.id_modalidad,
  };
  return withLock(lockBookingKey(slot.fecha), async () => {
    const v = await rechequear(slot);
    if (!v.ok) throw new ConflictoSlot(v.motivo);
    return crearClase(data);
  });
}

// Bot n8n: POST /api/reservas/agendar (forma ISO8601 + duración en minutos).
export async function crearReservaBotConLock(data) {
  const { fecha, hora_inicio, hora_fin } = slotDesdeISO(data.fecha_formato_ISO8601, data.duracion_clase);
  const slot = { id_profesor: data.id_profesor, fecha, hora_inicio, hora_fin, id_modalidad: data.id_modalidad };
  return withLock(lockBookingKey(fecha), async () => {
    const v = await rechequear(slot);
    if (!v.ok) throw new ConflictoSlot(v.motivo);
    return crearReservaBot(data);
  });
}

// Generación batch (recurrentes): filtra ocurrencias que caen en día bloqueado del profesor.
// No usa lock: el bloqueo es un dato estático del Sheet, no una carrera de slots.
export async function filtrarDiasBloqueados(clases) {
  if (!clases.length) return { permitidas: clases, salteadas: 0 };
  const bloqueos = await leerBloqueos();
  const set = new Set(bloqueos.map(b => `${String(b.id_profesor)}|${b.fecha}`));
  const permitidas = clases.filter(c => !set.has(`${String(c.id_profesor)}|${c.fecha}`));
  return { permitidas, salteadas: clases.length - permitidas.length };
}

// UI: PUT /api/clases/[id] (reprogramación). Si el cambio deja la clase inactiva (cancelar),
// no re-chequea: liberar un slot nunca crea conflicto.
export async function modificarReservaConLock(id, data) {
  if (!esActiva(data.id_estado)) return modificarClase(id, data);
  const slot = {
    id_profesor:  data.id_profesor,
    fecha:        data.fecha,
    hora_inicio:  data.hora_inicio,
    hora_fin:     data.hora_fin,
    id_modalidad: data.id_modalidad,
  };
  return withLock(lockBookingKey(slot.fecha), async () => {
    const v = await rechequear(slot, id);
    if (!v.ok) throw new ConflictoSlot(v.motivo);
    return modificarClase(id, data);
  });
}
