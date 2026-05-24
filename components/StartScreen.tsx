import type { StyleKey } from '@/lib/types'
import { StylePicker } from './StylePicker'

const RECOMMENDED_TOPICS = [
  'RAG 是怎么工作的',
  'Transformer 的注意力机制',
  'Agent 和 Workflow 有什么区别',
  'OAuth 登录流程怎么走',
  '牛顿第二定律'
]

type StartScreenProps = {
  query: string
  style: StyleKey
  error: string | null
  isGenerating: boolean
  onQueryChange: (query: string) => void
  onStyleChange: (style: StyleKey) => void
  onGenerate: () => void
}

export function StartScreen({ query, style, error, isGenerating, onQueryChange, onStyleChange, onGenerate }: StartScreenProps) {
  return (
    <section className="start-screen">
      <h1>FollowVine</h1>
      <p>输入一个知识点，生成可点击下钻的中文图解页。</p>

      <div className="topic-chips" aria-label="推荐 Demo">
        {RECOMMENDED_TOPICS.map((topic) => (
          <button className="topic-chip" key={topic} type="button" onClick={() => onQueryChange(topic)}>
            {topic}
          </button>
        ))}
      </div>

      <div className="prompt-card">
        <label className="field-label">
          <span>知识主题</span>
          <input aria-label="知识主题" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="比如：RAG 是怎么工作的" />
        </label>

        <StylePicker value={style} onChange={onStyleChange} />

        <button className="primary-button" type="button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? '生成中…' : '生成图解'}
        </button>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}
    </section>
  )
}
