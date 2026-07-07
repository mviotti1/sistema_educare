import { google } from 'googleapis';
import './config';
import { withRetry } from './retry';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const HOJAS = {
  SISTEMA:        'RESERVAS(SISTEMA)',
  ALUMNOS:        'ALUMNOS',
  PROFESORES:     'PROFESORES',
  MATERIAS:       'materias_db',
  MODALIDADES:    'modalidad_db',
  ESTADOS:        'estados_clases_db',
  DISPONIBILIDAD:   'DISPONIBILIDAD_SISTEMA',
  MATERIA_PROFESOR: 'materia-profesor',
  CLASES_FIJAS:     'CLASES_FIJAS',
  BLOQUEOS:         'BLOQUEOS_PROFESOR',
};

// Columnas RESERVAS(SISTEMA) — índice 0
const CS = {
  ID_CLASE:0,     ISO8601:1,       DURACION:2,
  FECHA:3,        HORA_INICIO:4,   HORA_FIN:5,
  ID_ALUMNO:6,    NOMBRE_ALUMNO:7,
  ID_PROFESOR:8,  NOMBRE_PROFESOR:9,
  ID_MATERIA:10,  NOMBRE_MATERIA:11,
  ID_MODALIDAD:12, MODALIDAD:13,
  ID_ESTADO:14,   ESTADO:15,       DESCRIPCION:16,
  ID_CALENDAR:17, LINK_CLASE:18,
};
const CS_TOTAL = 19;

let _sheetsClient = null;
async function getClient() {
  if (_sheetsClient) return _sheetsClient;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('[sheets] getClient — keyFile:', keyFile || '(no definido)', '| SPREADSHEET_ID:', SPREADSHEET_ID || '(no definido)');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  console.log('[sheets] getClient — auth OK, type:', authClient.constructor?.name);
  _sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return _sheetsClient;
}

// Re-confirma que rowIdx sigue apuntando al id esperado justo antes de escribir por
// número de fila absoluto. Tolera inserts/deletes concurrentes (bot n8n, otros admins)
// que desplazan filas entre el find y el update. Mismo patrón que los eliminar*.
// status 503 → withRetry recomputa rowIdx (la lectura A:A vive dentro del closure) y reintenta.
async function verificarFila(sheets, hoja, rowIdx, expectedId) {
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${hoja}!A${rowIdx + 1}`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const actual = String(verify.data.values?.[0]?.[0] || '');
  if (actual !== String(expectedId)) {
    const err = new Error(`[verificarFila] ${hoja} fila ${rowIdx + 1} tiene "${actual}", esperaba "${expectedId}"`);
    err.status = 503;
    throw err;
  }
}

// "2024-03-15T10:00:00.000-03:00" → { fecha: "2024-03-15", hora_inicio: "10:00" }
function parseISO(iso) {
  if (!iso) return { fecha: '', hora_inicio: '' };
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? { fecha: m[1], hora_inicio: m[2] } : { fecha: '', hora_inicio: '' };
}

// Convierte un valor de hora de Sheets a "HH:MM".
// Con UNFORMATTED_VALUE, Sheets devuelve tiempos como decimal (0.4167 = 10:00).
function toTimeStr(v) {
  if (typeof v === 'string' && v.includes(':')) return v;
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return String(v || '');
}

// "10:00" + 90 → "11:30"
function addMinutes(hora, mins) {
  if (!hora || !mins) return '';
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + mins;
  if (total > 24 * 60) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// "2024-03-15" → se escribe directamente, Sheets reconoce ISO universalmente
function formatFechaSheets(iso) {
  return iso || '';
}

function calcDuracion(horaInicio, horaFin) {
  const s1 = toTimeStr(horaInicio);
  const s2 = toTimeStr(horaFin);
  if (!s1 || !s2 || !s1.includes(':') || !s2.includes(':')) return 0;
  const [h1, m1] = s1.split(':').map(Number);
  const [h2, m2] = s2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

function buildISO8601(fechaISO, horaInicio, tz = '-03:00') {
  const [y, m, d] = String(fechaISO || '').split('-');
  const [h, min] = toTimeStr(horaInicio).split(':');
  const p = n => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}T${p(h)}:${p(min)}:00.000${tz}`;
}

function rowToClase(row) {
  const dur = Number(row[CS.DURACION]) || 0;
  const { fecha, hora_inicio } = parseISO(row[CS.ISO8601]);
  return {
    id_clase:     String(row[CS.ID_CLASE]     || ''),
    iso8601:      row[CS.ISO8601]             || '',
    duracion:     dur ? String(dur)           : '',
    fecha,
    hora_inicio,
    hora_fin:     toTimeStr(row[CS.HORA_FIN]) || addMinutes(hora_inicio, dur),
    id_alumno:    String(row[CS.ID_ALUMNO]    || ''),
    id_profesor:  String(row[CS.ID_PROFESOR]  || ''),
    id_materia:   String(row[CS.ID_MATERIA]   || ''),
    id_modalidad: String(row[CS.ID_MODALIDAD] || ''),
    id_estado:       String(row[CS.ID_ESTADO]    || ''),
    descripcion:     row[CS.DESCRIPCION]         || '',
    id_calendar:          row[CS.ID_CALENDAR]        || '',
    // nombres desnormalizados — disponibles server-side sin resolver meta
    nombre_alumno:   row[CS.NOMBRE_ALUMNO]       || '',
    nombre_profesor: row[CS.NOMBRE_PROFESOR]     || '',
    nombre_materia:  row[CS.NOMBRE_MATERIA]      || '',
    modalidad:       row[CS.MODALIDAD]           || '',
    link_clase:      row[CS.LINK_CLASE]          || '',
  };
}

