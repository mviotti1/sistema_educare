// Mensajes legibles para los 409 de slot (ConflictoSlot en lib/reservas.js).
// El body del 409 es { error: 'slot_ocupado', motivo }.
export const MOTIVOS_SLOT = {
  profesor_bloqueado: 'El profesor tiene bloqueado ese día',
  profesor_ocupado:   'El profesor ya tiene una clase en ese horario',
  sin_aulas:          'No hay aulas disponibles en esa franja',
  slot_invalido:      'El horario elegido no es válido',
};

export function mensajeSlot(e, fallback) {
  return MOTIVOS_SLOT[e?.motivo] || e?.error || fallback;
}
