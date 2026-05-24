import { query, withTransaction } from '@/lib/db'
import type { LoginType, User, UserRole } from './types'

type UserRow = {
  id: string
  login_identifier: string
  login_type: LoginType
  display_name: string | null
  role: UserRole
  status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

type VerificationCodeRow = {
  id: string
  login_identifier: string
  login_type: LoginType
  code_hash: string
  expires_at: string
  consumed_at: string | null
  created_at: string
}

export type VerificationCodeRecord = {
  id: string
  loginIdentifier: string
  loginType: LoginType
  codeHash: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    loginIdentifier: row.login_identifier,
    loginType: row.login_type,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapVerificationCode(row: VerificationCodeRow): VerificationCodeRecord {
  return {
    id: row.id,
    loginIdentifier: row.login_identifier,
    loginType: row.login_type,
    codeHash: row.code_hash,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at
  }
}

export async function findUserByLoginIdentifier(loginIdentifier: string): Promise<User | null> {
  const result = await query<UserRow>(
    `select id, login_identifier, login_type, display_name, role, status, created_at, updated_at
     from users
     where login_identifier = $1`,
    [loginIdentifier]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<UserRow>(
    `select id, login_identifier, login_type, display_name, role, status, created_at, updated_at
     from users
     where id = $1`,
    [id]
  )
  return result.rows[0] ? mapUser(result.rows[0]) : null
}

export async function createUserWithCreditAccount(input: { id: string; loginIdentifier: string; loginType: LoginType; role: UserRole; now: string }): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query(
      `insert into users (id, login_identifier, login_type, display_name, role, status, created_at, updated_at)
       values ($1, $2, $3, null, $4, 'active', $5, $5)`,
      [input.id, input.loginIdentifier, input.loginType, input.role, input.now]
    )
    await tx.query(
      `insert into credit_accounts (user_id, balance, updated_at)
       values ($1, $2, $3)`,
      [input.id, 0, input.now]
    )
  })
}

export async function saveVerificationCode(input: { id: string; loginIdentifier: string; loginType: LoginType; codeHash: string; expiresAt: string; now: string }): Promise<void> {
  await query(
    `insert into verification_codes (id, login_identifier, login_type, code_hash, expires_at, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.id, input.loginIdentifier, input.loginType, input.codeHash, input.expiresAt, input.now]
  )
}

export async function findLatestUsableVerificationCode(loginIdentifier: string, now: string): Promise<VerificationCodeRecord | null> {
  const result = await query<VerificationCodeRow>(
    `select id, login_identifier, login_type, code_hash, expires_at, consumed_at, created_at
     from verification_codes
     where login_identifier = $1
       and consumed_at is null
       and expires_at > $2
     order by created_at desc
     limit 1`,
    [loginIdentifier, now]
  )
  return result.rows[0] ? mapVerificationCode(result.rows[0]) : null
}

export async function consumeVerificationCode(id: string, consumedAt: string): Promise<void> {
  await query(
    `update verification_codes
     set consumed_at = $2
     where id = $1`,
    [id, consumedAt]
  )
}
