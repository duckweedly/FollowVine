import { describe, expect, it } from 'vitest'
import { canTransitionTask, nextTaskStatus } from '@/lib/commercial/task-state'

const taskStatuses = ['pending', 'running', 'succeeded', 'failed', 'refunded'] as const
const taskActions = ['start', 'succeed', 'fail', 'refund'] as const

describe('generation task state transitions', () => {
  it('allows the commercial task lifecycle', () => {
    expect(canTransitionTask('pending', 'running')).toBe(true)
    expect(canTransitionTask('running', 'succeeded')).toBe(true)
    expect(canTransitionTask('running', 'failed')).toBe(true)
    expect(canTransitionTask('failed', 'refunded')).toBe(true)
  })

  it('rejects invalid lifecycle jumps', () => {
    expect(canTransitionTask('pending', 'succeeded')).toBe(false)
    expect(canTransitionTask('succeeded', 'refunded')).toBe(false)
    expect(canTransitionTask('refunded', 'running')).toBe(false)
  })

  it.each(['succeeded', 'refunded'] as const)(
    'prevents terminal state %s from transitioning to any status',
    (from) => {
      for (const to of taskStatuses) {
        expect(canTransitionTask(from, to)).toBe(false)
      }
    }
  )

  it('calculates the next status for valid actions', () => {
    expect(nextTaskStatus('pending', 'start')).toBe('running')
    expect(nextTaskStatus('running', 'succeed')).toBe('succeeded')
    expect(nextTaskStatus('running', 'fail')).toBe('failed')
    expect(nextTaskStatus('failed', 'refund')).toBe('refunded')
  })

  it.each([
    ['pending', ['succeed', 'fail', 'refund']],
    ['running', ['refund']],
    ['failed', ['start', 'succeed', 'fail']],
    ['succeeded', taskActions],
    ['refunded', taskActions]
  ] as const)('throws when calculating invalid actions from %s', (from, actions) => {
    for (const action of actions) {
      expect(() => nextTaskStatus(from, action)).toThrow('Invalid task transition')
    }
  })
})
