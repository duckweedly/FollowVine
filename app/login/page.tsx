export default function LoginPage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>登录 FollowVine</h1>
        <p>使用手机号或邮箱验证码登录，管理你的会员、积分和生成作品。</p>
        <form className="prompt-card">
          <label className="field-label">
            <span>手机号或邮箱</span>
            <input name="loginIdentifier" aria-label="手机号或邮箱" placeholder="user@example.com" />
          </label>
          <label className="field-label">
            <span>验证码</span>
            <input name="code" aria-label="验证码" placeholder="六位验证码" />
          </label>
          <button className="primary-button" type="submit">登录</button>
        </form>
      </section>
    </main>
  )
}
