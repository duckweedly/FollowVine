import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { canAccessAdmin } from '@/lib/auth/permissions'
import { applyAdminCreditAdjustment } from '@/lib/commercial/credits'
import { withTransaction } from '@/lib/db'

type AdjustmentRequest = {
  userId?: unknown
  amount?: unknown
  reason?: unknown
}

function parseRequest(body: AdjustmentRequest | null): { userId: string; amount: number; reason: string } | null {
  if (typeof body?.userId !== 'string' || typeof body.amount !== 'number' || typeof body.reason !== 'string') return null
  const userId = body.userId.trim()
  const reason = body.reason.trim()
  if (!userId || !Number.isSafeInteger(body.amount) || body.amount === 0 || !reason) return null
  return { userId, amount: body.amount, reason }
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const admin = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!admin || !canAccessAdmin(admin)) return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 })

  const body = await request.json().catch(() => null) as AdjustmentRequest | null
  const parsed = parseRequest(body)
  if (!parsed) return NextResponse.json({ error: '调整参数不可用。' }, { status: 400 })

  const now = new Date().toISOString()
  let result: boolean
  try {
    result = await withTransaction(async (tx) => {
      const account = await tx.query<{ balance: number }>('select balance from credit_accounts where user_id = $1 for update', [parsed.userId])
      if (!account.rows[0]) return false

      const transition = applyAdminCreditAdjustment({ balance: account.rows[0].balance, amount: parsed.amount, reason: parsed.reason })
      await tx.query('update credit_accounts set balance = $1, updated_at = $2 where user_id = $3', [transition.balanceAfter, now, parsed.userId])
      await tx.query(
        `insert into credit_ledger_entries (id, user_id, type, amount, balance_after, reference_type, reference_id, reason, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [`cle_${randomUUID().replace(/-/g, '')}`, parsed.userId, transition.ledger.type, transition.ledger.amount, transition.ledger.balanceAfter, transition.ledger.referenceType, transition.ledger.referenceId, transition.ledger.reason, now]
      )
      return true
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Credit balance cannot be negative') {
      return NextResponse.json({ error: '调整后积分不能为负。' }, { status: 400 })
    }
    throw error
  }

  if (!result) return NextResponse.json({ error: '积分账户不存在。' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
