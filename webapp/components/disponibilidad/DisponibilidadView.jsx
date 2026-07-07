import { useState, useEffect } from 'react';
import { HORARIOS } from '../../lib/horarios';
import { MODALIDADES } from '../../lib/clases';
import SearchSelect from '../SearchSelect';
import { useDialog } from '../../lib/useDialog';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

function BloqueModal({ dia, inicial = {}, onSave, onCancel }) {
  const [f, setF] = useState({
    hora_inicio: inicial.hora_inicio || '',
    hora_fin:    inicial.hora_fin    || '',
    modalidad:   inicial.modalidad   || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const horaOpts = HORARIOS.map(h => ({ value: h, label: h }));
  const modOpts  = MODALIDADES.map(m => ({ value: m.nombre, label: m.label }));
  const editando = !!inicial.id_bloque;

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="disp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="disp-modal">
        <div className="disp-modal-header">
          <span className="disp-modal-title">
            {editando ? 'Editar bloque' : 'Agregar bloque'} — {dia}
          </span>
          <button className="bloque-btn-delete" onClick={onCancel} title="Cerrar">✕</button>
        </div>
        <div className="disp-modal-body">
          <div className="panel-field">
            <label>Hora inicio</label>
            <SearchSelect
              className="panel-input"
              value={f.hora_inicio}
              onChange={e => set('hora_inicio', e.target.value)}
              options={horaOpts}
              placeholder="— Inicio —"
            />
          </div>
          <div className="panel-field">
            <label>Hora fin</label>
            <SearchSelect
              className="panel-input"
              value={f.hora_fin}
              onChange={e => set('hora_fin', e.target.value)}
              options={horaOpts}
              placeholder="— Fin —"
            />
          </div>
          <div className="panel-field">
            <label>Modalidad</label>
            <SearchSelect
              className="panel-input"
              value={f.modalidad}
              onChange={e => set('modalidad', e.target.value)}
              options={modOpts}
              placeholder="— Modalidad —"
            />
          </div>
          <div className="disp-modal-actions">
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave(f)}>
              {editando ? 'Guardar cambios' : 'Agregar bloque'}
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiaCard({ dia, bloques, onAdd, onEdit, onDelete }) {
  const sorted = [...bloques].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  return (
    <div className="dia-card">
      <div className="dia-card-header">
        <span className="dia-nombre">{dia}</span>
        <button className="btn-add-bloque" onClick={() => onAdd(dia)} title="Agregar bloque">+</button>
      </div>
      <div className="dia-bloques">
        {sorted.map(b => (
          <div key={b.id_bloque} className="bloque-row">
            <span className="bloque-horas">{b.hora_inicio}–{b.hora_fin}</span>
            <span className={`bloque-modal ${b.modalidad === 'PRESENCIAL' ? 'modal-p' : 'modal-v'}`}>
              {b.modalidad === 'PRESENCIAL' ? 'P' : 'V'}
            </span>
            <button className="bloque-btn-edit"   onClick={() => onEdit(b)} title="Editar">✎</button>
            <button className="bloque-btn-delete" onClick={() => onDelete(b.id_bloque)} title="Eliminar">✕</button>
          </div>
        ))}
        {sorted.length === 0 && (
          <span className="dia-empty">Sin bloques</span>
        )}
      </div>
    </div>
  );
}

export default function DisponibilidadView({ meta, showToast }) {
  const { showConfirm, dialogNode } = useDialog();
  const [profId, setProfId]     = useState('');
  const [bloques, setBloques]   = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modal, setModal]       = useState(null); // { dia, bloque: null | {...} }

  useEffect(() => {
    if (profId) cargar();
  }, [profId]);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/disponibilidad?id_profesor=${profId}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setBloques(await res.json());
    } catch (err) {
      console.error('[DisponibilidadView] cargar:', err);
    } finally {
      setCargando(false);
    }
  }

  const prof = meta.profesores.find(p => String(p.id) === profId);

  function handleSelectProf(id) {
    setProfId(id);
    setModal(null);
  }

  async function handleDelete(id_bloque) {
    if (!await showConfirm('¿Eliminar este bloque de disponibilidad?')) return;
    const res = await fetch(`/api/disponibilidad/${id_bloque}`, { method: 'DELETE' });
    if (!res.ok) { showToast('Error al eliminar', 'error'); return; }
    await cargar();
    showToast('Bloque eliminado');
  }

  async function handleSave(data) {
    if (!data.hora_inicio || !data.hora_fin || !data.modalidad)
      return showToast('Completá todos los campos', 'error');

    const { dia, bloque } = modal;

    if (bloque) {
      const res = await fetch(`/api/disponibilidad/${bloque.id_bloque}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_profesor: profId, nombre_profesor: prof.nombre,
          dia, ...data,
        }),
      });
      if (!res.ok) { showToast('Error al guardar', 'error'); return; }
      showToast('Bloque actualizado');
    } else {
      const res = await fetch('/api/disponibilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_profesor: profId, nombre_profesor: prof.nombre,
          dia, ...data,
        }),
      });
      if (!res.ok) { showToast('Error al guardar', 'error'); return; }
      showToast('Bloque agregado');
    }

    setModal(null);
    await cargar();
  }

  return (
    <div className="view-container">
      <div className="view-topbar">
        <span className="view-title">Disponibilidad</span>
      </div>

      <div className="disp-selector">
        <SearchSelect
          className="form-select"
          style={{ maxWidth: 280 }}
          value={profId}
          onChange={e => handleSelectProf(e.target.value)}
          options={meta.profesores.map(p => ({ value: String(p.id), label: p.nombre }))}
          placeholder="— Seleccionar profesor —"
        />
      </div>

      {profId && (
        cargando ? (
          <div className="loading">Cargando disponibilidad...</div>
        ) : (
          <div className="disp-week">
            {DIAS.map(dia => (
              <DiaCard
                key={dia}
                dia={dia}
                bloques={bloques.filter(b => b.dia === dia)}
                onAdd={dia => setModal({ dia, bloque: null })}
                onEdit={b  => setModal({ dia: b.dia, bloque: b })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )
      )}

      {modal && (
        <BloqueModal
          dia={modal.dia}
          inicial={modal.bloque || {}}
          onSave={handleSave}
          onCancel={() => setModal(null)}
        />
      )}
      {dialogNode}
    </div>
  );
}
