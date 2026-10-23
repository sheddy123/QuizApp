import type {
  AttemptResult, AttemptView, BatchInfo, DraftQuestion, ParseResponse, RunSummary, RunView, SetSummary,
  StartAttemptRequest, StartRunRequest
} from '../types'
import type { Api } from '../api'
import gh300 from '../../../data/gh-300.json'
import cisa1 from '../../../data/cisa-13th-domain-1.json'
import cisa2 from '../../../data/cisa-13th-domain-2.json'
import cisa3 from '../../../data/cisa-13th-domain-3.json'
import cisa4 from '../../../data/cisa-13th-domain-4.json'
import cisa5 from '../../../data/cisa-13th-domain-5.json'
import { extractText } from './extract'
import { parseQuestions } from './parser'
import {
  load, newId, save, type Database, type StoredAttempt, type StoredOption, type StoredQuestion, type StoredSet
} from './store'

/**
 * The API the offline (Android) build talks to instead of the .NET server. Mirrors
 * ImportEndpoints, QuizEndpoints, RunEndpoints and GradingService - same rules, same shapes.
 */

// The sets in `data/` that ship with the app, as the commit endpoint loads them for the server.
const bundled = [gh300, cisa1, cisa2, cisa3, cisa4, cisa5]

const db = () => load(database => {
  // A database from before `seeded` existed was given GH-300 on its first launch.
  database.seeded ??= [gh300.name]
  const missing = bundled.filter(set => !database.seeded!.includes(set.name))
  for (const set of missing) {
    commitSet(database, set.name, set.sourceFile, set.questions as DraftQuestion[])
    database.seeded.push(set.name)
  }
  return missing.length > 0
})

function notFound(what: string): never {
  throw new Error(`${what} not found.`)
}

// ---------- Grading ----------

/** All-or-nothing by default, which is how the real exams score multi-answer questions. */
function grade(question: StoredQuestion, selectedOptionIds: number[], partialCredit: boolean) {
  const correct = new Set(question.options.filter(o => o.isCorrect).map(o => o.id))
  const selected = new Set(selectedOptionIds)

  const exact = correct.size === selected.size && [...selected].every(id => correct.has(id))
  if (!partialCredit || correct.size === 0) return { isCorrect: exact, points: exact ? 1 : 0 }

  const hits = [...selected].filter(id => correct.has(id)).length
  const misses = selected.size - hits
  return { isCorrect: exact, points: Math.min(1, Math.max(0, (hits - misses) / correct.size)) }
}

/** Deterministic shuffle so an attempt renders the same way if the page is reloaded. */
function shuffle<T>(source: T[], seed: number): T[] {
  const list = [...source]
  const random = mulberry32(seed)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31)

// ---------- Sets ----------

function commitSet(database: Database, name: string, sourceFile: string | null, questions: DraftQuestion[]): StoredSet {
  const set: StoredSet = {
    id: newId(database),
    name,
    sourceFile,
    createdAt: new Date().toISOString(),
    questions: questions.map(q => ({
      id: newId(database),
      number: q.number,
      stem: q.stem.trim(),
      explanation: q.explanation,
      reference: q.reference,
      needsReview: q.warnings.length > 0,
      reviewNote: q.warnings.length > 0 ? q.warnings.join(' ') : null,
      options: q.options.map(
        (o, i): StoredOption => ({ id: newId(database), label: o.label, text: o.text.trim(), isCorrect: o.isCorrect, sortOrder: i })
      )
    }))
  }
  database.sets.push(set)
  return set
}

function findSet(database: Database, id: number) {
  return database.sets.find(s => s.id === id) ?? notFound('Question set')
}

// ---------- Attempts ----------

/** The questions an attempt (or batch run) draws from, in presentation order. */
function orderPool(database: Database, set: StoredSet, onlyPreviouslyWrong: boolean, shuffleQuestions: boolean, seed: number) {
  let pool = set.questions

  if (onlyPreviouslyWrong) {
    const wrongIds = new Set(
      database.attempts
        .filter(a => a.setId === set.id)
        .flatMap(a => a.items)
        .filter(i => i.isCorrect === false)
        .map(i => i.questionId)
    )
    pool = pool.filter(q => wrongIds.has(q.id))
  }

  return shuffleQuestions
    ? shuffle([...pool].sort((a, b) => a.id - b.id), seed)
    : [...pool].sort((a, b) => a.number - b.number)
}

function newAttempt(
  database: Database, setId: number, questions: StoredQuestion[], seed: number, shuffleOptions: boolean, partialCredit: boolean
): StoredAttempt {
  return {
    id: newId(database),
    setId,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    shuffleSeed: seed,
    shuffleOptions,
    partialCredit,
    score: null,
    correctCount: null,
    runId: null,
    batchNumber: null,
    items: questions.map((q, i) => ({ questionId: q.id, presentedOrder: i, isCorrect: null, points: null, optionIds: [] }))
  }
}

