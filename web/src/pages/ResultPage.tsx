import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { AttemptResult } from '../types'

export default function ResultPage() {
  const { attemptId } = useParams()
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [wrongOnly, setWrongOnly] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getResult(Number(attemptId)).then(setResult).catch(e => setError(e.message))
  }, [attemptId])

  if (error) return <p className="error">{error}</p>
  if (!result) return <p className="muted">Loading…</p>

  const percent = Math.round(result.score * 100)
  const shown = wrongOnly ? result.questions.filter(q => !q.isCorrect) : result.questions

  return (
    <section>
      <div className="score">
        <strong>{percent}%</strong>
        <span>{result.correctCount} of {result.questionCount} correct</span>
      </div>

      <div className="row">
        <label>
          <input type="checkbox" checked={wrongOnly} onChange={e => setWrongOnly(e.target.checked)} />
          Show only what I got wrong
        </label>
        <span className="grow" />
        <Link to="/">Back to sets</Link>
      </div>

      {shown.length === 0 && <p className="muted">Nothing wrong. Untick the box to see every question.</p>}

      {shown.map(q => (
        <article key={q.questionId} className={q.isCorrect ? 'card correct' : 'card wrong'}>
          <div className="row">
            <span className="badge">{q.number}</span>
            <h3 className="grow">{q.stem}</h3>
            <span>{q.isCorrect ? 'Correct' : 'Wrong'}</span>
          </div>

          <ul className="options">
            {q.options.map(o => {
              const marks = [o.isCorrect ? 'is-correct' : '', o.wasSelected ? 'was-selected' : ''].join(' ')
              return (
                <li key={o.optionId} className={marks}>
                  <strong>{o.label}.</strong> {o.text}
                  {o.isCorrect && <span className="tag">correct answer</span>}
                  {o.wasSelected && !o.isCorrect && <span className="tag bad">you chose this</span>}
                </li>
              )
            })}
          </ul>

          {q.explanation && <p className="explanation">{q.explanation}</p>}
          {q.reviewNote && <p className="warning">{q.reviewNote}</p>}
        </article>
      ))}
    </section>
  )
}
