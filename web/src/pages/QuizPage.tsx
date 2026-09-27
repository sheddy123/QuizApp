import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { AttemptView } from '../types'

export default function QuizPage() {
  const { attemptId } = useParams()
  const id = Number(attemptId)
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState<AttemptView | null>(null)
  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getAttempt(id).then(setAttempt).catch(e => setError(e.message))
  }, [id])

  if (error) return <p className="error">{error}</p>
  if (!attempt) return <p className="muted">Loading…</p>

  const question = attempt.questions[index]
  const selected = answers[question.questionId] ?? []
  const answeredCount = Object.values(answers).filter(a => a.length > 0).length

  function choose(optionId: number) {
    setAnswers(current => {
      const existing = current[question.questionId] ?? []
      const next = question.multiSelect
        ? existing.includes(optionId)
          ? existing.filter(o => o !== optionId)
          : [...existing, optionId]
        : [optionId]
      return { ...current, [question.questionId]: next }
    })
  }

  async function submit() {
    if (!confirm(`Submit with ${answeredCount} of ${attempt!.questions.length} answered?`)) return
    setBusy(true)
    try {
      await api.submit(id, Object.entries(answers).map(([questionId, optionIds]) => ({
        questionId: Number(questionId),
        optionIds
      })))
      navigate(`/attempts/${id}/result`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed.')
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="row">
        <h2 className="grow">{attempt.setName}</h2>
        <span className="muted">
          Question {index + 1} of {attempt.questions.length} · {answeredCount} answered
        </span>
      </div>

      <progress value={index + 1} max={attempt.questions.length} />

      <article className="card">
        <h3>{question.stem}</h3>
        {question.multiSelect && <p className="muted">More than one answer is correct.</p>}

        <ul className="options">
          {question.options.map(option => (
            <li key={option.optionId}>
              <label className={selected.includes(option.optionId) ? 'chosen' : ''}>
                <input
                  type={question.multiSelect ? 'checkbox' : 'radio'}
                  name={`q${question.questionId}`}
                  checked={selected.includes(option.optionId)}
                  onChange={() => choose(option.optionId)}
                />
                <strong>{option.label}.</strong> {option.text}
              </label>
            </li>
          ))}
        </ul>
      </article>

      <div className="row">
        <button className="ghost" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>
          Previous
        </button>
        {index < attempt.questions.length - 1 ? (
          <button onClick={() => setIndex(i => i + 1)}>Next</button>
        ) : (
          <button onClick={() => void submit()} disabled={busy}>Submit</button>
        )}
        <span className="grow" />
        <button className="ghost" onClick={() => void submit()} disabled={busy}>Finish now</button>
      </div>

      <div className="grid">
        {attempt.questions.map((q, i) => (
          <button
            key={q.questionId}
            className={`dot ${i === index ? 'current' : ''} ${(answers[q.questionId]?.length ?? 0) > 0 ? 'done' : ''}`}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  )
}
