const LABELS = { done: 'done', undone: 'undone', 'partially-undone': 'partly undone', empty: 'nothing moved' };

export default function History({ items, onUndo, report, busy }) {
  return (
    <section className="card">
      <h2>History</h2>
      {report && (
        <div className="notice">
          Restored {report.restored} file(s){report.failed > 0 && `, ${report.failed} could not be restored`}.
          {report.problems.length > 0 && (
            <ul className="files">
              {report.problems.map((p, i) => (
                <li key={i}>{p.name} <span className="muted">— {p.reason}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {items.length === 0 && <p className="muted">No operations yet.</p>}
      <ul className="history">
        {items.map((op) => (
          <li key={op.opId}>
            <div>
              <strong>{new Date(op.at).toLocaleString()}</strong>
              <span className={`badge ${op.status}`}>{LABELS[op.status] ?? op.status}</span>
              <div className="muted small">{op.moved} file(s) · {op.root}</div>
            </div>
            {(op.status === 'done' || op.status === 'partially-undone') && (
              <button className="secondary" onClick={() => onUndo(op.opId)} disabled={busy}>Undo</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}