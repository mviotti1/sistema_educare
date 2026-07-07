import {
  leerRecurrentes, leerClases, leerProfesores,
  crearClasesBatch, eliminarClasesBatch, guardarIdCalendar,
} from '../../../lib/sheets';
import { esCancelado, crearEvento, eliminarEvento } from '../../../lib/gcal';
import { filtrarDiasBloqueados } from '../../../lib/reservas';

const DIA_NUM = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6,
};

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dateStr(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fecha_desde, fecha_hasta, template, template_viejo, id_template } = req.body;
  if (!fecha_desde || !fecha_hasta)
    return res.status(400).json({ error: 'fecha_desde y fecha_hasta son requeridos' });

  try {
    const [allTemplates, clasesExistentes] = await Promise.all([
      template ? Promise.resolve([]) : leerRecurrentes(),
      leerClases(),
    ]);

    const templates = template
      ? [template]
      : id_template
        ? allTemplates.filter(t => String(t.id) === String(id_template))
        : allTemplates;

    // Índice de clases activas: "id_alumno|fecha|hora_inicio"
    const existentes = new Set(
      clasesExistentes
        .filter(c => !esCancelado(c.id_estado))
        .map(c => `${c.id_alumno}|${c.fecha}|${c.hora_inicio}`)
    );

    const aCrear     = [];
    const conflictos = [];
    let   eliminadas = 0;

    const desde = parseDate(fecha_desde);
    const hasta = parseDate(fecha_hasta);

    // Si se modificó un template, borrar clases antiguas del rango y sus eventos GCal
    if (template_viejo) {
      const oldDayNum = DIA_NUM[template_viejo.dia_semana];
      if (oldDayNum) {
        const aEliminar = clasesExistentes.filter(c => {
          if (esCancelado(c.id_estado)) return false;
          if (String(c.id_alumno) !== String(template_viejo.id_alumno)) return false;
          if (c.hora_inicio !== template_viejo.hora_inicio) return false;
          if (!c.fecha) return false;
          const [y, m, d] = c.fecha.split('-').map(Number);
          const fDate = new Date(y, m - 1, d);
          return fDate >= desde && fDate <= hasta && fDate.getDay() === oldDayNum;
        });

        if (aEliminar.length) {
          await eliminarClasesBatch(aEliminar.map(c => c.id_clase));
          eliminadas = aEliminar.length;
          for (const c of aEliminar) {
            existentes.delete(`${c.id_alumno}|${c.fecha}|${c.hora_inicio}`);
          }
          // Eliminar eventos GCal en background
          eliminarGcalBatch(aEliminar).catch(e => console.error('[gcal delete batch]', e.message));
        }
      }
    }

    for (const tpl of templates) {
      const dayNum = DIA_NUM[tpl.dia_semana];
      if (!dayNum) continue;

      let cur = new Date(desde);
      while (cur <= hasta) {
        if (cur.getDay() === dayNum) {
          const ds  = dateStr(cur);
          const key = `${tpl.id_alumno}|${ds}|${tpl.hora_inicio}`;

          if (existentes.has(key)) {
            conflictos.push({
              fecha:    ds,
              dia:      tpl.dia_semana,
              horario:  `${tpl.hora_inicio}–${tpl.hora_fin}`,
              alumno:   tpl.nombre_alumno,
              profesor: tpl.nombre_profesor,
            });
          } else {
            aCrear.push({
              fecha:           ds,
              hora_inicio:     tpl.hora_inicio,
              hora_fin:        tpl.hora_fin,
              id_alumno:       tpl.id_alumno,
              nombre_alumno:   tpl.nombre_alumno,
              id_profesor:     tpl.id_profesor,
              nombre_profesor: tpl.nombre_profesor,
              id_materia:      tpl.id_materia,
              nombre_materia:  tpl.nombre_materia,
              id_modalidad:    tpl.id_modalidad,
              modalidad:       tpl.modalidad,
              id_estado:       tpl.id_estado,
              estado:          tpl.estado,
              descripcion:     '',
            });
            existentes.add(key);
          }
        }
        cur = addDays(cur, 1);
      }
    }

    const { permitidas, salteadas } = await filtrarDiasBloqueados(aCrear);
    if (salteadas) console.log(`[generar] ${salteadas} ocurrencia(s) salteada(s) por día bloqueado del profesor`);
    const creadas = await crearClasesBatch(permitidas);

    // GCal en background, silencioso (generación masiva)
    syncGcalBatch(creadas).catch(e => console.error('[recurrentes gcal]', e.message));

    res.json({ creadas: creadas.length, eliminadas, conflictos, salteadas_bloqueo: salteadas });
  } catch (err) {
    console.error('[generar]', err);
    res.status(500).json({ error: err.message });
  }
}

async function buildProfMap() {
  const profesores = await leerProfesores().catch(() => []);
  return new Map(profesores.map(p => [String(p.id), p]));
}

async function eliminarGcalBatch(clases) {
  const profMap = await buildProfMap();
  for (const clase of clases) {
    if (!clase.id_calendar || !clase.id_profesor) continue;
    const prof = profMap.get(String(clase.id_profesor));
    if (!prof?.id_calendario) continue;
    try {
      await eliminarEvento(clase.id_calendar, prof.id_calendario, 'none');
    } catch (e) {
      console.error(`[gcal delete] clase ${clase.id_clase}:`, e.message);
    }
  }
}

async function syncGcalBatch(clases) {
  if (!clases.length) return;
  const profMap = await buildProfMap();
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
