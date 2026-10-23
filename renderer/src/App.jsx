import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Review from './components/Review.jsx';
import Progress from './components/Progress.jsx';
import Result from './components/Result.jsx';
import History from './components/History.jsx';
import './App.css';

function DeskFlowApp() {
  const [view, setView] = useState('start'); // start | review | applying | done
  const [review, setReview] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [undoReport, setUndoReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await api.history());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function choose() {
    setError('');
    setBusy(true);
    try {
      const picked = await api.chooseFolder();
      if (!picked) return; // dialog cancelled
      setReview(await api.review());
      setResult(null);
      setUndoReport(null);
      setView('review');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setError('');
    setUndoReport(null);
    setProgress({ done: 0, total: review.plan.total });
    setView('applying');
    const stopListening = api.onProgress(setProgress);
    try {
      setResult(await api.apply(review.plan.planId));
      setView('done');
      loadHistory();
    } catch (e) {
      setError(e.message);
      setView(e.code === 'PLAN_EXPIRED' ? 'start' : 'review');
    } finally {
      stopListening();
    }
  }

  async function undo(opId) {
    setError('');
    setBusy(true);
    try {
      setUndoReport(await api.undo(opId));
      await loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setView('start');
    setReview(null);
    setResult(null);
  }

  return (
    <main className="app">
      <header>
        <h1>DeskFlow</h1>
        <p className="muted">Organise a folder safely: preview first, approve, and undo if you change your mind.</p>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      {view === 'start' && (
        <section className="card center">
          <p>Nothing moves until you approve a preview. Files are never deleted or overwritten.</p>
          <button onClick={choose} disabled={busy}>{busy ? 'Scanning…' : 'Choose a folder'}</button>
        </section>
      )}

      {view === 'review' && review && (
        <Review review={review} onApply={apply} onBack={startOver} onRechoose={choose} busy={busy} />
      )}

      {view === 'applying' && <Progress progress={progress} onCancel={() => api.cancel()} />}

      {view === 'done' && result && (
        <Result
          result={result}
          root={review?.root}
          onUndo={() => undo(result.opId)}
          onOpen={() => api.openFolder()}
          onDone={startOver}
          busy={busy}
        />
      )}

      <History items={history} onUndo={undo} report={undoReport} busy={busy} />
    </main>
  );
}

export default function App() {
  if (!window.deskflow) {
    return (
      <main className="app">
        <p className="error">This page has to run inside the DeskFlow window. Start it with "npm run app:dev".</p>
      </main>
    );
  }
  return <DeskFlowApp />;
}