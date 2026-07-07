// Predicado de validación de slot para el COMMIT de una reserva (anti doble-reserva / sobrecupo).
// Portado VERBATIM de check_availability (best_gap1 / best_gaps1). Enforce los invariantes DUROS:
//   1) overlap por profesor contra reservas activas + clases fijas del profe
//   2) capacidad institucional: <9 presenciales simultáneos (RESERVAS + CLASES_FIJAS)
// Las reglas blandas (creaHueco, regla de 90 min) ya se evaluaron al proponer y no son problema
// de carrera, así que NO se re-chequean acá.
//
// Estados que OCUPAN un slot: [1, 2]. Estados 3-6 = cancelado/inactivo → se ignoran.
// Modalidad presencial: id_modalidad === 1.

const CAP_PRESENCIALES = 9;
// getDay(): 0=Dom .. 6=Sab. CLASES_FIJAS no usa DOMINGO (igual que lib/recurrentes.js).
const DIA_NUM = { LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };

export function horaAMinutos(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// verbatim de check_availability
export function haySolapamiento(i1, f1, i2, f2) { return i1 < f2 && f1 > i2; }

function esActiva(id_estado) { return [1, 2].includes(Number(id_estado)); }
function esPresencial(id_modalidad) { return Number(id_modalidad) === 1; }

// Expande CLASES_FIJAS (templates de leerRecurrentes) a sus ocurrencias en una fecha concreta.
function fijasEnFecha(recurrentes, fechaKey) {
  const [y, m, d] = fechaKey.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const out = [];
  for (const cf of recurrentes) {
    if (!esActiva(cf.id_estado)) continue;
    if (DIA_NUM[cf.dia_semana] !== dow) continue;
    if (cf.fecha_inicio && fechaKey < cf.fecha_inicio) continue;
    if (cf.fecha_fin && fechaKey > cf.fecha_fin) continue;
    out.push({
      id_profesor:  String(cf.id_profesor),
      id_modalidad: Number(cf.id_modalidad),
      inicio:       horaAMinutos(cf.hora_inicio),
      fin:          horaAMinutos(cf.hora_fin),
    });
  }
  return out;
}

/**
 * ¿El slot propuesto sigue siendo válido AHORA?
 * @param slot {id_profesor, fecha:'YYYY-MM-DD', hora_inicio:'HH:MM', hora_fin:'HH:MM', id_modalidad}
 * @param reservas     salida de leerClases()
 * @param recurrentes  salida de leerRecurrentes()
 * @param bloqueos     salida de leerBloqueos() — días bloqueados por profesor
 * @returns {ok:boolean, motivo?:'slot_invalido'|'profesor_bloqueado'|'profesor_ocupado'|'sin_aulas'}
 */
export function validarSlot(slot, reservas, recurrentes, bloqueos = []) {
  const fechaKey = String(slot.fecha || '');
  const sI = horaAMinutos(slot.hora_inicio);
  const sF = horaAMinutos(slot.hora_fin);
  const idProf = String(slot.id_profesor);

  if (!fechaKey || !(sF > sI)) return { ok: false, motivo: 'slot_invalido' };

  // 0) Día bloqueado del profesor (BLOQUEOS_PROFESOR) — jerarquía superior a todo
  if ((bloqueos || []).some(b => String(b.id_profesor) === idProf && b.fecha === fechaKey))
    return { ok: false, motivo: 'profesor_bloqueado' };

  const fijas = fijasEnFecha(recurrentes || [], fechaKey);

  // 1) Overlap por profesor (reservas activas + clases fijas del mismo profe)
  for (const c of reservas) {
    if (!esActiva(c.id_estado)) continue;
    if (String(c.id_profesor) !== idProf) continue;
    if (String(c.fecha) !== fechaKey) continue;
    const ci = horaAMinutos(c.hora_inicio);
    const cf = ci + (Number(c.duracion) || 0);
    if (haySolapamiento(sI, sF, ci, cf)) return { ok: false, motivo: 'profesor_ocupado' };
  }
  for (const cf of fijas) {
    if (cf.id_profesor !== idProf) continue;
    if (haySolapamiento(sI, sF, cf.inicio, cf.fin)) return { ok: false, motivo: 'profesor_ocupado' };
  }

  // 2) Capacidad institucional de presenciales (<9 simultáneos en la franja)
  if (esPresencial(slot.id_modalidad)) {
    let n = 0;
    for (const c of reservas) {
      if (!esPresencial(c.id_modalidad) || !esActiva(c.id_estado)) continue;
      if (String(c.fecha) !== fechaKey) continue;
      const ci = horaAMinutos(c.hora_inicio);
      const cf = ci + (Number(c.duracion) || 0);
      if (haySolapamiento(sI, sF, ci, cf)) n++;
    }
    for (const cf of fijas) {
      if (!esPresencial(cf.id_modalidad)) continue;
      if (haySolapamiento(sI, sF, cf.inicio, cf.fin)) n++;
    }
    if (n >= CAP_PRESENCIALES) return { ok: false, motivo: 'sin_aulas' };
  }

  return { ok: true };
}