// ── Leer todas las clases ──────────────────────────────────────
export async function leerClases() {
  return withRetry(async () => {
    console.log('[sheets] leerClases — inicio');
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A:S`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1); // saltar header
    const clases = rows.map(rowToClase).filter(c => c.id_clase);
    console.log('[sheets] leerClases — filas brutas:', rows.length, '| clases válidas:', clases.length);
    return clases;
  });
}

// ── Leer una clase por id ──────────────────────────────────────
export async function leerClase(id) {
  const clases = await leerClases();
  return clases.find(c => String(c.id_clase) === String(id)) || null;
}

// ── Crear clase ────────────────────────────────────────────────
export async function crearClase(data) {
  console.log('[sheets] crearClase — data:', JSON.stringify(data));
  const sheets   = await getClient();
  const id_clase = Date.now();
  console.log('[sheets] crearClase — id_clase asignado:', id_clase);
  const duracion = calcDuracion(data.hora_inicio, data.hora_fin);
  const iso8601  = buildISO8601(data.fecha, data.hora_inicio);

  const fila = Array(CS_TOTAL).fill('');
  fila[CS.ID_CLASE]        = id_clase;
  fila[CS.ISO8601]         = iso8601;
  fila[CS.DURACION]        = duracion;
  fila[CS.FECHA]           = formatFechaSheets(data.fecha);
  fila[CS.HORA_INICIO]     = data.hora_inicio;
  fila[CS.HORA_FIN]        = data.hora_fin;
  fila[CS.ID_ALUMNO]       = data.id_alumno;
  fila[CS.NOMBRE_ALUMNO]   = data.nombre_alumno;
  fila[CS.ID_PROFESOR]     = data.id_profesor;
  fila[CS.NOMBRE_PROFESOR] = data.nombre_profesor;
  fila[CS.ID_MATERIA]      = data.id_materia;
  fila[CS.NOMBRE_MATERIA]  = data.nombre_materia;
  fila[CS.ID_MODALIDAD]    = data.id_modalidad;
  fila[CS.MODALIDAD]       = data.modalidad;
  fila[CS.ID_ESTADO]       = data.id_estado;
  fila[CS.ESTADO]          = data.estado;
  fila[CS.DESCRIPCION]     = data.descripcion || '';

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.SISTEMA}!A:Q`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
  console.log('[sheets] crearClase — append OK, id_clase:', id_clase);

  return { id_clase };
}

// Deriva el slot (fecha + horas) desde el ISO8601 + duración en minutos. Para el contrato del bot.
export function slotDesdeISO(iso, duracionMin) {
  const { fecha, hora_inicio } = parseISO(iso);
  const hora_fin = addMinutes(hora_inicio, Number(duracionMin) || 0);
  return { fecha, hora_inicio, hora_fin };
}

// Alta de reserva con el set MÍNIMO de columnas que escribe el bot (nodo crear_clase de book_class):
// ids + ISO + duración + descripción + estado. Deja en blanco las columnas derivadas/nombres,
// igual que hoy, para no cambiar el contenido del Sheet de las reservas del bot.
export async function crearReservaBot(data) {
  console.log('[sheets] crearReservaBot — data:', JSON.stringify(data));
  const sheets   = await getClient();
  const id_clase = Date.now();

  const fila = Array(CS_TOTAL).fill('');
  fila[CS.ID_CLASE]     = id_clase;
  fila[CS.ISO8601]      = data.fecha_formato_ISO8601;
  fila[CS.DURACION]     = data.duracion_clase;
  fila[CS.ID_ALUMNO]    = data.id_alumno;
  fila[CS.ID_PROFESOR]  = data.id_profesor;
  fila[CS.ID_MATERIA]   = data.id_materia;
  fila[CS.ID_MODALIDAD] = data.id_modalidad;
  fila[CS.ID_ESTADO]    = data.id_estado ?? 2;
  fila[CS.DESCRIPCION]  = data.descripcion_clase || '';

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.SISTEMA}!A:Q`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
  console.log('[sheets] crearReservaBot — append OK, id_clase:', id_clase);

  return { id_clase };
}

// ── Modificar clase ────────────────────────────────────────────
export async function modificarClase(id, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids    = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Clase ${id} no encontrada`);
    const sheetRow = rowIdx + 1;
    const duracion = calcDuracion(data.hora_inicio, data.hora_fin);
    const iso8601  = buildISO8601(data.fecha, data.hora_inicio);
    // 17 elementos (A–Q). No sobreescribe ID_CALENDAR (col R) ni LINK_CLASE (col S).
    const fila = Array(CS.ID_CALENDAR).fill('');
    fila[CS.ID_CLASE]        = id;
    fila[CS.ISO8601]         = iso8601;
    fila[CS.DURACION]        = duracion;
    fila[CS.FECHA]           = formatFechaSheets(data.fecha);
    fila[CS.HORA_INICIO]     = data.hora_inicio;
    fila[CS.HORA_FIN]        = data.hora_fin;
    fila[CS.ID_ALUMNO]       = data.id_alumno;
    fila[CS.NOMBRE_ALUMNO]   = data.nombre_alumno;
    fila[CS.ID_PROFESOR]     = data.id_profesor;
    fila[CS.NOMBRE_PROFESOR] = data.nombre_profesor;
    fila[CS.ID_MATERIA]      = data.id_materia;
    fila[CS.NOMBRE_MATERIA]  = data.nombre_materia;
    fila[CS.ID_MODALIDAD]    = data.id_modalidad;
    fila[CS.MODALIDAD]       = data.modalidad;
    fila[CS.ID_ESTADO]       = data.id_estado;
    fila[CS.ESTADO]          = data.estado;
    fila[CS.DESCRIPCION]     = data.descripcion || '';
    await verificarFila(sheets, HOJAS.SISTEMA, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A${sheetRow}:Q${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [fila] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!S${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[data.link_clase || '']] },
    });
    console.log('[sheets] modificarClase — OK, fila:', sheetRow);
  });
}

