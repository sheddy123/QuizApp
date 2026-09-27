import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { SetSummary } from '../types'

export default function SetsPage() {
  const navigate = useNavigate()
  const [sets, setSets] = useState<SetSummary[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [count, setCount] = useState<string>('')
  const [shuffle, setShuffle] = useState(true)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [partial, setPartial] = useState(false)
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listSets().then(setSets).catch(e => setError(e.message))
  }, [])

  async function start(setId: number) {
    setError(null)
    try {
      const attempt = await api.startAttempt({
        questionSetId: setId,
        questionCount: count ? Number(count) : null,
        shuffleQuestions: shuffle,
        shuffleOptions,
        partialCredit: partial,
        onlyPreviouslyWrong: onlyWrong
      })
      navigate(`/attempts/${attempt.attemptId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the quiz.')
    }
  }

  async function remove(setId: number) {
    if (!confirm('Delete this set and its attempts?')) return
    await api.deleteSet(setId)
    setSets(current => current.filter(s => s.id !== setId))
  }

  if (sets.length === 0) {
    return (
      <section>
        <h2>No question sets yet</h2>
        <p className="muted">Import some questions to get started.</p>
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  return (
    <section>
      <h2>Question sets</h2>
      {error && <p className="error">{error}</p>}

      {sets.map(set => (
        <article key={set.id} className="card">
          <div className="row">
            <div className="grow">
              <h3>{set.name}</h3>
              <p className="muted">
                {set.questionCount} questions · {set.attemptCount} attempts
              </p>
            </div>
            <button onClick={() => setSelected(selected === set.id ? null : set.id)}>
              {selected === set.id ? 'Close' : 'Practise'}
            </button>
            <button className="ghost" onClick={() => void remove(set.id)}>Delete</button>
          </div>

          {selected === set.id && (
            <div className="settings">
              <label>
                How many questions
                <input
                  type="number"
                  min={1}
                  max={set.questionCount}
                  placeholder={`All (${set.questionCount})`}
                  value={count}
                  onChange={e => setCount(e.target.value)}
                />
              </label>
              <label><input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} /> Shuffle questions</label>
              <label><input type="checkbox" checked={shuffleOptions} onChange={e => setShuffleOptions(e.target.checked)} /> Shuffle options</label>
              <label><input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} /> Partial credit on multi-answer</label>
              <label><input type="checkbox" checked={onlyWrong} onChange={e => setOnlyWrong(e.target.checked)} /> Only questions I got wrong before</label>
              <button onClick={() => void start(set.id)}>Start</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
