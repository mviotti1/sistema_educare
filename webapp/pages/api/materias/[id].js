import { leerClases, leerMaterias, modificarMateria, eliminarMateria } from '../../../lib/sheets';

function isDup(materias, { nombre, tipo_educacion, nivel }, excludeId) {
  return materias.some(m =>
    String(m.id) !== String(excludeId) &&
    m.nombre.trim().toLowerCase()         === nombre.trim().toLowerCase() &&
    m.tipo_educacion.trim().toLowerCase() === tipo_educacion.trim().toLowerCase() &&
    (m.nivel || '').trim().toLowerCase()  === (nivel || '').trim().toLowerCase()
  );
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { nombre, tipo_educacion, nivel } = req.body;
      const esUniv = (tipo_educacion || '').toUpperCase() === 'UNIVERSITARIO';
      if (!nombre || !tipo_educacion || (!esUniv && !nivel))
        return res.status(400).json({ error: 'Todos los campos son requeridos' });

      const materias = await leerMaterias();
      if (isDup(materias, { nombre, tipo_educacion, nivel: nivel || '' }, id))
        return res.status(409).json({ error: 'Ya existe una materia con ese nombre, tipo y nivel' });

      await modificarMateria(id, req.body);
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
      const count = clases.filter(c => String(c.id_materia) === String(id)).length;
      if (count > 0)
        return res.status(409).json({ error: `La materia tiene ${count} clase(s) registrada(s) y no puede ser eliminada` });

      await eliminarMateria(id);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).end();
}
