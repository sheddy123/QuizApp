import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { DraftQuestion } from '../types'

/**
 * Two stages: parse, then review. Nothing reaches the database until the
 * review stage is confirmed, because no parser gets every question right.
 */
export default function ImportPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [sourceFile, setSourceFile] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftQuestion[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<{ questions: DraftQuestion[] }>) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      if (result.questions.length === 0) {
        setError('No questions were recognised. Check the numbering and answer lines, or paste the text instead.')
        return
      }
      setDraft(result.questions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function updateQuestion(index: number, changes: Partial<DraftQuestion>) {
    setDraft(current => current!.map((q, i) => (i === index ? { ...q, ...changes } : q)))
  }

  function toggleCorrect(questionIndex: number, label: string) {
    setDraft(current =>
      current!.map((q, i) =>
        i === questionIndex
          ? { ...q, options: q.options.map(o => (o.label === label ? { ...o, isCorrect: !o.isCorrect } : o)) }
          : q
      )
    )
  }

  async function save() {
    if (!name.trim()) return setError('Give the set a name first.')
    setBusy(true)
    try {
      await api.commit(name.trim(), sourceFile, draft!)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
      setBusy(false)
    }
  }

  if (draft) {
    const flagged = draft.filter(q => q.warnings.length > 0).length
    return (
      <section>
        <div className="row">
          <input
            className="grow"
            placeholder="Name this set, e.g. GH-300 past questions"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button onClick={save} disabled={busy}>Save {draft.length} questions</button>
          <button className="ghost" onClick={() => setDraft(null)}>Start over</button>
        </div>

        <p className="muted">
          {draft.length} questions parsed{flagged > 0 && `, ${flagged} need a look`}. Tick the correct options and fix
          any text before saving.
        </p>
        {error && <p className="error">{error}</p>}

        {draft.map((q, i) => (
          <article key={i} className={q.warnings.length ? 'card flagged' : 'card'}>
            <div className="row">
              <span className="badge">{q.number}</span>
              <textarea
                className="grow"
                rows={2}
                value={q.stem}
                onChange={e => updateQuestion(i, { stem: e.target.value })}
              />
            </div>

            {q.warnings.map((w, wi) => (
              <p key={wi} className="warning">{w}</p>
            ))}

            <ul className="options">
              {q.options.map(o => (
                <li key={o.label}>
                  <label>
                    <input type="checkbox" checked={o.isCorrect} onChange={() => toggleCorrect(i, o.label)} />
                    <strong>{o.label}.</strong> {o.text}
                  </label>
                </li>
              ))}
            </ul>

            {q.rawAnswer && <p className="muted">Answer in source: {q.rawAnswer}</p>}
          </article>
        ))}
      </section>
    )
  }

  return (
    <section>
      <h2>Import questions</h2>

      <div className="card">
        <h3>Upload a file</h3>
        <p className="muted">PDF with real text, .txt or .md. Scanned or screenshot PDFs need OCR first.</p>
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            setSourceFile(file.name)
            if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
            void run(() => api.parseFile(file))
          }}
        />
      </div>

      <div className="card">
        <h3>Or paste the text</h3>
        <p className="muted">
          Questions numbered <code>1)</code> or <code>1.</code>, options <code>A.</code> to <code>F.</code>, and a line
          reading <code>Answer: B, D</code>.
        </p>
        <textarea rows={12} value={text} onChange={e => setText(e.target.value)} placeholder={SAMPLE} />
        <button onClick={() => void run(() => api.parseText(text))} disabled={busy || text.trim().length === 0}>
          {busy ? 'Parsing…' : 'Parse'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  )
}

const SAMPLE = `1) Where is the proxy service hosted?
A. Microsoft Azure
B. Amazon Web Service
C. Google Cloud Platform
D. Self hosted
Answer: A`
