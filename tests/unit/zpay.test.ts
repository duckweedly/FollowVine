import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildZpayPaymentUrl, signZpayParams, verifyZpaySignature } from '@/lib/commercial/zpay'

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex')
}

describe('zpay helpers', () => {
  it('signs non-empty params by sorted key order and excludes sign fields', () => {
    const params = {
      money: '9.90',
      name: 'Starter Credits',
      out_trade_no: 'order_1',
      pid: '1001',
      sign: 'ignored',
      sign_type: 'MD5',
      empty: ''
    }

    expect(signZpayParams(params, 'secret')).toBe(md5('money=9.90&name=Starter Credits&out_trade_no=order_1&pid=1001secret'))
  })

  it('verifies valid signatures and rejects wrong signatures', () => {
    const params = { pid: '1001', out_trade_no: 'order_1', money: '9.90' }
    const sign = signZpayParams(params, 'secret')

    expect(verifyZpaySignature({ ...params, sign, sign_type: 'MD5' }, 'secret')).toBe(true)
    expect(verifyZpaySignature({ ...params, sign: 'bad', sign_type: 'MD5' }, 'secret')).toBe(false)
  })

  it('builds payment URLs with signed query parameters', () => {
    const url = buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990
    })

    expect(url.startsWith('https://pay.example.com/submit.php?')).toBe(true)
    expect(url).toContain('out_trade_no=order_1')
    expect(url).toContain('money=9.90')
    expect(url).toContain('sign_type=MD5')
    expect(url).toContain('sign=')
  })

  it('preserves existing gateway query params when building payment URLs', () => {
    const url = new URL(buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php?client=mobile&lang=zh',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990
    }))

    expect(url.searchParams.get('client')).toBe('mobile')
    expect(url.searchParams.get('lang')).toBe('zh')
    expect(url.searchParams.get('out_trade_no')).toBe('order_1')
  })

  it('builds payment URL params that verify with the generated signature', () => {
    const url = new URL(buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php?client=mobile',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990
    }))
    const params = Object.fromEntries(url.searchParams.entries())

    expect(verifyZpaySignature(params, 'secret')).toBe(true)
  })

  it.each([0, -1, Number.NaN])('rejects invalid payment amount %s', (amountCents) => {
    expect(() => buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents
    })).toThrow('Payment amount must be a positive integer')
  })

  it.each([
    ['pid', { pid: '' }],
    ['name', { name: '' }],
    ['outTradeNo', { outTradeNo: '' }],
    ['notifyUrl', { notifyUrl: '' }],
    ['returnUrl', { returnUrl: '' }],
    ['paymentType', { paymentType: '' }]
  ])('rejects empty required payment field %s', (_field, override) => {
    expect(() => buildZpayPaymentUrl({
      gatewayUrl: 'https://pay.example.com/submit.php',
      pid: '1001',
      key: 'secret',
      paymentType: 'alipay',
      outTradeNo: 'order_1',
      notifyUrl: 'https://app.example.com/api/payments/zpay/notify',
      returnUrl: 'https://app.example.com/account',
      name: 'Starter Credits',
      amountCents: 990,
      ...override
    })).toThrow('Z-Pay payment fields are required')
  })

  it('rejects missing or non-MD5 signature type', () => {
    const params = { pid: '1001', out_trade_no: 'order_1', money: '9.90' }
    const sign = signZpayParams(params, 'secret')

    expect(verifyZpaySignature({ ...params, sign }, 'secret')).toBe(false)
    expect(verifyZpaySignature({ ...params, sign, sign_type: 'RSA' }, 'secret')).toBe(false)
  })

  it('rejects non-hex signatures', () => {
    const params = { pid: '1001', out_trade_no: 'order_1', money: '9.90' }

    expect(verifyZpaySignature({ ...params, sign: 'g'.repeat(32), sign_type: 'MD5' }, 'secret')).toBe(false)
  })
})
