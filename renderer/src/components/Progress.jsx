export default function Progress({ progress, onCancel }) {
  return (
    <section className="card">
      <h2>Organising…</h2>
      <progress value={progress.done} max={Math.max(progress.total, 1)} />
      <p className="muted">{progress.done} of {progress.total}</p>
      <button className="secondary" onClick={onCancel}>Cancel</button>
      <p className="muted small">Cancelling stops after the current file. Files already moved can be undone.</p>
    </section>
  );
}