import { leerClases, modificarAlumno, eliminarAlumno } from '../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { nombre, apellido } = req.body;
      if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son requeridos' });
      await modificarAlumno(id, req.body);
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
      const count = clases.filter(c => String(c.id_alumno) === String(id)).length;
      if (count > 0) {
        return res.status(409).json({
          error: `El alumno tiene ${count} clase(s) registrada(s) y no puede ser eliminado`,
        });
      }
      await eliminarAlumno(id);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