// ── Eliminar clase ─────────────────────────────────────────────
export async function eliminarClase(id) {
  console.log('[sheets] eliminarClase — id:', id);
  return withRetry(async () => {
    const sheets = await getClient();

    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.SISTEMA}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);

    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.SISTEMA);
    if (!sheet) throw new Error('Hoja RESERVAS(SISTEMA) no encontrada');
    const sheetId = sheet.properties.sheetId;

    const ids    = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    console.log('[sheets] eliminarClase — rowIdx:', rowIdx);
    if (rowIdx === -1) throw new Error(`Clase ${id} no encontrada`);

    // Verificación anti-race: confirmar que la celda sigue siendo este id antes de borrar
    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id)) {
      const err = new Error(`[eliminarClase] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
          },
        }],
      },
    });
    console.log('[sheets] eliminarClase — batchUpdate OK, fila eliminada:', rowIdx + 1);
  });
}

// ── Meta: alumnos, profesores, materias, modalidades, estados ──
export async function leerMeta() {
  console.log('[sheets] leerMeta — inicio');
  const sheets = await getClient();

  async function leerRango(rango) {
    try {
      const res = await withRetry(() => sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: rango,
        valueRenderOption: 'FORMATTED_VALUE',
      }));
      return res.data.values || [];
    } catch (err) {
      // Errores de autenticación o red son críticos — propagarlos
      const status = Number(err.code || err.status);
      if (status === 401 || status === 403) throw err;
      console.error(`[leerMeta] Error leyendo ${rango}:`, err.message);
      return [];
    }
  }

  // Leemos desde fila 2 para saltear el encabezado directamente en el rango
  const [alumnosRaw, profsRaw, materiasRaw, modalRaw, estadosRaw] = await Promise.all([
    leerRango(`${HOJAS.ALUMNOS}!A2:W`),
    leerRango(`${HOJAS.PROFESORES}!A2:F`),
    leerRango(`${HOJAS.MATERIAS}!A2:D`),
    leerRango(`${HOJAS.MODALIDADES}!A2:B`),
    leerRango(`${HOJAS.ESTADOS}!A2:B`),
  ]);

  const result = {
    alumnos: alumnosRaw
      .filter(r => r[1] || r[2])
      .map(r => ({
        id:     r[0]  || '',
        nombre: `${r[1] || ''} ${r[2] || ''}`.trim(),
        correo: r[5]  || '',   // col F
      })),

    profesores: profsRaw
      .filter(r => r[1] || r[2])
      .map(r => ({
        id:       r[0] || '',
        nombre:   `${r[1] || ''} ${r[2] || ''}`.trim(),
        telefono: r[3] || '',
        correo:   r[4] || '',
      })),

    // nombre_materia (B) · tipo_educacion (C) · nivel (D)
    materias: materiasRaw
      .filter(r => r[1])
      .map(r => ({
        id:     r[0] || '',
        nombre: r[1] || '',
        tipo:   r[2] || '',
        nivel:  r[3] || '',
        // label que muestra el dropdown: "Matemática — Primaria · 3°"
        label:  [r[1], [r[2], r[3]].filter(Boolean).join(' · ')].filter(Boolean).join(' — '),
      })),

    modalidades: modalRaw
      .filter(r => r[1])
      .map(r => ({ id: r[0] || '', nombre: r[1] || '' })),

    estados: estadosRaw
      .filter(r => r[1])
      .map(r => ({ id: r[0] || '', nombre: r[1] || '' })),
  };
  const alumnosConCorreo    = result.alumnos.filter(a => a.correo).length;
  const profesoresConCorreo = result.profesores.filter(p => p.correo).length;
  console.log('[sheets] leerMeta — alumnos:', result.alumnos.length,
    '| con correo:', alumnosConCorreo,
    '| profesores:', result.profesores.length,
    '| con correo:', profesoresConCorreo);
  if (alumnosConCorreo === 0)
    console.warn('[sheets] leerMeta — ADVERTENCIA: ningún alumno tiene correo en columna F de ALUMNOS');
  if (profesoresConCorreo === 0)
    console.warn('[sheets] leerMeta — ADVERTENCIA: ningún profesor tiene correo en columna E de PROFESORES');
  return result;
}

// ── DISPONIBILIDAD_SISTEMA ─────────────────────────────────────────────────

const CD = {
  ID_BLOQUE: 0, ID_PROFESOR: 1, NOMBRE_PROFESOR: 2,
  DIA: 3, HORA_INICIO: 4, HORA_FIN: 5, MODALIDAD: 6,
};
const CD_TOTAL = 7;

function rowToBloque(row) {
  return {
    id_bloque:       String(row[CD.ID_BLOQUE]    || ''),
    id_profesor:     String(row[CD.ID_PROFESOR]  || ''),
    nombre_profesor: row[CD.NOMBRE_PROFESOR]     || '',
    dia:             row[CD.DIA]                 || '',
    hora_inicio:     row[CD.HORA_INICIO]         || '',
    hora_fin:        row[CD.HORA_FIN]            || '',
    modalidad:       row[CD.MODALIDAD]           || '',
  };
}

export async function leerDisponibilidad() {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.DISPONIBILIDAD}!A:G`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    return rows.map(rowToBloque).filter(b => b.id_bloque);
  });
}

