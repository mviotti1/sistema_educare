import { leerClases, leerProfesores, crearClasesBatch, eliminarClasesBatch, guardarIdCalendar } from './sheets';
import { esCancelado, crearEvento, eliminarEvento } from './gcal';
import { filtrarDiasBloqueados } from './reservas';

const DIA_NUM = { LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };

function pad(n) { return String(n).padStart(2, '0'); }

export function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function horizonte() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return dateStr(d);
}

// Rango desde hoy (o fecha_inicio si es futura) hasta fecha_fin (o 12 meses)
export function rangoTemplate(template) {
  const hoy   = dateStr(new Date());
  const desde = (template.fecha_inicio && template.fecha_inicio > hoy)
    ? template.fecha_inicio
    : hoy;
  const hasta = template.fecha_fin || horizonte();
  return { desde, hasta };
}

// Crea instancias individuales en RESERVAS(SISTEMA) para el template y rango dado.
// Saltea fechas donde ya existe una clase activa para ese alumno/hora.
export async function generarInstancias(template, desde, hasta) {
  const dayNum = DIA_NUM[template.dia_semana];
  if (!dayNum) return { creadas: 0, conflictos: [] };

  const clasesExistentes = await leerClases();

  const existentes = new Set(
    clasesExistentes
      .filter(c => !esCancelado(c.id_estado))
      .map(c => `${c.id_alumno}|${c.fecha}|${c.hora_inicio}`)
  );

  const fechaDesde = parseDate(desde);
  const fechaHasta = parseDate(hasta);
  const aCrear = [];
  const conflictos = [];

  let cur = new Date(fechaDesde);
  while (cur <= fechaHasta) {
    if (cur.getDay() === dayNum) {
      const ds  = dateStr(cur);
      const key = `${template.id_alumno}|${ds}|${template.hora_inicio}`;
      if (existentes.has(key)) {
        conflictos.push({ fecha: ds, dia: template.dia_semana });
      } else {
        aCrear.push({
          fecha:           ds,
          hora_inicio:     template.hora_inicio,
          hora_fin:        template.hora_fin,
          id_alumno:       template.id_alumno,
          nombre_alumno:   template.nombre_alumno,
          id_profesor:     template.id_profesor,
          nombre_profesor: template.nombre_profesor,
          id_materia:      template.id_materia,
          nombre_materia:  template.nombre_materia,
          id_modalidad:    template.id_modalidad,
          modalidad:       template.modalidad,
          id_estado:       template.id_estado,
          estado:          template.estado,
          descripcion:     '',
        });
        existentes.add(key);
      }
    }
    cur = addDays(cur, 1);
  }

  const { permitidas, salteadas } = await filtrarDiasBloqueados(aCrear);
  const creadas = await crearClasesBatch(permitidas);
  _syncGcalBatch(creadas).catch(e => console.error('[recurrentes] gcal sync:', e.message));
  console.log(`[recurrentes] generarInstancias — creadas: ${creadas.length}, conflictos: ${conflictos.length}, salteadas por bloqueo: ${salteadas}`);
  return { creadas: creadas.length, conflictos, salteadas_bloqueo: salteadas };
}

// Elimina instancias no canceladas en RESERVAS(SISTEMA) que corresponden al template.
// Solo elimina desde `desde` en adelante para preservar el historial.
export async function eliminarInstancias(template, desde, hasta) {
  const dayNum = DIA_NUM[template.dia_semana];
  if (!dayNum) return 0;

  const clasesExistentes = await leerClases();
  const fechaDesde = parseDate(desde);
  const fechaHasta = parseDate(hasta);

  const aEliminar = clasesExistentes.filter(c => {
    if (esCancelado(c.id_estado)) return false;
    if (String(c.id_alumno)   !== String(template.id_alumno))   return false;
    if (c.hora_inicio         !== template.hora_inicio)          return false;
    if (!c.fecha) return false;
    const [y, m, d] = c.fecha.split('-').map(Number);
    const fDate = new Date(y, m - 1, d);
    return fDate >= fechaDesde && fDate <= fechaHasta && fDate.getDay() === dayNum;
  });

  if (aEliminar.length) {
    await eliminarClasesBatch(aEliminar.map(c => c.id_clase));
    _eliminarGcalBatch(aEliminar).catch(e => console.error('[recurrentes] gcal delete:', e.message));
  }
  console.log(`[recurrentes] eliminarInstancias — eliminadas: ${aEliminar.length}`);
  return aEliminar.length;
}

async function _buildProfMap() {
  const profesores = await leerProfesores().catch(() => []);
  return new Map(profesores.map(p => [String(p.id), p]));
}

async function _eliminarGcalBatch(clases) {
  const profMap = await _buildProfMap();
  for (const clase of clases) {
    if (!clase.id_calendar || !clase.id_profesor) continue;
    const prof = profMap.get(String(clase.id_profesor));
    if (!prof?.id_calendario) continue;
    try { await eliminarEvento(clase.id_calendar, prof.id_calendario, 'none'); }
    catch (e) { console.error(`[gcal delete] clase ${clase.id_clase}:`, e.message); }
  }
}

async function _syncGcalBatch(clases) {
  if (!clases.length) return;
  const profMap = await _buildProfMap();
  for (const clase of clases) {
    const prof = profMap.get(String(clase.id_profesor));
    if (!prof?.id_calendario) continue;
    try {
      const eventId = await crearEvento(clase, 'none', prof.id_calendario);
      await guardarIdCalendar(clase.id_clase, eventId);
    } catch (e) {
      console.error(`[gcal batch] clase ${clase.id_clase}:`, e.message);
    }
  }
}
