import { leerBloqueos, agregarBloqueos, eliminarBloqueo } from '../../../lib/sheets';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { id_profesor } = req.query;
      res.json(await leerBloqueos(id_profesor || null));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { id_profesor, fechas } = req.body;
      if (!id_profesor || !Array.isArray(fechas) || !fechas.length)
        return res.status(400).json({ error: 'id_profesor y fechas[] son requeridos' });
      if (fechas.some(f => !ISO_RE.test(String(f))))
        return res.status(400).json({ error: 'Las fechas deben tener formato YYYY-MM-DD' });

      const { agregadas } = await agregarBloqueos(id_profesor, fechas.map(String));
      res.status(201).json({ ok: true, agregadas });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const { id_profesor, fecha } = req.query;
      if (!id_profesor || !ISO_RE.test(String(fecha || '')))
        return res.status(400).json({ error: 'id_profesor y fecha (YYYY-MM-DD) son requeridos' });
      await eliminarBloqueo(id_profesor, String(fecha));
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
