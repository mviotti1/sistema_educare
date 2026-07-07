import { google } from 'googleapis';
import './config';
import { withRetry } from './retry';

const TZ          = 'America/Argentina/Buenos_Aires';
const CALENDAR_ID = process.env.CALENDAR_ID;

// GCal colorId → estado (paleta real: 1=Lavanda 2=Sage 3=Grape 4=Flamingo 5=Banana
//   6=Tangerine 7=Peacock 8=Graphite 9=Blueberry 10=Basil 11=Tomato)
const ESTADO_COLOR = {
  '1': '2',   // Confirmada                       → Sage       (verde)
  '2': '5',   // Pendiente de pago                → Banana     (amarillo)
  '3': '11',  // Cancelada - Devolver 100%        → Tomato     (rojo)
  '4': '6',   // Cancelada - Devolver media hora  → Tangerine  (naranja)
  '5': '8',   // Cancelada - Reprogramar          → Graphite   (gris)
  '6': '8',   // Cancelada - Resuelta             → Graphite   (gris)
};

// Estados que no ocupan slot (para detección de conflictos en recurrentes)
export function esCancelado(id_estado) {
  return ['3', '4', '5', '6'].includes(String(id_estado));
}

// "Ariana Doria" → "A.Doria"
function shortName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  const inicial  = parts[0][0].toUpperCase();
  const apellido = parts.slice(1).join(' ');
  return `${inicial}.${apellido.charAt(0).toUpperCase()}${apellido.slice(1)}`;
}

const ESTADO_LABEL = {
  '1': 'CONFIRMADA',
  '2': 'PENDIENTE',
  '3': 'CANCELADA',
  '4': 'CANCELADA',
  '5': 'CANCELADA',
  '6': 'CANCELADA',
};

export function buildTitle(clase) {
  const label = ESTADO_LABEL[String(clase.id_estado)] || 'CONFIRMADA';
  const p   = shortName(clase.nombre_profesor || '');
  const a   = shortName(clase.nombre_alumno   || '');
  const mod = clase.modalidad === 'VIRTUAL' ? 'V' : 'P';
  const mat = (clase.nombre_materia || '').toUpperCase();
  return `[${label}] [P: ${p}] [A: ${a}] [${mod}] [${mat}]`;
}

let _calClient = null;
async function getClient() {
  if (_calClient) return _calClient;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('[gcal] getClient — keyFile:', keyFile, '| calendarId:', CALENDAR_ID);
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const client = await auth.getClient();
  _calClient = google.calendar({ version: 'v3', auth: client });
  return _calClient;
}

function dt(fecha, hora) {
  return `${fecha}T${hora}:00`;
}

function buildEvent(clase) {
  const colorId = ESTADO_COLOR[String(clase.id_estado)] || '2';
  return {
    summary:     buildTitle(clase),
    description: clase.descripcion || '',
    start: { dateTime: dt(clase.fecha, clase.hora_inicio), timeZone: TZ },
    end:   { dateTime: dt(clase.fecha, clase.hora_fin),    timeZone: TZ },
    colorId,
    reminders: { useDefault: false },
  };
}

export async function crearEvento(clase, sendUpdates = 'all', calendarId = CALENDAR_ID, attendees = []) {
  console.log('[gcal] crearEvento —', buildTitle(clase), '| calendarId:', calendarId === CALENDAR_ID ? 'principal' : calendarId);
  return withRetry(async () => {
    const cal = await getClient();
    const eventData = buildEvent(clase);
    if (attendees.length) eventData.attendees = attendees;
    const { data } = await cal.events.insert({ calendarId, requestBody: eventData, sendUpdates });
    console.log('[gcal] crearEvento — eventId:', data.id);
    return data.id;
  });
}

export async function actualizarEvento(eventId, clase, sendUpdates = 'all', calendarId = CALENDAR_ID) {
  console.log('[gcal] actualizarEvento — eventId:', eventId, '|', buildTitle(clase));
  await withRetry(async () => {
    const cal = await getClient();
    await cal.events.patch({
      calendarId,
      eventId,
      requestBody: buildEvent(clase),
      sendUpdates,
    });
  });
}

// Devuelve: 'unchanged' | 'updated' | 'not_found'
export async function sincronizarEvento(eventId, clase, calendarId = CALENDAR_ID) {
  console.log('[gcal] sincronizarEvento — eventId:', eventId);
  return withRetry(async () => {
    const cal = await getClient();

    let current;
    try {
      const { data } = await cal.events.get({ calendarId, eventId });
      current = data;
    } catch (e) {
      if (e.code === 404 || e.status === 404 || e.code === 410 || e.status === 410) return 'not_found';
      throw e;
    }

    if (current.status === 'cancelled') return 'not_found';

    const desired        = buildEvent(clase);
    const desiredColorId = desired.colorId || '2';

    const changed =
      current.summary !== desired.summary ||
      (current.description || '') !== (desired.description || '') ||
      (current.colorId || '2')    !== desiredColorId ||
      (current.start?.dateTime || '').slice(0, 16) !== desired.start.dateTime.slice(0, 16) ||
      (current.end?.dateTime   || '').slice(0, 16) !== desired.end.dateTime.slice(0, 16);

    if (!changed) {
      console.log('[gcal] sincronizarEvento — sin cambios');
      return 'unchanged';
    }

    await cal.events.patch({
      calendarId,
      eventId,
      requestBody: desired,
      sendUpdates: 'all',
    });
    console.log('[gcal] sincronizarEvento — actualizado');
    return 'updated';
  });
}

// Solo para eliminación FÍSICA de clases (cuando se borran del sistema, no al cancelar).
// Al cancelar una clase el evento se actualiza con color gris/rojo, NUNCA se elimina.
// sendUpdates: 'all' para avisar a attendees (alumno/profesor); 'none' para purges masivos sin spam.
export async function eliminarEvento(eventId, calendarId = CALENDAR_ID, sendUpdates = 'all') {
  console.log('[gcal] eliminarEvento — eventId:', eventId, '| sendUpdates:', sendUpdates);
  await withRetry(async () => {
    const cal = await getClient();
    await cal.events.delete({ calendarId, eventId, sendUpdates });
  });
  console.log('[gcal] eliminarEvento — OK');
}