export async function crearBloque(data) {
  const sheets = await getClient();
  const id_bloque = Date.now();
  const fila = Array(CD_TOTAL).fill('');
  fila[CD.ID_BLOQUE]       = id_bloque;
  fila[CD.ID_PROFESOR]     = data.id_profesor;
  fila[CD.NOMBRE_PROFESOR] = data.nombre_profesor;
  fila[CD.DIA]             = data.dia;
  fila[CD.HORA_INICIO]     = data.hora_inicio;
  fila[CD.HORA_FIN]        = data.hora_fin;
  fila[CD.MODALIDAD]       = data.modalidad;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.DISPONIBILIDAD}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
  return { id_bloque };
}

export async function modificarBloque(id_bloque, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.DISPONIBILIDAD}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id_bloque));
    if (rowIdx === -1) throw new Error(`Bloque ${id_bloque} no encontrado`);
    const sheetRow = rowIdx + 1;
    const fila = Array(CD_TOTAL).fill('');
    fila[CD.ID_BLOQUE]       = id_bloque;
    fila[CD.ID_PROFESOR]     = data.id_profesor;
    fila[CD.NOMBRE_PROFESOR] = data.nombre_profesor;
    fila[CD.DIA]             = data.dia;
    fila[CD.HORA_INICIO]     = data.hora_inicio;
    fila[CD.HORA_FIN]        = data.hora_fin;
    fila[CD.MODALIDAD]       = data.modalidad;
    await verificarFila(sheets, HOJAS.DISPONIBILIDAD, rowIdx, id_bloque);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.DISPONIBILIDAD}!A${sheetRow}:G${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [fila] },
    });
  });
}

export async function eliminarBloque(id_bloque) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.DISPONIBILIDAD}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.DISPONIBILIDAD);
    if (!sheet) throw new Error('Hoja DISPONIBILIDAD_SISTEMA no encontrada');
    const sheetId = sheet.properties.sheetId;
    const ids = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id_bloque));
    if (rowIdx === -1) throw new Error(`Bloque ${id_bloque} no encontrado`);

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.DISPONIBILIDAD}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id_bloque)) {
      const err = new Error(`[eliminarBloque] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id_bloque}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
          },
        }],
      },
    });
  });
}

// ── PROFESORES CRUD ────────────────────────────────────────────────────────

export async function leerProfesores() {
  return withRetry(async () => {
    console.log('[sheets] leerProfesores — inicio');
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A:G`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    return rows
      .filter(r => r[0])
      .map(r => ({
        id:            String(r[0] || ''),
        nombre:        r[1] || '',
        apellido:      r[2] || '',
        telefono:      r[3] || '',
        correo:        r[4] || '',
        id_calendario: r[5] || '',
        disponible:    String(r[6] || '').toUpperCase() !== 'FALSE',
      }));
  });
}

export async function crearProfesor(data) {
  const sheets = await getClient();
  // Date.now() en lugar de max+1: evita TOCTOU con n8n/otros navegadores creando en paralelo.
  const nextId = Date.now();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.PROFESORES}!A:E`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nextId, data.nombre, data.apellido, data.telefono || '', data.correo || '']] },
  });
  return { id: nextId };
}

export async function modificarProfesor(id, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Profesor ${id} no encontrado`);
    await verificarFila(sheets, HOJAS.PROFESORES, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A${rowIdx + 1}:E${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[id, data.nombre, data.apellido, data.telefono || '', data.correo || '']] },
    });
  });
}

export async function bloquearProfesor(id, disponible) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Profesor ${id} no encontrado`);
    await verificarFila(sheets, HOJAS.PROFESORES, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!G${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[disponible ? 'TRUE' : 'FALSE']] },
    });
  });
}

// ── MATERIA-PROFESOR CRUD ─────────────────────────────────────────────────────

const CMP = { ID_MATERIA: 0, ID_PROFESOR: 1 };

export async function leerMateriasProfesor(id_profesor = null) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIA_PROFESOR}!A:B`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1).filter(r => r[0]);
    const all = rows.map(r => ({
      id_materia:  String(r[CMP.ID_MATERIA]  || ''),
      id_profesor: String(r[CMP.ID_PROFESOR] || ''),
    }));
    return id_profesor ? all.filter(r => r.id_profesor === String(id_profesor)) : all;
  });
}

