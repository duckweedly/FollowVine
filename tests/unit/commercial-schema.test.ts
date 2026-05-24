import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const requiredTables = [
  'users',
  'verification_codes',
  'membership_plans',
  'user_memberships',
  'credit_accounts',
  'credit_ledger_entries',
  'orders',
  'model_channels',
  'generation_tasks',
  'channel_attempts',
  'system_settings'
]

describe('commercial schema', () => {
  it('defines the commercial foundation tables and critical indexes', async () => {
    const schema = await readFile(join(process.cwd(), 'db/schema.sql'), 'utf8')

    for (const table of requiredTables) {
      expect(schema).toContain(`create table if not exists ${table}`)
    }

    expect(schema).toContain('users_login_identifier_idx')
    expect(schema).toContain('orders_user_id_idx')
    expect(schema).toContain('generation_tasks_status_idx')
    expect(schema).toContain('model_channels_enabled_idx')
    expect(schema).toContain('constraint generation_tasks_shape_check check')
  })
})
