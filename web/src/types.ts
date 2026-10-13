export interface SetSummary {
  id: number
  name: string
  questionCount: number
  createdAt: string
  attemptCount: number
}

export interface DraftOption {
  label: string
  text: string
  isCorrect: boolean
}

export interface DraftQuestion {
  number: number
  stem: string
  options: DraftOption[]
  explanation: string | null
  reference: string | null
  rawAnswer: string | null
  warnings: string[]
}

export interface ParseResponse {
  questions: DraftQuestion[]
  warningCount: number
}

export interface QuizOption {
  optionId: number
  label: string
  text: string
}

export interface QuizQuestion {
  questionId: number
  order: number
  stem: string
  multiSelect: boolean
  options: QuizOption[]
}

export interface BatchInfo {
  runId: number
  batchNumber: number
  batchCount: number
}

export interface AttemptView {
  attemptId: number
  setName: string
  startedAt: string
  questions: QuizQuestion[]
  batch: BatchInfo | null
}

export interface OptionResult extends QuizOption {
  isCorrect: boolean
  wasSelected: boolean
}

export interface QuestionResult {
  questionId: number
  number: number
  stem: string
  isCorrect: boolean
  points: number
  options: OptionResult[]
  explanation: string | null
  reference: string | null
  needsReview: boolean
  reviewNote: string | null
}

export interface AttemptResult {
  attemptId: number
  setName: string
  score: number
  correctCount: number
  questionCount: number
  submittedAt: string
  questions: QuestionResult[]
  batch: BatchInfo | null
}

export interface StartAttemptRequest {
  questionSetId: number
  questionCount?: number | null
  shuffleQuestions: boolean
  shuffleOptions: boolean
  partialCredit: boolean
  onlyPreviouslyWrong: boolean
}

export interface StartRunRequest {
  questionSetId: number
  batchCount: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  partialCredit: boolean
  onlyPreviouslyWrong: boolean
}

export interface BatchStatus {
  batchNumber: number
  attemptId: number
  questionCount: number
  submitted: boolean
  score: number | null
  correctCount: number | null
  submittedAt: string | null
}

export interface RunView {
  runId: number
  questionSetId: number
  setName: string
  createdAt: string
  batches: BatchStatus[]
  total: { score: number; correctCount: number; questionCount: number } | null
}

export interface RunSummary {
  runId: number
  questionSetId: number
  createdAt: string
  batchCount: number
  submittedCount: number
}