export async function asignarMateria(id_materia, id_profesor) {
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.MATERIA_PROFESOR}!A:B`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[id_materia, id_profesor]] },
  });
}

export async function desasignarMateria(id_materia, id_profesor) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.MATERIA_PROFESOR}!A:B`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.MATERIA_PROFESOR);
    if (!sheet) throw new Error('Hoja materia-profesor no encontrada');
    const sheetId = sheet.properties.sheetId;
    const rows = colRes.data.values || [];
    const rowIdx = rows.findIndex((r, i) =>
      i > 0 && String(r[0]) === String(id_materia) && String(r[1]) === String(id_profesor)
    );
    if (rowIdx === -1) throw new Error('Asignación no encontrada');

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIA_PROFESOR}!A${rowIdx + 1}:B${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const vRow = verify.data.values?.[0] || [];
    if (String(vRow[0] || '') !== String(id_materia) || String(vRow[1] || '') !== String(id_profesor)) {
      const err = new Error(`[desasignarMateria] verificación falló en fila ${rowIdx + 1}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }],
      },
    });
  });
}

// ── MATERIAS CRUD ────────────────────────────────────────────────────────────

const CM = { ID: 0, NOMBRE: 1, TIPO_EDU: 2, NIVEL: 3 };

export async function leerMaterias() {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIAS}!A:D`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    return rows
      .filter(r => r[0])
      .map(r => ({
        id:             String(r[CM.ID]      || ''),
        nombre:         r[CM.NOMBRE]         || '',
        tipo_educacion: r[CM.TIPO_EDU]       || '',
        nivel:          r[CM.NIVEL]          || '',
      }));
  });
}

export async function crearMateria(data) {
  const sheets = await getClient();
  const nextId = Date.now();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.MATERIAS}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[nextId, data.nombre, data.tipo_educacion || '', data.nivel || '']] },
  });
  return { id: nextId };
}

export async function modificarMateria(id, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIAS}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Materia ${id} no encontrada`);
    await verificarFila(sheets, HOJAS.MATERIAS, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIAS}!A${rowIdx + 1}:D${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[id, data.nombre, data.tipo_educacion || '', data.nivel || '']] },
    });
  });
}

export async function eliminarMateria(id) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.MATERIAS}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.MATERIAS);
    if (!sheet) throw new Error('Hoja materias_db no encontrada');
    const sheetId = sheet.properties.sheetId;
    const ids = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Materia ${id} no encontrada`);

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.MATERIAS}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id)) {
      const err = new Error(`[eliminarMateria] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }],
      },
    });
  });
}

// ── ALUMNOS CRUD ─────────────────────────────────────────────────────────────

const CA = {
  ID: 0,           NOMBRE: 1,         APELLIDO: 2,
  TELEFONO: 3,     TEL_ALT: 4,        CORREO: 5,
  TIPO_EDU: 6,     NIVEL: 7,          COLEGIO: 8,
  TIENE_CUD: 9,    CONDICION: 10,
  TIENE_PSICO: 11, PSICO_NOMBRE: 12,  PSICO_TEL: 13,
  TIENE_FONO: 14,  FONO_NOMBRE: 15,   FONO_TEL: 16,
  TIENE_PSICOL:17, PSICOL_NOMBRE: 18, PSICOL_TEL: 19,
  TIENE_TEO: 20,   TEO_NOMBRE: 21,    TEO_TEL_CONTACTO: 22,
};
const CA_TOTAL = 23; // A:W

function rowToAlumno(row) {
  return {
    id:                  String(row[CA.ID]              || ''),
    nombre:              row[CA.NOMBRE]                 || '',
    apellido:            row[CA.APELLIDO]               || '',
    telefono:            row[CA.TELEFONO]               || '',
    tel_alternativo:     row[CA.TEL_ALT]                || '',
    correo:              row[CA.CORREO]                 || '',
    tipo_educacion:      row[CA.TIPO_EDU]               || '',
    nivel:               row[CA.NIVEL]                  || '',
    colegio:             row[CA.COLEGIO]                || '',
    tiene_CUD:           row[CA.TIENE_CUD]              || 'NO',
    condicion:           row[CA.CONDICION]              || '',
    tiene_psicopedagoga: row[CA.TIENE_PSICO]            || 'NO',
    psico_nombre:        row[CA.PSICO_NOMBRE]           || '',
    psico_tel:           row[CA.PSICO_TEL]              || '',
    tiene_fono:          row[CA.TIENE_FONO]             || 'NO',
    fono_nombre:         row[CA.FONO_NOMBRE]            || '',
    fono_tel:            row[CA.FONO_TEL]               || '',
    tiene_psicologo:     row[CA.TIENE_PSICOL]           || 'NO',
    psicologo_nombre:    row[CA.PSICOL_NOMBRE]          || '',
    psicologo_tel:       row[CA.PSICOL_TEL]             || '',
    tiene_teo:           row[CA.TIENE_TEO]              || 'NO',
    teo_nombre:          row[CA.TEO_NOMBRE]             || '',
    teo_tel_contacto:    row[CA.TEO_TEL_CONTACTO]       || '',
  };
}

function alumnoToFila(id, data) {
  const fila = Array(CA_TOTAL).fill('');
  fila[CA.ID]                = id;
  fila[CA.NOMBRE]            = data.nombre              || '';
  fila[CA.APELLIDO]          = data.apellido            || '';
  fila[CA.TELEFONO]          = data.telefono            || '';
  fila[CA.TEL_ALT]           = data.tel_alternativo     || '';
  fila[CA.CORREO]            = data.correo              || '';
  fila[CA.TIPO_EDU]          = data.tipo_educacion      || '';
  fila[CA.NIVEL]             = data.nivel               || '';
  fila[CA.COLEGIO]           = data.colegio             || '';
  fila[CA.TIENE_CUD]         = data.tiene_CUD           || 'NO';
  fila[CA.CONDICION]         = data.condicion           || '';
  fila[CA.TIENE_PSICO]       = data.tiene_psicopedagoga || 'NO';
  fila[CA.PSICO_NOMBRE]      = data.psico_nombre        || '';
  fila[CA.PSICO_TEL]         = data.psico_tel           || '';
  fila[CA.TIENE_FONO]        = data.tiene_fono          || 'NO';
  fila[CA.FONO_NOMBRE]       = data.fono_nombre         || '';
  fila[CA.FONO_TEL]          = data.fono_tel            || '';
  fila[CA.TIENE_PSICOL]      = data.tiene_psicologo     || 'NO';
  fila[CA.PSICOL_NOMBRE]     = data.psicologo_nombre    || '';
  fila[CA.PSICOL_TEL]        = data.psicologo_tel       || '';
  fila[CA.TIENE_TEO]         = data.tiene_teo           || 'NO';
  fila[CA.TEO_NOMBRE]        = data.teo_nombre          || '';
  fila[CA.TEO_TEL_CONTACTO]  = data.teo_tel_contacto    || '';
  return fila;
}

export async function leerAlumnos() {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.ALUMNOS}!A:W`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    return rows.filter(r => r[0]).map(rowToAlumno);
  });
}

