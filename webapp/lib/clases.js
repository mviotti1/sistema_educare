export const MODALIDADES = [
  { id: '1', nombre: 'PRESENCIAL', label: 'Presencial' },
  { id: '2', nombre: 'VIRTUAL',    label: 'Virtual' },
];

export const ESTADOS = [
  { id: '1', nombre: 'CONFIRMADA' },
  { id: '2', nombre: 'PENDIENTE DE PAGO' },
  { id: '3', nombre: 'CANCELADA - DEVOLVER 100%' },
  { id: '4', nombre: 'CANCELADA - DEVOLVER MEDIA HORA' },
  { id: '5', nombre: 'CANCELADA - REPROGRAMAR' },
  { id: '6', nombre: 'CANCELADA - RESUELTA' },
];

export const ESTADO_LABELS = {
  '1': 'CONFIRMADA',
  '2': 'PENDIENTE DE PAGO',
  '3': 'CANCELADA - DEVOLVER 100%',
  '4': 'CANCELADA - DEVOLVER MEDIA HORA',
  '5': 'CANCELADA - REPROGRAMAR',
  '6': 'CANCELADA - RESUELTA',
};

export const ESTADO_COLORS = {
  '1': { bg: 'rgba(141,198,63,0.12)',  bd: '#8DC63F', fg: '#4A7A0F' },
  '2': { bg: 'rgba(245,158,11,0.12)',  bd: '#F59E0B', fg: '#92610A' },
  '3': { bg: 'rgba(239,68,68,0.12)',   bd: '#EF4444', fg: '#B91C1C' },
  '4': { bg: 'rgba(249,115,22,0.12)',  bd: '#F97316', fg: '#C2550E' },
  '5': { bg: 'rgba(148,163,184,0.12)', bd: '#94A3B8', fg: '#475569' },
  '6': { bg: 'rgba(148,163,184,0.12)', bd: '#94A3B8', fg: '#475569' },
};

export function resolveClase(clase, meta) {
  const alumno   = (meta.alumnos    || []).find(a => String(a.id) === String(clase.id_alumno));
  const profesor = (meta.profesores || []).find(p => String(p.id) === String(clase.id_profesor));
  const materia  = (meta.materias   || []).find(m => String(m.id) === String(clase.id_materia));
  const modal    = MODALIDADES.find(m => String(m.id) === String(clase.id_modalidad));
  const estado   = ESTADOS.find(e => String(e.id) === String(clase.id_estado));

  return {
    ...clase,
    nombre_alumno:   alumno   ? alumno.nombre          : '',
    correo_alumno:   alumno   ? (alumno.correo   || '') : '',
    nombre_profesor: profesor ? profesor.nombre         : '',
    correo_profesor: profesor ? (profesor.correo || '') : '',
    nombre_materia:  materia  ? materia.nombre          : '',
    modalidad:       modal    ? modal.nombre            : '',
    estado:          estado   ? estado.nombre           : '',
  };
}
