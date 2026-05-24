import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()
const withTransactionMock = vi.fn()

vi.mock('@/lib/db', () => ({ query: queryMock, withTransaction: withTransactionMock }))

describe('commercial store', () => {
  beforeEach(() => {
    queryMock.mockReset()
    withTransactionMock.mockReset()
  })

  it('finds a user by login identifier', async () => {
    const { findUserByLoginIdentifier } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'user_1', login_identifier: 'a@example.com', login_type: 'email', display_name: null, role: 'user', status: 'active', created_at: '2026-05-24T00:00:00.000Z', updated_at: '2026-05-24T00:00:00.000Z' }] })

    await expect(findUserByLoginIdentifier('a@example.com')).resolves.toEqual({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', displayName: null, role: 'user', status: 'active', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('from users'), ['a@example.com'])
  })

  it('finds a user by id', async () => {
    const { findUserById } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'user_1', login_identifier: 'a@example.com', login_type: 'email', display_name: 'Admin', role: 'admin', status: 'active', created_at: '2026-05-24T00:00:00.000Z', updated_at: '2026-05-24T00:00:00.000Z' }] })

    await expect(findUserById('user_1')).resolves.toEqual({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', displayName: 'Admin', role: 'admin', status: 'active', createdAt: '2026-05-24T00:00:00.000Z', updatedAt: '2026-05-24T00:00:00.000Z' })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('where id = $1'), ['user_1'])
  })

  it('saves verification codes', async () => {
    const { saveVerificationCode } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await saveVerificationCode({ id: 'code_1', loginIdentifier: 'a@example.com', loginType: 'email', codeHash: 'hash', expiresAt: '2026-05-24T00:10:00.000Z', now: '2026-05-24T00:00:00.000Z' })

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('insert into verification_codes'), ['code_1', 'a@example.com', 'email', 'hash', '2026-05-24T00:10:00.000Z', '2026-05-24T00:00:00.000Z'])
  })

  it('finds the latest unconsumed and unexpired verification code', async () => {
    const { findLatestUsableVerificationCode } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'code_2', login_identifier: 'a@example.com', login_type: 'email', code_hash: 'hash', expires_at: '2026-05-24T00:10:00.000Z', consumed_at: null, created_at: '2026-05-24T00:01:00.000Z' }] })

    await expect(findLatestUsableVerificationCode('a@example.com', '2026-05-24T00:02:00.000Z')).resolves.toEqual({ id: 'code_2', loginIdentifier: 'a@example.com', loginType: 'email', codeHash: 'hash', expiresAt: '2026-05-24T00:10:00.000Z', consumedAt: null, createdAt: '2026-05-24T00:01:00.000Z' })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('consumed_at is null'), ['a@example.com', '2026-05-24T00:02:00.000Z'])
    expect(queryMock.mock.calls[0][0]).toContain('order by created_at desc')
    expect(queryMock.mock.calls[0][0]).toContain('limit 1')
  })

  it('consumes verification codes', async () => {
    const { consumeVerificationCode } = await import('@/lib/commercial/store')
    queryMock.mockResolvedValueOnce({ rows: [] })

    await consumeVerificationCode('code_1', '2026-05-24T00:02:00.000Z')

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('update verification_codes'), ['code_1', '2026-05-24T00:02:00.000Z'])
  })

  it('creates a user and credit account in a transaction', async () => {
    const { createUserWithCreditAccount } = await import('@/lib/commercial/store')
    const tx = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    withTransactionMock.mockImplementation(async (callback) => callback(tx))

    await createUserWithCreditAccount({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', role: 'user', now: '2026-05-24T00:00:00.000Z' })

    expect(withTransactionMock).toHaveBeenCalledOnce()
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('insert into users'), expect.arrayContaining(['user_1', 'a@example.com', 'email', 'user']))
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('insert into credit_accounts'), ['user_1', 0, '2026-05-24T00:00:00.000Z'])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('does not swallow transaction insert errors', async () => {
    const { createUserWithCreditAccount } = await import('@/lib/commercial/store')
    const error = new Error('user insert failed')
    const tx = { query: vi.fn().mockRejectedValueOnce(error) }
    withTransactionMock.mockImplementation(async (callback) => callback(tx))

    await expect(createUserWithCreditAccount({ id: 'user_1', loginIdentifier: 'a@example.com', loginType: 'email', role: 'user', now: '2026-05-24T00:00:00.000Z' })).rejects.toThrow('user insert failed')
    expect(withTransactionMock).toHaveBeenCalledOnce()
    expect(tx.query).toHaveBeenCalledOnce()
  })
})
