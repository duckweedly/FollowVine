import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { canAccessAdmin } from '@/lib/auth/permissions'
import { findOrderById, markOrderPaid, recordPaymentEvent } from '@/lib/commercial/billing-store'
import { fulfillPaidOrder } from '@/lib/commercial/fulfillment'

type FulfillRequest = {
  orderId?: unknown
  providerTradeNo?: unknown
  reason?: unknown
}

function parseRequest(body: FulfillRequest | null): { orderId: string; providerTradeNo: string; reason: string } | null {
  if (typeof body?.orderId !== 'string' || typeof body.providerTradeNo !== 'string' || typeof body.reason !== 'string') return null
  const orderId = body.orderId.trim()
  const providerTradeNo = body.providerTradeNo.trim()
  const reason = body.reason.trim()
  if (!orderId || !providerTradeNo || !reason) return null
  return { orderId, providerTradeNo, reason }
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const admin = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!admin || !canAccessAdmin(admin)) return NextResponse.json({ error: '需要管理员权限。' }, { status: 403 })

  const body = await request.json().catch(() => null) as FulfillRequest | null
  const parsed = parseRequest(body)
  if (!parsed) return NextResponse.json({ error: '手动履约参数不可用。' }, { status: 400 })

  const order = await findOrderById(parsed.orderId)
  if (!order) return NextResponse.json({ error: '订单不存在。' }, { status: 404 })
  if (order.status !== 'pending' && order.status !== 'paid') return NextResponse.json({ error: '订单状态不可履约。' }, { status: 400 })

  const now = new Date().toISOString()
  await recordPaymentEvent({
    orderId: parsed.orderId,
    provider: order.provider,
    providerTradeNo: parsed.providerTradeNo,
    eventType: 'manual_correction',
    payload: { reason: parsed.reason, adminId: admin.id },
    isValid: true,
    createdAt: now
  })

  if (order.status === 'pending') {
    await markOrderPaid({ orderId: parsed.orderId, providerTradeNo: parsed.providerTradeNo, paidAt: now })
  }

  const result = await fulfillPaidOrder(parsed.orderId, now)
  return NextResponse.json({ ok: true, ...result })
}
