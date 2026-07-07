import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClaseForm from '../../components/ClaseForm';
import { mensajeSlot } from '../../lib/motivos';

export default function EditarClase() {
  const router  = useRouter();
  const { id }  = router.query;
  const [meta, setMeta]   = useState(null);
  const [clase, setClase] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch('/api/meta').then(r => r.json()),
      fetch(`/api/clases/${id}`).then(r => r.json()),
    ]).then(([m, c]) => {
      setMeta(m);
      setClase(c);
    });
  }, [id]);

  async function handleSubmit(data) {
    setError('');
    const res = await fetch(`/api/clases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json();
      setError(mensajeSlot(e, 'Error al modificar la clase'));
      return;
    }
    router.push('/');
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar la clase ${id}? Esta acción no se puede deshacer.`)) return;
    setError('');
    const res = await fetch(`/api/clases/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error || 'Error al eliminar la clase');
      return;
    }
    router.push('/');
  }

  if (!meta || !clase) return <p>Cargando...</p>;
  if (clase.error)      return <p>Error: {clase.error}</p>;

  return (
    <div>
      <h1>Editar clase — {id}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ClaseForm meta={meta} inicial={clase} onSubmit={handleSubmit} submitLabel="Guardar cambios" />
      <hr />
      <button onClick={handleEliminar} style={{ color: 'red' }}>Eliminar clase</button>
    </div>
  );
}
