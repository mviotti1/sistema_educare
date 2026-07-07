import { useState } from 'react';
import AgendarFormView from './AgendarFormView';
import RecurrentesView from './RecurrentesView';

const TABS = [
  { id: 'nueva',        label: 'Nueva clase'  },
  { id: 'recurrentes',  label: 'Recurrentes'  },
];

export default function AgendarView({ meta, onCreated, showToast }) {
  const [sub, setSub] = useState('nueva');

  return (
    <div className="materias-shell">
      <div className="sub-tabs-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab-btn ${sub === t.id ? 'active' : ''}`}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'nueva' ? (
        <AgendarFormView meta={meta} onCreated={onCreated} showToast={showToast} />
      ) : (
        <RecurrentesView meta={meta} showToast={showToast} />
      )}
    </div>
  );
}
