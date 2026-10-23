import { useState } from 'react';
import { formatBytes } from '../format.js';

export default function Review({ review, onApply, onBack, onRechoose, busy }) {
  const [confirming, setConfirming] = useState(false);
  const { summary, plan, root } = review;
  const maxBytes = Math.max(1, ...summary.byCategory.map((c) => c.bytes));
  const categories = Object.keys(plan.perCategory);

  return (
    <>
      <section className="card">
        <h2>Folder</h2>
        <p className="path">{root}</p>
        <p className="muted">
          {summary.totalFiles} file(s), {formatBytes(summary.totalBytes)}
          {review.skippedCount > 0 && ` · ${review.skippedCount} hidden, system, unfinished or linked item(s) will be left alone`}
          {review.errorCount > 0 && ` · ${review.errorCount} item(s) could not be read`}
        </p>
        {summary.byCategory.map((c) => (
          <div className="cat-row" key={c.category}>
            <span className="cat-name">{c.category}</span>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${(c.bytes / maxBytes) * 100}%` }} />
            </div>
            <span className="muted cat-meta">{c.count} · {formatBytes(c.bytes)}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Preview</h2>
        {plan.total === 0 ? (
          <p className="muted">Nothing to organise in this folder.</p>
        ) : (
          <>
            <p className="muted">
              {plan.total} file(s) would move into category folders inside this folder.
              {plan.renamedCount > 0 && ` ${plan.renamedCount} would be renamed to avoid overwriting an existing file.`}
            </p>
            {categories.map((cat) => (
              <details key={cat}>
                <summary>{cat}/ — {plan.perCategory[cat]} file(s)</summary>
                <ul className="files">
                  {plan.samples[cat].map((f) => (
                    <li key={f.toName + f.name}>
                      {f.name}
                      {f.renamed && <span className="muted"> → {f.toName} (renamed, name already taken)</span>}
                    </li>
                  ))}
                  {plan.perCategory[cat] > plan.samples[cat].length && (
                    <li className="muted">…and {plan.perCategory[cat] - plan.samples[cat].length} more</li>
                  )}
                </ul>
              </details>
            ))}
          </>
        )}

        <div className="actions">
          {plan.total > 0 && !confirming && <button onClick={() => setConfirming(true)}>Approve and organise</button>}
          {plan.total > 0 && confirming && (
            <>
              <span>Move {plan.total} file(s)? You can undo this afterwards.</span>
              <button onClick={onApply}>Yes, move them</button>
              <button className="secondary" onClick={() => setConfirming(false)}>Not yet</button>
            </>
          )}
          <button className="secondary" onClick={onRechoose} disabled={busy}>Choose another folder</button>
          <button className="secondary" onClick={onBack}>Back</button>
        </div>
      </section>
    </>
  );
}