function findAttempt(database: Database, id: number) {
  return database.attempts.find(a => a.id === id) ?? notFound('Attempt')
}

function itemsInOrder(database: Database, attempt: StoredAttempt) {
  const set = findSet(database, attempt.setId)
  const byId = new Map(set.questions.map(q => [q.id, q]))
  return [...attempt.items]
    .sort((a, b) => a.presentedOrder - b.presentedOrder)
    .map(item => ({ item, question: byId.get(item.questionId)! }))
}

function batchInfo(database: Database, attempt: StoredAttempt): BatchInfo | null {
  if (attempt.runId === null) return null
  const count = database.attempts.filter(a => a.runId === attempt.runId).length
  return { runId: attempt.runId, batchNumber: attempt.batchNumber ?? 0, batchCount: count }
}

function buildView(database: Database, attempt: StoredAttempt): AttemptView {
  const questions = itemsInOrder(database, attempt).map(({ question: q }, i) => {
    let options = [...q.options].sort((a, b) => a.sortOrder - b.sortOrder)
    if (attempt.shuffleOptions) options = shuffle(options, attempt.shuffleSeed + q.id)
    return {
      questionId: q.id,
      order: i,
      stem: q.stem,
      multiSelect: q.options.filter(o => o.isCorrect).length > 1,
      options: options.map(o => ({ optionId: o.id, label: o.label, text: o.text }))
    }
  })
  return {
    attemptId: attempt.id,
    setName: findSet(database, attempt.setId).name,
    startedAt: attempt.startedAt,
    questions,
    batch: batchInfo(database, attempt)
  }
}

function buildResult(database: Database, attempt: StoredAttempt): AttemptResult {
  const questions = itemsInOrder(database, attempt).map(({ item, question: q }) => {
    const selected = new Set(item.optionIds)
    return {
      questionId: q.id,
      number: q.number,
      stem: q.stem,
      isCorrect: item.isCorrect ?? false,
      points: item.points ?? 0,
      options: [...q.options]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(o => ({ optionId: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, wasSelected: selected.has(o.id) })),
      explanation: q.explanation,
      reference: q.reference,
      needsReview: q.needsReview,
      reviewNote: q.reviewNote
    }
  })
  return {
    attemptId: attempt.id,
    setName: findSet(database, attempt.setId).name,
    score: attempt.score ?? 0,
    correctCount: attempt.correctCount ?? 0,
    questionCount: attempt.items.length,
    submittedAt: attempt.submittedAt!,
    questions,
    batch: batchInfo(database, attempt)
  }
}

// ---------- Runs ----------

function buildRun(database: Database, id: number): RunView {
  const run = database.runs.find(r => r.id === id) ?? notFound('Run')
  const attempts = database.attempts.filter(a => a.runId === id).sort((a, b) => (a.batchNumber ?? 0) - (b.batchNumber ?? 0))

  const batches = attempts.map(a => ({
    batchNumber: a.batchNumber ?? 0,
    attemptId: a.id,
    questionCount: a.items.length,
    submitted: a.submittedAt !== null,
    score: a.score,
    correctCount: a.correctCount,
    submittedAt: a.submittedAt
  }))

  let total: RunView['total'] = null
  if (attempts.every(a => a.submittedAt !== null)) {
    // Weight by question, not by batch, so a smaller batch doesn't count for more.
    const items = attempts.flatMap(a => a.items)
    total = {
      score: items.length === 0 ? 0 : items.reduce((sum, i) => sum + (i.points ?? 0), 0) / items.length,
      correctCount: items.filter(i => i.isCorrect === true).length,
      questionCount: items.length
    }
  }

  return { runId: run.id, questionSetId: run.setId, setName: findSet(database, run.setId).name, createdAt: run.createdAt, batches, total }
}

// ---------- The API ----------

function toResponse(questions: DraftQuestion[]): ParseResponse {
  return { questions, warningCount: questions.filter(q => q.warnings.length > 0).length }
}

