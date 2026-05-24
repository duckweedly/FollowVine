import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getCurrentUserFromSession } from '@/lib/auth/current-user'
import { createOrder, findCreditPackById, findMembershipPlanById } from '@/lib/commercial/billing-store'
import type { CreditPack, MembershipPlan, OrderType } from '@/lib/commercial/types'
import { buildZpayPaymentUrl } from '@/lib/commercial/zpay'

type OrderRequest = {
  productType?: unknown
  productId?: unknown
  paymentType?: unknown
}

const supportedPaymentTypes = new Set(['alipay'])

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function findProduct(productType: string, productId: string): Promise<{ product: CreditPack | MembershipPlan; orderType: OrderType } | null> {
  if (productType === 'credit_pack') {
    const product = await findCreditPackById(productId)
    return product ? { product, orderType: 'credit_pack' } : null
  }

  if (productType === 'membership') {
    const product = await findMembershipPlanById(productId)
    return product ? { product, orderType: 'membership' } : null
  }

  return null
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromSession(cookieStore.get('fv_session')?.value)
  if (!user) return NextResponse.json({ error: '请先登录。' }, { status: 401 })

  const body = await request.json().catch(() => null) as OrderRequest | null
  const productType = String(body?.productType ?? '')
  const productId = String(body?.productId ?? '')
  const paymentType = String(body?.paymentType ?? 'alipay')
  if (!supportedPaymentTypes.has(paymentType)) return NextResponse.json({ error: '支付方式不可用。' }, { status: 400 })

  const found = await findProduct(productType, productId)
  if (!found) return NextResponse.json({ error: '商品不可用。' }, { status: 400 })

  const orderId = `order_${randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()
  const appUrl = requiredEnv('NEXT_PUBLIC_APP_URL')
  const paymentUrl = buildZpayPaymentUrl({
    gatewayUrl: requiredEnv('ZPAY_GATEWAY_URL'),
    pid: requiredEnv('ZPAY_PID'),
    key: requiredEnv('ZPAY_KEY'),
    paymentType,
    outTradeNo: orderId,
    notifyUrl: `${appUrl}/api/payments/zpay/notify`,
    returnUrl: `${appUrl}/account`,
    name: found.product.name,
    amountCents: found.product.priceCents
  })

  await createOrder({
    id: orderId,
    userId: user.id,
    orderType: found.orderType,
    amountCents: found.product.priceCents,
    productId: found.product.id,
    provider: 'zpay',
    now
  })

  return NextResponse.json({ orderId, paymentUrl })
}
