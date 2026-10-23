export default function Result({ result, onUndo, onOpen, onDone, busy }) {
  return (
    <section className="card">
      <h2>{result.cancelled ? 'Cancelled' : 'Done'}</h2>
      <div className="stats">
        <div className="stat"><div className="stat-value">{result.moved}</div><div className="muted">moved</div></div>
        <div className="stat"><div className="stat-value">{result.skipped}</div><div className="muted">skipped</div></div>
        <div className="stat"><div className="stat-value">{result.failed}</div><div className="muted">failed</div></div>
      </div>
      {result.cancelled && <p className="muted">You cancelled part-way. Files already moved are recorded and can be undone.</p>}
      {result.problems.length > 0 && (
        <>
          <h3>Not moved</h3>
          <ul className="files">
            {result.problems.map((p, i) => (
              <li key={i}>{p.name} <span className="muted">— {p.status}: {p.reason}</span></li>
            ))}
          </ul>
        </>
      )}
      <div className="actions">
        {result.moved > 0 && <button className="secondary" onClick={onUndo} disabled={busy}>Undo this</button>}
        <button className="secondary" onClick={onOpen}>Open folder</button>
        <button onClick={onDone}>Finish</button>
      </div>
    </section>
  );
}