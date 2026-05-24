import { NextResponse } from 'next/server'
import { fulfillPaidOrder } from '@/lib/commercial/fulfillment'
import { findOrderById, markOrderPaid, recordPaymentEvent } from '@/lib/commercial/billing-store'
import { verifyZpaySignature } from '@/lib/commercial/zpay'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function textResponse(body: 'success' | 'fail', status = 200): Response {
  return new NextResponse(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  })
}

function parseAmountCents(value: string | undefined): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  const [yuan, cents = ''] = value.split('.')
  const paddedCents = cents.padEnd(2, '0')
  const amount = Number(yuan) * 100 + Number(paddedCents)
  return Number.isSafeInteger(amount) ? amount : null
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData()
  const params = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  const now = new Date().toISOString()
  const isValid = verifyZpaySignature(params, requiredEnv('ZPAY_KEY'))
  const orderId = params.out_trade_no || null
  const providerTradeNo = params.trade_no || null
  const order = orderId ? await findOrderById(orderId) : null

  await recordPaymentEvent({
    orderId: order ? order.id : null,
    provider: 'zpay',
    providerTradeNo,
    eventType: 'notify',
    payload: params,
    isValid,
    createdAt: now
  })

  if (!isValid || params.trade_status !== 'TRADE_SUCCESS' || !orderId || !providerTradeNo || !order || order.provider !== 'zpay' || parseAmountCents(params.money) !== order.amountCents) {
    return textResponse('fail', 400)
  }

  if (order.status === 'pending') {
    await markOrderPaid({ orderId, providerTradeNo, paidAt: now })
  } else if (order.status !== 'paid') {
    return textResponse('fail', 400)
  }

  await fulfillPaidOrder(orderId, now)
  return textResponse('success')
}
