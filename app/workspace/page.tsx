export default function WorkspacePage() {
  return (
    <main className="app-shell">
      <section className="start-screen">
        <h1>FollowVine Workspace</h1>
        <p>生成可下钻的中文图解路径，并在创建任务前查看余额与预估消耗。</p>
        <div className="prompt-card">
          <label className="field-label">
            <span>知识主题</span>
            <input aria-label="知识主题" placeholder="比如：RAG 是怎么工作的" />
          </label>
          <div className="field-label">
            <span>余额与预估消耗</span>
            <strong>当前余额 0 积分 · 本次预计 0 积分</strong>
          </div>
          <button className="primary-button" type="button">创建生成任务</button>
        </div>
      </section>
    </main>
  )
}
