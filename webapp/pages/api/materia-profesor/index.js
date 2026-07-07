import { leerMateriasProfesor, asignarMateria, desasignarMateria } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { id_profesor } = req.query;
      res.json(await leerMateriasProfesor(id_profesor || null));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { id_materia, id_profesor } = req.body;
      if (!id_materia || !id_profesor)
        return res.status(400).json({ error: 'id_materia e id_profesor son requeridos' });

      // Check for duplicate
      const existing = await leerMateriasProfesor(id_profesor);
      if (existing.some(r => r.id_materia === String(id_materia)))
        return res.status(409).json({ error: 'El profesor ya tiene esa materia asignada' });

      await asignarMateria(id_materia, id_profesor);
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const { id_materia, id_profesor } = req.query;
      if (!id_materia || !id_profesor)
        return res.status(400).json({ error: 'id_materia e id_profesor son requeridos' });
      await desasignarMateria(id_materia, id_profesor);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
