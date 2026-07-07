import { leerRecurrentes, modificarRecurrente, eliminarRecurrente } from '../../../lib/sheets';
import { eliminarEvento } from '../../../lib/gcal';
import { generarInstancias, eliminarInstancias, rangoTemplate, dateStr } from '../../../lib/recurrentes';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      // Leer template viejo ANTES de modificar para saber qué instancias borrar
      const templates = await leerRecurrentes();
      const viejo = templates.find(t => String(t.id) === String(id));

      await modificarRecurrente(id, req.body);
      res.json({ ok: true });

      const nuevo = { ...req.body, id };

      // Web calendar: borrar instancias del template viejo y generar las nuevas
      const { desde, hasta } = rangoTemplate(nuevo);
      async function reemplazarWeb() {
        if (viejo) await eliminarInstancias(viejo, desde, hasta);
        await generarInstancias(nuevo, desde, hasta);
      }
      reemplazarWeb().catch(err => console.error('[recurrentes] web update error:', err.message));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const templates = await leerRecurrentes();
      const current   = templates.find(t => String(t.id) === String(id));
      await eliminarRecurrente(id);
      res.json({ ok: true });

      // GCal: eliminar evento recurrente
      if (current?.id_calendar) {
        eliminarEvento(current.id_calendar)
          .catch(err => console.error('[recurrentes] GCal delete error:', err.message));
      }

      // Web calendar: eliminar instancias futuras (preservar historial pasado)
      if (current) {
        const hoy   = dateStr(new Date());
        const hasta = current.fecha_fin || (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          return dateStr(d);
        })();
        eliminarInstancias(current, hoy, hasta)
          .catch(err => console.error('[recurrentes] web delete error:', err.message));
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
