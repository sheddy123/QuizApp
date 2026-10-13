import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { RunView } from '../types'

export default function RunPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getRun(Number(runId)).then(setRun).catch(e => setError(e.message))
  }, [runId])

  async function remove() {
    if (!confirm('Delete this batch run and all its scores?')) return
    await api.deleteRun(Number(runId))
    navigate('/')
  }

  if (error) return <p className="error">{error}</p>
  if (!run) return <p className="muted">Loading…</p>

  const done = run.batches.filter(b => b.submitted).length
  const next = run.batches.find(b => !b.submitted)

  return (
    <section>
      <div className="row">
        <h2 className="grow">{run.setName} · batches</h2>
        <Link to="/">Back to sets</Link>
      </div>

      {run.total ? (
        <div className="score">
          <strong>{Math.round(run.total.score * 100)}%</strong>
          <span>
            Overall: {run.total.correctCount} of {run.total.questionCount} correct across {run.batches.length} batches
          </span>
        </div>
      ) : (
        <p className="muted">
          {done} of {run.batches.length} batches done. The overall score appears once every batch is submitted.
        </p>
      )}

      {run.batches.map(b => (
        <article key={b.batchNumber} className={b.submitted ? 'card correct' : 'card'}>
          <div className="row">
            <span className="badge">{b.batchNumber}</span>
            <div className="grow">
              <h3>Batch {b.batchNumber}</h3>
              <p className="muted">
                {b.questionCount} questions
                {b.submitted && ` · ${b.correctCount} correct · ${Math.round((b.score ?? 0) * 100)}%`}
              </p>
            </div>
            {b.submitted ? (
              <Link to={`/attempts/${b.attemptId}/result`}>Review</Link>
            ) : (
              <button
                className={b === next ? '' : 'ghost'}
                onClick={() => navigate(`/attempts/${b.attemptId}`)}
              >
                Take batch
              </button>
            )}
          </div>
        </article>
      ))}

      <div className="row">
        <span className="grow" />
        <button className="ghost" onClick={() => void remove()}>Delete this run</button>
      </div>
    </section>
  )
}
