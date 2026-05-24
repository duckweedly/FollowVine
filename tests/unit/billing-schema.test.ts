import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('billing schema', () => {
  it('defines credit packs, payment events, and fulfillment fields', async () => {
    const schema = await readFile(join(process.cwd(), 'db/schema.sql'), 'utf8')

    expect(schema).toContain('create table if not exists credit_packs')
    expect(schema).toContain('create table if not exists payment_events')
    expect(schema).toContain('alter table orders add column if not exists fulfilled_at timestamptz')
    expect(schema).toContain('payment_events_order_id_idx')
    expect(schema).toContain('credit_packs_active_idx')
    expect(schema).toContain('orders_provider_trade_no_unique_idx')
    expect(schema).toContain('where provider_trade_no is not null')
  })
})