export const localApi: Api = {
  async listSets(): Promise<SetSummary[]> {
    const database = await db()
    return [...database.sets]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(s => ({
        id: s.id,
        name: s.name,
        questionCount: s.questions.length,
        createdAt: s.createdAt,
        attemptCount: database.attempts.filter(a => a.setId === s.id && a.submittedAt !== null).length
      }))
  },

  async deleteSet(id: number) {
    const database = await db()
    findSet(database, id)
    database.sets = database.sets.filter(s => s.id !== id)
    database.attempts = database.attempts.filter(a => a.setId !== id)
    database.runs = database.runs.filter(r => r.setId !== id)
    await save(database)
  },

  async parseText(text: string) {
    return toResponse(parseQuestions(text))
  },

  async parseFile(file: File) {
    if (file.size === 0) throw new Error('The file is empty.')
    return toResponse(parseQuestions(await extractText(file)))
  },

  async commit(name: string, sourceFile: string | null, questions: DraftQuestion[]) {
    if (questions.length === 0) throw new Error('No questions to save.')
    const database = await db()
    const set = commitSet(database, name, sourceFile, questions)
    await save(database)
    return { id: set.id }
  },

  async startAttempt(request: StartAttemptRequest) {
    const database = await db()
    const set = findSet(database, request.questionSetId)

    const seed = randomSeed()
    let ordered = orderPool(database, set, request.onlyPreviouslyWrong, request.shuffleQuestions, seed)
    if (ordered.length === 0) throw new Error('No previously missed questions in this set.')
    if (request.questionCount && request.questionCount > 0) ordered = ordered.slice(0, request.questionCount)

    const attempt = newAttempt(database, set.id, ordered, seed, request.shuffleOptions, request.partialCredit)
    database.attempts.push(attempt)
    await save(database)
    return buildView(database, attempt)
  },

  async getAttempt(id: number) {
    const database = await db()
    return buildView(database, findAttempt(database, id))
  },

  async submit(id: number, answers: { questionId: number; optionIds: number[] }[]) {
    const database = await db()
    const attempt = findAttempt(database, id)
    if (attempt.submittedAt !== null) throw new Error('This attempt was already submitted.')

    const byQuestion = new Map(answers.map(a => [a.questionId, a.optionIds]))
    for (const { item, question } of itemsInOrder(database, attempt)) {
      const selected = byQuestion.get(item.questionId) ?? []
      const valid = selected.filter(oid => question.options.some(o => o.id === oid))
      const { isCorrect, points } = grade(question, valid, attempt.partialCredit)
      item.optionIds = valid
      item.isCorrect = isCorrect
      item.points = points
    }

    attempt.submittedAt = new Date().toISOString()
    attempt.correctCount = attempt.items.filter(i => i.isCorrect === true).length
    attempt.score = attempt.items.length === 0 ? 0 : attempt.items.reduce((sum, i) => sum + (i.points ?? 0), 0) / attempt.items.length
    await save(database)
    return buildResult(database, attempt)
  },

  async getResult(id: number) {
    const database = await db()
    const attempt = findAttempt(database, id)
    if (attempt.submittedAt === null) throw new Error('This attempt has not been submitted.')
    return buildResult(database, attempt)
  },

  // Creates every batch up front, so each question lands in exactly one batch.
  async startRun(request: StartRunRequest) {
    const database = await db()
    const set = findSet(database, request.questionSetId)

    const seed = randomSeed()
    const pool = orderPool(database, set, request.onlyPreviouslyWrong, request.shuffleQuestions, seed)
    if (pool.length === 0) throw new Error('No previously missed questions in this set.')
    if (request.batchCount < 2 || request.batchCount > pool.length)
      throw new Error(`Choose between 2 and ${pool.length} batches.`)

    const run = { id: newId(database), setId: set.id, createdAt: new Date().toISOString() }
    database.runs.push(run)
    let offset = 0
    for (let b = 0; b < request.batchCount; b++) {
      // Spread the remainder over the first batches: 116 in 3 gives 39, 39, 38.
      const size = Math.floor(pool.length / request.batchCount) + (b < pool.length % request.batchCount ? 1 : 0)
      const attempt = newAttempt(
        database, set.id, pool.slice(offset, offset + size), seed + b, request.shuffleOptions, request.partialCredit
      )
      attempt.runId = run.id
      attempt.batchNumber = b + 1
      database.attempts.push(attempt)
      offset += size
    }

    await save(database)
    return buildRun(database, run.id)
  },

  async listRuns(): Promise<RunSummary[]> {
    const database = await db()
    return [...database.runs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => {
        const attempts = database.attempts.filter(a => a.runId === r.id)
        return {
          runId: r.id,
          questionSetId: r.setId,
          createdAt: r.createdAt,
          batchCount: attempts.length,
          submittedCount: attempts.filter(a => a.submittedAt !== null).length
        }
      })
  },

  async getRun(id: number) {
    return buildRun(await db(), id)
  },

  async deleteRun(id: number) {
    const database = await db()
    if (!database.runs.some(r => r.id === id)) notFound('Run')
    database.runs = database.runs.filter(r => r.id !== id)
    database.attempts = database.attempts.filter(a => a.runId !== id)
    await save(database)
  }
}
