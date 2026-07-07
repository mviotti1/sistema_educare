import { useState } from 'react';
import RegistroMateriasView from './RegistroMateriasView';
import MateriasProfesorView from './MateriasProfesorView';

export default function MateriasView({ showToast, meta }) {
  const [sub, setSub] = useState('por-profesor');

  return (
    <div className="materias-shell">
      <div className="sub-tabs-bar">
        <button
          className={`sub-tab-btn ${sub === 'por-profesor' ? 'active' : ''}`}
          onClick={() => setSub('por-profesor')}
        >
          Materias del profesor
        </button>
        <button
          className={`sub-tab-btn ${sub === 'registro' ? 'active' : ''}`}
          onClick={() => setSub('registro')}
        >
          Registro materias
        </button>
      </div>

      {sub === 'registro'
        ? <RegistroMateriasView showToast={showToast} />
        : <MateriasProfesorView showToast={showToast} meta={meta} />
      }
    </div>
  );
}
