/**
 * On-device storage for the offline build. The whole database is one JSON document kept in
 * memory and written to IndexedDB after every change - a few hundred questions is well under
 * a megabyte, and saving it whole keeps every write atomic.
 */

export interface StoredOption {
  id: number
  label: string
  text: string
  isCorrect: boolean
  sortOrder: number
}

export interface StoredQuestion {
  id: number
  number: number
  stem: string
  explanation: string | null
  reference: string | null
  needsReview: boolean
  reviewNote: string | null
  options: StoredOption[]
}

export interface StoredSet {
  id: number
  name: string
  sourceFile: string | null
  createdAt: string
  questions: StoredQuestion[]
}

export interface StoredItem {
  questionId: number
  presentedOrder: number
  /** Null until graded. */
  isCorrect: boolean | null
  points: number | null
  optionIds: number[]
}

export interface StoredAttempt {
  id: number
  setId: number
  startedAt: string
  submittedAt: string | null
  shuffleSeed: number
  shuffleOptions: boolean
  partialCredit: boolean
  score: number | null
  correctCount: number | null
  /** Set when this attempt is one batch of a run; null for a standalone attempt. */
  runId: number | null
  batchNumber: number | null
  items: StoredItem[]
}

export interface StoredRun {
  id: number
  setId: number
  createdAt: string
}

export interface Database {
  /** One counter for every id, so ids never collide across tables. */
  nextId: number
  sets: StoredSet[]
  attempts: StoredAttempt[]
  runs: StoredRun[]
  /**
   * Bundled sets already added, by set name, so each is added once and stays deleted if the user deletes it.
   * Missing on databases created before this existed; those were seeded with GH-300 only.
   */
  seeded?: string[]
}

const dbName = 'quizapp'
const storeName = 'kv'
const key = 'database'

let cached: Promise<Database> | null = null

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function read(): Promise<Database | null> {
  const idb = await open()
  return new Promise((resolve, reject) => {
    const request = idb.transaction(storeName).objectStore(storeName).get(key)
    request.onsuccess = () => resolve((request.result as Database | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function write(db: Database): Promise<void> {
  const idb = await open()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(db, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Loads the database. `seed` runs on every launch, not just the first, so sets bundled with a newer
 * version of the app reach existing installs too; it returns true when it changed anything.
 */
export function load(seed: (db: Database) => boolean): Promise<Database> {
  cached ??= (async () => {
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.()
    const existing = await read()
    const db: Database = existing ?? { nextId: 1, sets: [], attempts: [], runs: [], seeded: [] }
    if (seed(db) || !existing) await write(db)
    return db
  })()
  return cached
}

export function save(db: Database): Promise<void> {
  return write(db)
}

export function newId(db: Database): number {
  return db.nextId++
}
