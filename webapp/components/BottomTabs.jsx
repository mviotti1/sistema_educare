export default function BottomTabs({ tabs, active, onChange }) {
  return (
    <div className="bottom-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`bottom-tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-bg" />
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