export async function crearAlumno(data) {
  const sheets = await getClient();
  const nextId = Date.now();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.ALUMNOS}!A:W`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [alumnoToFila(nextId, data)] },
  });
  return { id: nextId };
}

export async function modificarAlumno(id, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.ALUMNOS}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Alumno ${id} no encontrado`);
    await verificarFila(sheets, HOJAS.ALUMNOS, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.ALUMNOS}!A${rowIdx + 1}:W${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [alumnoToFila(id, data)] },
    });
  });
}

export async function eliminarAlumno(id) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.ALUMNOS}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.ALUMNOS);
    if (!sheet) throw new Error('Hoja ALUMNOS no encontrada');
    const sheetId = sheet.properties.sheetId;
    const ids = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Alumno ${id} no encontrado`);

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.ALUMNOS}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id)) {
      const err = new Error(`[eliminarAlumno] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }],
      },
    });
  });
}

// ── Google Calendar helpers ────────────────────────────────────────────────────

export async function leerIdCalendarioProfesor(id_profesor) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A:F`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    const row  = rows.find(r => String(r[0]) === String(id_profesor));
    return (row && row[5]) ? row[5] : null;
  });
}

export async function limpiarIdCalendarTodas() {
  return withRetry(async () => {
    const sheets = await getClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!R2:R`,
    });
    console.log('[sheets] limpiarIdCalendarTodas — columna R limpiada');
  });
}

export async function guardarIdCalendar(id_clase, eventId) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids    = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id_clase));
    if (rowIdx === -1) return;
    await verificarFila(sheets, HOJAS.SISTEMA, rowIdx, id_clase);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!R${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[eventId || '']] },
    });
    console.log('[sheets] guardarIdCalendar — OK | id_clase:', id_clase, '| eventId:', eventId || '(vacío)');
  });
}

export async function eliminarProfesor(id) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.PROFESORES}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.PROFESORES);
    if (!sheet) throw new Error('Hoja PROFESORES no encontrada');
    const sheetId = sheet.properties.sheetId;
    const ids = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Profesor ${id} no encontrado`);

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.PROFESORES}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id)) {
      const err = new Error(`[eliminarProfesor] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
          },
        }],
      },
    });
  });
}

// ── CLASES FIJAS (templates recurrentes) ──────────────────────────────────────

const CF = {
  ID: 0,         DIA: 1,         HORA_INICIO: 2, HORA_FIN: 3,
  ID_ALUMNO: 4,  NOMBRE_ALUMNO: 5,
  ID_PROFESOR: 6, NOMBRE_PROFESOR: 7,
  ID_MATERIA: 8,  NOMBRE_MATERIA: 9,
  ID_MODALIDAD: 10, MODALIDAD: 11,
  ID_ESTADO: 12,  ESTADO: 13,
  FECHA_INICIO: 14, FECHA_FIN: 15,
  ID_CALENDAR: 16,
};
const CF_TOTAL = 17;

function rowToRecurrente(row) {
  return {
    id:              String(row[CF.ID]              || ''),
    dia_semana:      row[CF.DIA]                    || '',
    hora_inicio:     row[CF.HORA_INICIO]            || '',
    hora_fin:        row[CF.HORA_FIN]               || '',
    id_alumno:       String(row[CF.ID_ALUMNO]       || ''),
    nombre_alumno:   row[CF.NOMBRE_ALUMNO]          || '',
    id_profesor:     String(row[CF.ID_PROFESOR]     || ''),
    nombre_profesor: row[CF.NOMBRE_PROFESOR]        || '',
    id_materia:      String(row[CF.ID_MATERIA]      || ''),
    nombre_materia:  row[CF.NOMBRE_MATERIA]         || '',
    id_modalidad:    String(row[CF.ID_MODALIDAD]    || ''),
    modalidad:       row[CF.MODALIDAD]              || '',
    id_estado:       String(row[CF.ID_ESTADO]       || ''),
    estado:          row[CF.ESTADO]                 || '',
    fecha_inicio:    row[CF.FECHA_INICIO]           || '',
    fecha_fin:       row[CF.FECHA_FIN]              || '',
    id_calendar:     row[CF.ID_CALENDAR]            || '',
  };
}

