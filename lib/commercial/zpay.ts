import { createHash, timingSafeEqual } from 'node:crypto'

type ZpayParams = Record<string, string | number | null | undefined>

function normalizeValue(value: string | number): string {
  return String(value)
}

function canonicalize(params: ZpayParams): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '' && value !== null && value !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${normalizeValue(value as string | number)}`)
    .join('&')
}

function assertRequiredFields(fields: Record<string, string>): void {
  if (Object.values(fields).some((value) => value.trim() === '')) {
    throw new Error('Z-Pay payment fields are required')
  }
}

function assertPositiveAmount(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error('Payment amount must be a positive integer')
  }
}

export function signZpayParams(params: ZpayParams, key: string): string {
  return createHash('md5').update(`${canonicalize(params)}${key}`).digest('hex')
}

export function verifyZpaySignature(params: ZpayParams & { sign?: string; sign_type?: string }, key: string): boolean {
  if (params.sign_type !== 'MD5' || !params.sign || !/^[a-f0-9]{32}$/i.test(params.sign)) return false
  const expected = signZpayParams(params, key)
  const actual = Buffer.from(params.sign)
  const expectedBuffer = Buffer.from(expected)
  return timingSafeEqual(actual, expectedBuffer)
}

export function buildZpayPaymentUrl(input: {
  gatewayUrl: string
  pid: string
  key: string
  paymentType: string
  outTradeNo: string
  notifyUrl: string
  returnUrl: string
  name: string
  amountCents: number
}): string {
  assertRequiredFields({
    pid: input.pid,
    type: input.paymentType,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name
  })
  assertPositiveAmount(input.amountCents)

  const params: Record<string, string> = {
    pid: input.pid,
    type: input.paymentType,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name,
    money: (input.amountCents / 100).toFixed(2)
  }
  const url = new URL(input.gatewayUrl)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  const sign = signZpayParams(Object.fromEntries(url.searchParams.entries()), input.key)
  url.searchParams.set('sign', sign)
  url.searchParams.set('sign_type', 'MD5')
  return url.toString()
}
