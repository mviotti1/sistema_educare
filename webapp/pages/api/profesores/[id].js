import { leerClases, modificarProfesor, eliminarProfesor, bloquearProfesor } from '../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { disponible } = req.body;
      if (typeof disponible !== 'boolean')
        return res.status(400).json({ error: 'disponible debe ser booleano' });
      await bloquearProfesor(id, disponible);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const { nombre, apellido, telefono, correo } = req.body;
      if (!nombre || !apellido || !telefono || !correo)
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
      await modificarProfesor(id, req.body);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const clases = await leerClases();
      const count = clases.filter(c => String(c.id_profesor) === String(id)).length;
      if (count > 0) {
        return res.status(409).json({
          error: `El profesor tiene ${count} clase(s) registrada(s) y no puede ser eliminado`,
        });
      }
      await eliminarProfesor(id);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
