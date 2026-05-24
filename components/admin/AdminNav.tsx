import Link from 'next/link'

const adminLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/orders', label: 'Orders & Credits' },
  { href: '/admin/membership', label: 'Membership' },
  { href: '/admin/model-channels', label: 'Model Channels' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/settings', label: 'Settings' }
]

export function AdminNav() {
  return (
    <nav className="history-strip" aria-label="Admin navigation">
      {adminLinks.map((link) => (
        <Link key={link.href} href={link.href}>{link.label}</Link>
      ))}
    </nav>
  )
}
