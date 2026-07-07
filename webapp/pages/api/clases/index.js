import { leerClases, guardarIdCalendar, leerIdCalendarioProfesor } from '../../../lib/sheets';
import { crearReservaConLock } from '../../../lib/reservas';
import { crearEvento } from '../../../lib/gcal';

export default async function handler(req, res) {
  console.log(`[api:clases] ${req.method}`);

  if (req.method === 'GET') {
    try {
      const clases = await leerClases();
      res.json(clases);
    } catch (err) {
      console.error('[api:clases] GET error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { id_clase } = await crearReservaConLock(req.body);
      console.log('[api:clases] POST — clase creada id_clase:', id_clase);
      // GCal en background (no bloquea la respuesta)
      syncCrear(id_clase, req.body).catch(e => console.error('[gcal] POST sync error:', e.message));
      res.status(201).json({ id_clase });
    } catch (err) {
      if (err.status === 409) {
        console.warn('[api:clases] POST 409 slot ocupado:', err.motivo);
        return res.status(409).json({ error: 'slot_ocupado', motivo: err.motivo });
      }
      console.error('[api:clases] POST error:', err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}

async function syncCrear(id_clase, body) {
  if (!body.id_profesor) return;
  const calProf = await leerIdCalendarioProfesor(body.id_profesor).catch(() => null);
  if (!calProf) {
    console.log('[gcal] syncCrear — SKIP: profesor sin calendarId | id_profesor:', body.id_profesor);
    return;
  }
  const eventId = await crearEvento(body, 'none', calProf);
  await guardarIdCalendar(id_clase, eventId);
  console.log('[gcal] syncCrear — eventId guardado:', eventId, '| calProf:', calProf);
}
