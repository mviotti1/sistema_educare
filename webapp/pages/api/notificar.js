const META_URL = 'https://graph.facebook.com/v25.0/976800925526826/messages';

const ESTADOS_AGENDADA  = new Set(['1']);
const ESTADOS_CANCELADA = new Set(['3', '4', '5']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { clase, telefono_profesor, nombre_materia, tipo_materia } = req.body || {};

  if (!clase || !telefono_profesor) {
    return res.status(400).json({ error: 'Faltan datos: clase y telefono_profesor son requeridos' });
  }

  const estadoId = String(clase.id_estado);
  if (!ESTADOS_AGENDADA.has(estadoId) && !ESTADOS_CANCELADA.has(estadoId)) {
    return res.status(400).json({ error: `Estado ${estadoId} no elegible para notificación` });
  }

  const token    = process.env.META_WA_TOKEN;
  const telefono = telefono_profesor.replace(/\D/g, '');

  if (!token)    return res.status(500).json({ error: 'META_WA_TOKEN no configurado' });
  if (!telefono) return res.status(400).json({ error: 'Teléfono del profesor no válido' });

  let payload;

  if (ESTADOS_AGENDADA.has(estadoId)) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'template',
      template: {
        name: 'profesor_recordatorio_clase_agendada',
        language: { code: 'es' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'fecha',       text: String(clase.fecha       || '') },
            { type: 'text', parameter_name: 'hora_inicio', text: String(clase.hora_inicio || '') },
            { type: 'text', parameter_name: 'modalidad',   text: String(clase.modalidad   || '') },
            { type: 'text', parameter_name: 'materia',     text: String(nombre_materia    || '') },
            { type: 'text', parameter_name: 'nivel',       text: String(tipo_materia      || '') },
            { type: 'text', parameter_name: 'duracion',    text: String(clase.duracion    || '') },
          ],
        }],
      },
    };
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: telefono,
      type: 'template',
      template: {
        name: 'profesor_recordatorio_clase_cancelada',
        language: { code: 'es' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'fecha',       text: String(clase.fecha       || '') },
            { type: 'text', parameter_name: 'hora_inicio', text: String(clase.hora_inicio || '') },
            { type: 'text', parameter_name: 'duracion',    text: String(clase.duracion    || '') },
          ],
        }],
      },
    };
  }

  try {
    const metaRes = await fetch(META_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[api:notificar] Meta error:', data);
      return res.status(502).json({ error: data?.error?.message || 'Error al enviar notificación' });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[api:notificar] fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
