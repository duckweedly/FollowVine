import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'
import { createVerificationCode, createVerificationExpiry, hashVerificationCode } from '@/lib/auth/verification'
import { saveVerificationCode } from '@/lib/commercial/store'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { loginIdentifier?: unknown } | null

  let identity: ReturnType<typeof normalizeLoginIdentifier>
  try {
    identity = normalizeLoginIdentifier(String(body?.loginIdentifier ?? ''))
  } catch {
    return NextResponse.json({ error: '请输入有效手机号或邮箱。' }, { status: 400 })
  }

  const nowDate = new Date()
  const now = nowDate.toISOString()
  const code = createVerificationCode()
  await saveVerificationCode({
    id: `vc_${randomUUID().replace(/-/g, '')}`,
    loginIdentifier: identity.loginIdentifier,
    loginType: identity.loginType,
    codeHash: hashVerificationCode(code),
    expiresAt: createVerificationExpiry(nowDate, 10).toISOString(),
    now
  })
  return NextResponse.json({ ok: true })
}
