import { useState, useEffect } from 'react';
import { useDialog } from '../../lib/useDialog';
import BloqueosPanel from './BloqueosPanel';

const EMPTY = { nombre: '', apellido: '', telefono: '', correo: '' };

function hoyISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function ProfesoresView({ showToast }) {
  const { showConfirm, dialogNode } = useDialog();
  const [profesores, setProfesores] = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [agregando, setAgregando]   = useState(false);
  const [nuevoForm, setNuevoForm]   = useState(EMPTY);
  const [bloqueosCount, setBloqueosCount] = useState({});
  const [bloqueosProf, setBloqueosProf]   = useState(null);

  useEffect(() => { cargar(); cargarBloqueos(); }, []);

  async function cargarBloqueos() {
    try {
      const res = await fetch('/api/bloqueos');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const hoy = hoyISO();
      const counts = {};
      for (const b of data) {
        if (b.fecha < hoy) continue; // solo bloqueos vigentes en el contador
        counts[b.id_profesor] = (counts[b.id_profesor] || 0) + 1;
      }
      setBloqueosCount(counts);
    } catch (err) {
      console.error('[ProfesoresView] cargarBloqueos:', err);
    }
  }

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/profesores');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setProfesores(await res.json());
    } catch (err) {
      console.error('[ProfesoresView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  function startEdit(prof) {
    setAgregando(false);
    setEditandoId(prof.id);
    setEditForm({ nombre: prof.nombre, apellido: prof.apellido, telefono: prof.telefono, correo: prof.correo });
  }

  function cancelEdit() { setEditandoId(null); }

  function startAgregar() {
    setEditandoId(null);
    setNuevoForm(EMPTY);
    setAgregando(true);
  }

  async function handleGuardar(id) {
    if (!editForm.nombre || !editForm.apellido || !editForm.telefono || !editForm.correo)
      return showToast('Todos los campos son requeridos', 'error');
    const res = await fetch(`/api/profesores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) { showToast((await res.json()).error || 'Error al guardar', 'error'); return; }
    setEditandoId(null);
    await cargar();
    showToast('Profesor actualizado');
  }

  async function handleEliminar(id) {
    const prof = profesores.find(p => p.id === id);
    if (!await showConfirm(`¿Eliminar al profesor ${prof ? prof.nombre + ' ' + prof.apellido : id}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/profesores/${id}`, { method: 'DELETE' });
    if (!res.ok) { showToast((await res.json()).error || 'Error al eliminar', 'error'); return; }
    await cargar();
    showToast('Profesor eliminado');
  }

  async function handleAgregar() {
    if (!nuevoForm.nombre || !nuevoForm.apellido || !nuevoForm.telefono || !nuevoForm.correo)
      return showToast('Todos los campos son requeridos', 'error');
    const res = await fetch('/api/profesores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoForm),
    });
    if (!res.ok) { showToast((await res.json()).error || 'Error al crear', 'error'); return; }
    setAgregando(false);
    await cargar();
    showToast('Profesor agregado');
  }

  const setE = (k, v) => setEditForm(p => ({ ...p, [k]: v }));
  const setN = (k, v) => setNuevoForm(p => ({ ...p, [k]: v }));

  const actionBtns = (onSave, onCancel) => (
    <div style={{ display: 'flex', gap: 4 }}>
      <button className="btn btn-primary" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={onSave}>Guardar</button>
      <button className="btn btn-ghost"   style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={onCancel}>Cancelar</button>
    </div>
  );

  const bloqueosCell = (p) => {
    const n = bloqueosCount[p.id] || 0;
    return (
      <td style={{ textAlign: 'center' }}>
        <button
          className={`bq-count${n > 0 ? ' bq-count--on' : ''}`}
          onClick={() => setBloqueosProf(p)}
          title="Ver / editar fechas bloqueadas"
        >
          {n > 0 ? `${n} fecha${n > 1 ? 's' : ''}` : '—'}
        </button>
      </td>
    );
  };

  return (
    <div className="view-container">
      <div className="view-topbar">
        <span className="view-title">Profesores</span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={startAgregar}>
          + Nuevo profesor
        </button>
      </div>

      <div className="table-wrap">
        {cargando ? (
          <div className="loading">Cargando profesores...</div>
        ) : (
          <table className="clases-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th style={{ textAlign: 'center' }}>Bloqueado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agregando && (
                <tr className="editing">
                  <td className="td-id">—</td>
                  <td><input className="tbl-input" value={nuevoForm.nombre}   onChange={e => setN('nombre',   e.target.value)} placeholder="Nombre"   autoFocus /></td>
                  <td><input className="tbl-input" value={nuevoForm.apellido} onChange={e => setN('apellido', e.target.value)} placeholder="Apellido" /></td>
                  <td><input className="tbl-input" value={nuevoForm.telefono} onChange={e => setN('telefono', e.target.value)} placeholder="Teléfono" /></td>
                  <td><input className="tbl-input" value={nuevoForm.correo}   onChange={e => setN('correo',   e.target.value)} placeholder="Correo"   /></td>
                  <td></td>
                  <td>{actionBtns(handleAgregar, () => setAgregando(false))}</td>
                </tr>
              )}
              {profesores.map(p => (
                editandoId === p.id ? (
                  <tr key={p.id} className="editing" style={!p.disponible ? { background: 'rgba(239,68,68,0.08)' } : {}}>
                    <td className="td-id">{p.id}</td>
                    <td><input className="tbl-input" value={editForm.nombre}   onChange={e => setE('nombre',   e.target.value)} autoFocus /></td>
                    <td><input className="tbl-input" value={editForm.apellido} onChange={e => setE('apellido', e.target.value)} /></td>
                    <td><input className="tbl-input" value={editForm.telefono} onChange={e => setE('telefono', e.target.value)} /></td>
                    <td><input className="tbl-input" value={editForm.correo}   onChange={e => setE('correo',   e.target.value)} /></td>
                    {bloqueosCell(p)}
                    <td>{actionBtns(() => handleGuardar(p.id), cancelEdit)}</td>
                  </tr>
                ) : (
                  <tr key={p.id} style={!p.disponible ? { background: 'rgba(239,68,68,0.08)' } : {}}>
                    <td className="td-id">{p.id}</td>
                    <td>{p.nombre}</td>
                    <td>{p.apellido}</td>
                    <td className="td-muted">{p.telefono || '—'}</td>
                    <td className="td-muted">{p.correo   || '—'}</td>
                    {bloqueosCell(p)}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="bloque-btn-edit"   onClick={() => startEdit(p)}       title="Editar">✎</button>
                        <button className="bloque-btn-delete" onClick={() => handleEliminar(p.id)} title="Eliminar">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {profesores.length === 0 && !cargando && !agregando && (
                <tr><td colSpan={7} className="empty-state">Sin profesores</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="row-hint">
        <span>{profesores.length} profesor(es)</span>
      </div>
      {bloqueosProf && (
        <BloqueosPanel
          prof={bloqueosProf}
          showToast={showToast}
          onClose={() => setBloqueosProf(null)}
          onChanged={cargarBloqueos}
        />
      )}
      {dialogNode}
    </div>
  );
}
