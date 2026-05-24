import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/admin/AdminNav'
import { canAccessAdmin } from '@/lib/auth/permissions'
import { verifySessionToken } from '@/lib/auth/session'
import { findUserById } from '@/lib/commercial/store'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = verifySessionToken(cookieStore.get('fv_session')?.value ?? '')
  if (!session) redirect('/login')

  const user = await findUserById(session.userId)
  if (!canAccessAdmin(user)) redirect('/login')

  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>Admin Console</h1>
        <p>Manage users, credits, orders, memberships, model channels, generation tasks, and system settings.</p>
        <AdminNav />
      </section>
      <section className="workspace-panel">{children}</section>
    </main>
  )
}
