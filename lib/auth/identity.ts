import type { LoginType } from '@/lib/commercial/types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mainlandPhonePattern = /^1\d{10}$/

export function normalizeLoginIdentifier(value: string): { loginType: LoginType; loginIdentifier: string } {
  const trimmed = value.trim()
  const email = trimmed.toLowerCase()
  if (emailPattern.test(email)) return { loginType: 'email', loginIdentifier: email }

  const phone = trimmed.replace(/[\s-]/g, '')
  if (mainlandPhonePattern.test(phone)) return { loginType: 'phone', loginIdentifier: phone }

  throw new Error('Enter a valid phone number or email')
}
