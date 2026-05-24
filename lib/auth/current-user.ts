import { verifySessionToken } from './session'
import { findUserById } from '@/lib/commercial/store'
import type { User } from '@/lib/commercial/types'

export async function getCurrentUserFromSession(sessionToken: string | null | undefined): Promise<User | null> {
  if (!sessionToken) return null

  const payload = verifySessionToken(sessionToken)
  if (!payload) return null

  const user = await findUserById(payload.userId)
  return user?.status === 'active' ? user : null
}