// 16 columnas A:P — NO incluye ID_CALENDAR (col Q) para preservar el vínculo GCal
function recurrenteToFila(id, d) {
  const fila = Array(CF_TOTAL - 1).fill('');
  fila[CF.ID]              = id;
  fila[CF.DIA]             = d.dia_semana      || '';
  fila[CF.HORA_INICIO]     = d.hora_inicio     || '';
  fila[CF.HORA_FIN]        = d.hora_fin        || '';
  fila[CF.ID_ALUMNO]       = d.id_alumno       || '';
  fila[CF.NOMBRE_ALUMNO]   = d.nombre_alumno   || '';
  fila[CF.ID_PROFESOR]     = d.id_profesor     || '';
  fila[CF.NOMBRE_PROFESOR] = d.nombre_profesor || '';
  fila[CF.ID_MATERIA]      = d.id_materia      || '';
  fila[CF.NOMBRE_MATERIA]  = d.nombre_materia  || '';
  fila[CF.ID_MODALIDAD]    = d.id_modalidad    || '';
  fila[CF.MODALIDAD]       = d.modalidad       || '';
  fila[CF.ID_ESTADO]       = d.id_estado       || '';
  fila[CF.ESTADO]          = d.estado          || '';
  fila[CF.FECHA_INICIO]    = d.fecha_inicio    || '';
  fila[CF.FECHA_FIN]       = d.fecha_fin       || '';
  return fila;
}

export async function leerRecurrentes() {
  return withRetry(async () => {
    const sheets = await getClient();
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.CLASES_FIJAS}!A:Q`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      const isData = r => /^\d+$/.test(String(r[0] || ''));
      return (res.data.values || []).filter(isData).map(rowToRecurrente);
    } catch (err) {
      // Hoja no existe aún → devolver vacío en lugar de explotar
      if (err.code === 400 || (err.message || '').includes('Unable to parse range')) return [];
      throw err;
    }
  });
}

export async function crearRecurrente(data) {
  const sheets = await getClient();
  const nextId = Date.now();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.CLASES_FIJAS}!A:P`,  // A:P — id_calendar (Q) queda vacío al crear
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [recurrenteToFila(nextId, data)] },
  });
  return { id: nextId };
}

export async function modificarRecurrente(id, data) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.CLASES_FIJAS}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids    = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Template ${id} no encontrado`);
    await verificarFila(sheets, HOJAS.CLASES_FIJAS, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.CLASES_FIJAS}!A${rowIdx + 1}:P${rowIdx + 1}`, // A:P — preserva id_calendar (Q)
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [recurrenteToFila(id, data)] },
    });
  });
}

export async function guardarIdCalendarRecurrente(id, eventId) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.CLASES_FIJAS}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const ids    = res.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) return;
    await verificarFila(sheets, HOJAS.CLASES_FIJAS, rowIdx, id);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.CLASES_FIJAS}!Q${rowIdx + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[eventId || '']] },
    });
  });
}

