import type {
  AttemptResult, AttemptView, DraftQuestion, ParseResponse, SetSummary, StartAttemptRequest
} from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...init?.headers }
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  listSets: () => request<SetSummary[]>('/api/sets'),

  deleteSet: (id: number) => request<void>(`/api/sets/${id}`, { method: 'DELETE' }),

  parseText: (text: string) =>
    request<ParseResponse>('/api/imports/text', { method: 'POST', body: JSON.stringify({ text }) }),

  parseFile: (file: File) => {
    const data = new FormData()
    data.append('file', file)
    return request<ParseResponse>('/api/imports/file', { method: 'POST', body: data })
  },

  commit: (name: string, sourceFile: string | null, questions: DraftQuestion[]) =>
    request<{ id: number }>('/api/imports/commit', {
      method: 'POST',
      body: JSON.stringify({ name, sourceFile, questions })
    }),

  startAttempt: (request_: StartAttemptRequest) =>
    request<AttemptView>('/api/attempts', { method: 'POST', body: JSON.stringify(request_) }),

  getAttempt: (id: number) => request<AttemptView>(`/api/attempts/${id}`),

  submit: (id: number, answers: { questionId: number; optionIds: number[] }[]) =>
    request<AttemptResult>(`/api/attempts/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),

  getResult: (id: number) => request<AttemptResult>(`/api/attempts/${id}/result`)
}
