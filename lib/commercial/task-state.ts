import type { GenerationTaskStatus } from './types'

type TaskAction = 'start' | 'succeed' | 'fail' | 'refund'

const allowedTransitions: Record<GenerationTaskStatus, GenerationTaskStatus[]> = {
  pending: ['running'],
  running: ['succeeded', 'failed'],
  succeeded: [],
  failed: ['refunded'],
  refunded: []
}

const actionTargets: Record<TaskAction, GenerationTaskStatus> = {
  start: 'running',
  succeed: 'succeeded',
  fail: 'failed',
  refund: 'refunded'
}

export function canTransitionTask(from: GenerationTaskStatus, to: GenerationTaskStatus): boolean {
  return allowedTransitions[from].includes(to)
}

export function nextTaskStatus(from: GenerationTaskStatus, action: TaskAction): GenerationTaskStatus {
  const to = actionTargets[action]
  if (!canTransitionTask(from, to)) throw new Error(`Invalid task transition: ${from} -> ${to}`)
  return to
}
