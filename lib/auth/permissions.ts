import type { UserRole, UserStatus } from '@/lib/commercial/types'

export function canAccessAdmin(user: { role: UserRole; status: UserStatus } | null): boolean {
  return user?.role === 'admin' && user.status === 'active'
}