export async function eliminarRecurrente(id) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.CLASES_FIJAS}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.CLASES_FIJAS);
    if (!sheet) throw new Error('Hoja CLASES_FIJAS no encontrada');
    const ids    = colRes.data.values || [];
    const rowIdx = ids.findIndex((r, i) => i > 0 && /^\d+$/.test(String(r[0] || '')) && String(r[0]) === String(id));
    if (rowIdx === -1) throw new Error(`Template ${id} no encontrado`);

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.CLASES_FIJAS}!A${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const actual = String(verify.data.values?.[0]?.[0] || '');
    if (actual !== String(id)) {
      const err = new Error(`[eliminarRecurrente] verificación falló: fila ${rowIdx + 1} tiene ${actual}, esperaba ${id}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: {
          sheetId: sheet.properties.sheetId, dimension: 'ROWS',
          startIndex: rowIdx, endIndex: rowIdx + 1,
        }}}],
      },
    });
  });
}

// Elimina múltiples clases por id_clase en una sola llamada.
// Anti-race: re-verifica los índices justo antes del batchUpdate para tolerar inserts/deletes
// concurrentes (bot n8n, otros navegadores). Ids que ya no aparecen se skipean en silencio;
// los que se desplazaron se mapean a su nueva posición.
export async function eliminarClasesBatch(idClases) {
  if (!idClases.length) return;
  return withRetry(async () => {
    const sheets = await getClient();

    const spreadRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadRes.data.sheets.find(s => s.properties.title === HOJAS.SISTEMA);
    if (!sheet) return;

    const idSet = new Set(idClases.map(String));

    // Lectura de verificación justo antes del batchUpdate.
    const verifyRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.SISTEMA}!A:A`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = verifyRes.data.values || [];

    // id → idx actual en el Sheet. Si un id aparece duplicado (bug de IDs colisionados),
    // borramos todas las ocurrencias.
    const verifiedIdxs = [];
    const foundIds = new Set();
    rows.forEach((r, i) => {
      if (i === 0) return; // header
      const id = r[0] != null ? String(r[0]) : '';
      if (idSet.has(id)) {
        verifiedIdxs.push(i);
        foundIds.add(id);
      }
    });

    const missing = [...idSet].filter(id => !foundIds.has(id));
    if (missing.length) {
      console.warn(`[eliminarClasesBatch] ${missing.length} ids ya no presentes (skipeados):`, missing.join(','));
    }

    if (!verifiedIdxs.length) return;

    const requests = verifiedIdxs
      .sort((a, b) => b - a) // de abajo hacia arriba para no desplazar índices
      .map(idx => ({
        deleteDimension: {
          range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 },
        },
      }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log(`[eliminarClasesBatch] eliminadas: ${verifiedIdxs.length}, skipeadas: ${missing.length}`);
  });
}

export async function crearClasesBatch(clases) {
  console.log('[sheets] crearClasesBatch - cantidad:', clases.length);
  if (!clases.length) return [];
  const sheets  = await getClient();
  const baseId  = Date.now();

  const entries = clases.map((data, i) => {
    const id_clase = baseId + i;
    const duracion = calcDuracion(data.hora_inicio, data.hora_fin);
    const iso8601  = buildISO8601(data.fecha, data.hora_inicio);

    const fila = Array(CS_TOTAL).fill('');
    fila[CS.ID_CLASE]        = id_clase;
    fila[CS.ISO8601]         = iso8601;
    fila[CS.DURACION]        = duracion;
    fila[CS.FECHA]           = formatFechaSheets(data.fecha);
    fila[CS.HORA_INICIO]     = data.hora_inicio;
    fila[CS.HORA_FIN]        = data.hora_fin;
    fila[CS.ID_ALUMNO]       = data.id_alumno;
    fila[CS.NOMBRE_ALUMNO]   = data.nombre_alumno;
    fila[CS.ID_PROFESOR]     = data.id_profesor;
    fila[CS.NOMBRE_PROFESOR] = data.nombre_profesor;
    fila[CS.ID_MATERIA]      = data.id_materia;
    fila[CS.NOMBRE_MATERIA]  = data.nombre_materia;
    fila[CS.ID_MODALIDAD]    = data.id_modalidad;
    fila[CS.MODALIDAD]       = data.modalidad;
    fila[CS.ID_ESTADO]       = data.id_estado;
    fila[CS.ESTADO]          = data.estado;
    fila[CS.DESCRIPCION]     = data.descripcion || '';

    return { id_clase, data, fila };
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.SISTEMA}!A:Q`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: entries.map(e => e.fila) },
  });

  console.log('[sheets] crearClasesBatch - OK, ids:', entries.map(e => e.id_clase).join(', '));
  return entries.map(e => ({ id_clase: e.id_clase, ...e.data }));
}

// ── BLOQUEOS_PROFESOR (días bloqueados por profesor) ─────────────────────────
// La hoja guarda la fecha como texto YYYY-MM-DD (misma convención que FERIADOS).
// El bot n8n (check_availability) también acepta dd/MM/yyyy, así que toleramos
// ambos formatos al leer por si alguien carga a mano en el Sheet.

function normFechaBloqueo(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  return '';
}

export async function leerBloqueos(id_profesor = null) {
  return withRetry(async () => {
    const sheets = await getClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.BLOQUEOS}!A:B`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values || []).slice(1);
    const all = rows
      .map(r => ({ id_profesor: String(r[0] || ''), fecha: normFechaBloqueo(r[1]) }))
      .filter(b => b.id_profesor && b.fecha);
    return id_profesor ? all.filter(b => b.id_profesor === String(id_profesor)) : all;
  });
}

export async function agregarBloqueos(id_profesor, fechas) {
  const existentes = new Set((await leerBloqueos(id_profesor)).map(b => b.fecha));
  const nuevas = [...new Set(fechas)].filter(f => !existentes.has(f)).sort();
  if (!nuevas.length) return { agregadas: 0 };
  const sheets = await getClient();
  // RAW: la fecha queda como texto plano YYYY-MM-DD, sin conversión por locale del Sheet
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${HOJAS.BLOQUEOS}!A:B`,
    valueInputOption: 'RAW',
    requestBody: { values: nuevas.map(f => [Number(id_profesor), f]) },
  });
  console.log('[sheets] agregarBloqueos — profesor:', id_profesor, '| fechas:', nuevas.join(','));
  return { agregadas: nuevas.length };
}

export async function eliminarBloqueo(id_profesor, fecha) {
  return withRetry(async () => {
    const sheets = await getClient();
    const [metaRes, colRes] = await Promise.all([
      sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${HOJAS.BLOQUEOS}!A:B`,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
    ]);
    const sheet = metaRes.data.sheets.find(s => s.properties.title === HOJAS.BLOQUEOS);
    if (!sheet) throw new Error('Hoja BLOQUEOS_PROFESOR no encontrada');
    const rows = colRes.data.values || [];
    const rowIdx = rows.findIndex((r, i) =>
      i > 0 && String(r[0]) === String(id_profesor) && normFechaBloqueo(r[1]) === fecha
    );
    if (rowIdx === -1) throw new Error('Bloqueo no encontrado');

    const verify = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${HOJAS.BLOQUEOS}!A${rowIdx + 1}:B${rowIdx + 1}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const vRow = verify.data.values?.[0] || [];
    if (String(vRow[0] || '') !== String(id_profesor) || normFechaBloqueo(vRow[1]) !== fecha) {
      const err = new Error(`[eliminarBloqueo] verificación falló en fila ${rowIdx + 1}`);
      err.status = 503;
      throw err;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 } } }],
      },
    });
    console.log('[sheets] eliminarBloqueo — profesor:', id_profesor, '| fecha:', fecha, '| fila:', rowIdx + 1);
  });
}
