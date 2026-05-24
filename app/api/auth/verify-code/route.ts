import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { normalizeLoginIdentifier } from '@/lib/auth/identity'
import { createSessionToken } from '@/lib/auth/session'
import { verifyCodeHash } from '@/lib/auth/verification'
import { consumeVerificationCode, createUserWithCreditAccount, findLatestUsableVerificationCode, findUserByLoginIdentifier } from '@/lib/commercial/store'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { loginIdentifier?: unknown; code?: unknown } | null

  let identity: ReturnType<typeof normalizeLoginIdentifier>
  try {
    identity = normalizeLoginIdentifier(String(body?.loginIdentifier ?? ''))
  } catch {
    return NextResponse.json({ error: '请输入有效手机号或邮箱。' }, { status: 400 })
  }

  const code = String(body?.code ?? '')
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: '请输入六位验证码。' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const verificationCode = await findLatestUsableVerificationCode(identity.loginIdentifier, now)
  if (!verificationCode || !verifyCodeHash(code, verificationCode.codeHash)) {
    return NextResponse.json({ error: '验证码无效或已过期。' }, { status: 400 })
  }

  await consumeVerificationCode(verificationCode.id, now)

  let user = await findUserByLoginIdentifier(identity.loginIdentifier)
  if (!user) {
    const userId = `user_${randomUUID().replace(/-/g, '')}`
    await createUserWithCreditAccount({ id: userId, loginIdentifier: identity.loginIdentifier, loginType: identity.loginType, role: 'user', now })
    user = await findUserByLoginIdentifier(identity.loginIdentifier)
  }

  if (!user) {
    return NextResponse.json({ error: '登录失败，请稍后再试。' }, { status: 502 })
  }

  if (user.status !== 'active') {
    return NextResponse.json({ error: '账号已被禁用。' }, { status: 403 })
  }

  const cookieStore = await cookies()
  cookieStore.set('fv_session', createSessionToken({ userId: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })

  return NextResponse.json({ ok: true })
}
