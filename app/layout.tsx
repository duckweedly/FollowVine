import './globals.css'

export const metadata = {
  title: 'FollowVine',
  description: 'Chinese AI visual flipbook'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
