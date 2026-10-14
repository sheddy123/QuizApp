import type { DraftQuestion } from '../types'

/**
 * TypeScript port of QuizApp.Parsing.QuestionParser, for the offline (Android) build.
 * Keep the two in step: a fix to one belongs in the other.
 */

// "12)" or "12." at the start of a line begins a new question.
const questionStart = /^(\d{1,3})\s*[).]\s*(.*)$/

// "A." / "A)" / "A -" begins an option. Only A-F to avoid eating prose.
const optionStart = /^([A-F])\s*[).\-,]\s+(.*)$/

// "Answer: B" / "Correct Answer: B,D" / "Answer(s) : AB"
const answerLine = /^(?:correct\s+)?answer(?:\(s\))?\s*[:;-]\s*(.*)$/i

const explanationLine = /^explanation\s*[:;-]?\s*(.*)$/i

const referenceLine = /^references?\s*[:;-]?\s*(.*)$/i

/** Lines matching these are dropped: watermarks, page numbers, site URLs. */
const noisePatterns = [/^\s*page\s+\d+\s*$/i, /^\s*\d{1,3}\s*$/, /^\s*https?:\/\/\S+\s*$/, /watermark/i]

type State = 'stem' | 'options' | 'explanation' | 'reference'

export function parseQuestions(text: string): DraftQuestion[] {
  const results: DraftQuestion[] = []
  let current: DraftQuestion | null = null
  let state: State = 'stem'
  let stem = ''
  let explanation = ''
  let reference = ''

  function flush() {
    if (current === null) return
    current.stem = collapse(stem)
    current.explanation = blank(explanation)
    current.reference = blank(reference)
    validate(current)
    results.push(current)
    stem = ''
    explanation = ''
    reference = ''
  }

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = cleanLine(raw)
    if (line.length === 0) continue
    if (noisePatterns.some(p => p.test(line))) continue

    // A numbered line starts a new question - but only when we are not mid-options,
    // because option text can legitimately wrap onto a line starting with a digit.
    const qm = questionStart.exec(line)
    if (qm && (state !== 'options' || looksLikeQuestion(qm[2]))) {
      flush()
      current = {
        number: Number(qm[1]), stem: '', options: [], explanation: null, reference: null, rawAnswer: null, warnings: []
      }
      stem = qm[2]
      state = 'stem'
      continue
    }

    if (current === null) continue // preamble before the first question

    const am = answerLine.exec(line)
    if (am) {
      current.rawAnswer = am[1].trim()
      applyAnswer(current, current.rawAnswer)
      state = 'explanation'
      continue
    }

    const om = optionStart.exec(line)
    if (om && (state === 'stem' || state === 'options')) {
      current.options.push({ label: om[1], text: om[2].trim(), isCorrect: false })
      state = 'options'
      continue
    }

    const em = explanationLine.exec(line)
    if (em && state === 'explanation') {
      if (em[1].length > 0) explanation += em[1] + '\n'
      continue
    }

    const rm = referenceLine.exec(line)
    if (rm && (state === 'explanation' || state === 'reference')) {
      if (rm[1].length > 0) reference += rm[1] + '\n'
      state = 'reference'
      continue
    }

    // Continuation of whatever we are currently inside.
    switch (state) {
      case 'stem': stem += ' ' + line; break
      case 'options': current.options[current.options.length - 1].text += ' ' + line; break
      case 'explanation': explanation += line + '\n'; break
      case 'reference': reference += line + '\n'; break
    }
  }

  flush()
  return results
}

/** Marks options correct from an answer string like "B, D", "BD" or "B and D". */
function applyAnswer(q: DraftQuestion, rawAnswer: string) {
  const letters = new Set([...rawAnswer.toUpperCase()].filter(c => c >= 'A' && c <= 'F'))
  for (const option of q.options) option.isCorrect = letters.has(option.label[0])

  for (const letter of letters)
    if (q.options.every(o => o.label[0] !== letter))
      q.warnings.push(`Answer names option ${letter}, which was not found in the option list.`)
}

function validate(q: DraftQuestion) {
  if (q.stem.length < 10) q.warnings.push('The question text looks too short - it may have been cut off.')
  if (q.options.length < 2) q.warnings.push(`Only ${q.options.length} option(s) were found.`)
  if (q.rawAnswer === null) q.warnings.push('No answer line was found.')
  else if (!q.options.some(o => o.isCorrect)) q.warnings.push('No option was marked correct.')

  let expected = 'A'.charCodeAt(0)
  for (const option of q.options) {
    if (option.label.charCodeAt(0) !== expected) {
      q.warnings.push('Option labels are not in sequence.')
      break
    }
    expected++
  }

  // "Choose two" in the stem should agree with the number of correct options.
  const m = /choose\s+(two|three|2|3)|select\s+(two|three|2|3)/i.exec(q.stem)
  if (m) {
    const word = m[0].toLowerCase()
    const wanted = word.includes('two') || word.includes('2') ? 2 : 3
    const actual = q.options.filter(o => o.isCorrect).length
    if (actual !== wanted) q.warnings.push(`The question asks for ${wanted} answers but ${actual} are marked correct.`)
  }
}

function looksLikeQuestion(rest: string) {
  const first = rest.charAt(0)
  return rest.length > 15 && (rest.includes('?') || (first !== '' && first === first.toUpperCase() && first !== first.toLowerCase()))
}

function cleanLine(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .trim()
    .replace(/^['`*]+/, '')
}

function collapse(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function blank(s: string) {
  return s.trim().length === 0 ? null : s.trim()
}
