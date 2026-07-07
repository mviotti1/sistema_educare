import { leerClase, eliminarClase, guardarIdCalendar, leerIdCalendarioProfesor } from '../../../lib/sheets';
import { modificarReservaConLock } from '../../../lib/reservas';
import { crearEvento, actualizarEvento } from '../../../lib/gcal';

export default async function handler(req, res) {
  const { id } = req.query;
  console.log(`[api:clases/${id}] ${req.method}`);

  if (req.method === 'GET') {
    try {
      const clase = await leerClase(id);
      if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
      res.json(clase);
    } catch (err) {
      console.error(`[api:clases/${id}] GET error:`, err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const claseActual = await leerClase(id);
      if (!claseActual) return res.status(404).json({ error: 'Clase no encontrada' });
      await modificarReservaConLock(id, req.body);
      // GCal en background
      syncActualizar(id, claseActual, req.body).catch(e =>
        console.error(`[gcal] PUT sync error — clase ${id} id_calendar ${claseActual.id_calendar || '(sin evento)'}:`, e.message)
      );
      res.json({ ok: true });
    } catch (err) {
      if (err.status === 409) {
        console.warn(`[api:clases/${id}] PUT 409 slot ocupado:`, err.motivo);
        return res.status(409).json({ error: 'slot_ocupado', motivo: err.motivo });
      }
      console.error(`[api:clases/${id}] PUT error:`, err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const claseActual = await leerClase(id);
      if (!claseActual) return res.status(404).json({ error: 'Clase no encontrada' });
      await eliminarClase(id);
      // No tocamos el evento de Calendar: queda como historial.
      console.log(`[api:clases/${id}] DELETE OK — evento Calendar ${claseActual.id_calendar || '(sin evento)'} preservado como historial`);
      res.json({ ok: true });
    } catch (err) {
      console.error(`[api:clases/${id}] DELETE error:`, err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}

async function syncActualizar(id_clase, claseActual, body) {
  const idProfAnterior = String(claseActual.id_profesor || '');
  const idProfNuevo    = String(body.id_profesor || idProfAnterior);
  const profesorCambia = idProfAnterior && idProfNuevo && idProfAnterior !== idProfNuevo;

  console.log('[gcal] syncActualizar — id_calendar:', claseActual.id_calendar || '(none)',
    '| profesorCambia:', profesorCambia, '| id_estado:', body.id_estado);

  const calNuevo = idProfNuevo ? await leerIdCalendarioProfesor(idProfNuevo).catch(() => null) : null;

  if (profesorCambia) {
    // El evento del profesor anterior queda como historial en su calendario (no se borra).
    if (calNuevo) {
      const newEventId = await crearEvento(body, 'none', calNuevo);
      await guardarIdCalendar(id_clase, newEventId);
      console.log('[gcal] syncActualizar — re-asignado a nuevo prof, eventId:', newEventId,
        '| evento del prof anterior preservado como historial');
    }
  } else if (calNuevo) {
    if (claseActual.id_calendar) {
      try {
        await actualizarEvento(claseActual.id_calendar, body, 'none', calNuevo);
      } catch (e) {
        if (e.code === 404 || e.status === 404 || e.code === 410) {
          const newEventId = await crearEvento(body, 'none', calNuevo);
          await guardarIdCalendar(id_clase, newEventId);
          console.log('[gcal] syncActualizar — re-creado eventId:', newEventId);
        } else throw e;
      }
    } else {
      const newEventId = await crearEvento(body, 'none', calNuevo);
      await guardarIdCalendar(id_clase, newEventId);
      console.log('[gcal] syncActualizar — nuevo eventId:', newEventId);
    }
  }
}

