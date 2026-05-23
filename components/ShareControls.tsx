type ShareControlsProps = {
  shareUrl: string | null
  isDisabled: boolean
  onCreateShare: () => void
}

export function ShareControls({ shareUrl, isDisabled, onCreateShare }: ShareControlsProps) {
  return (
    <section>
      <button type="button" onClick={onCreateShare} disabled={isDisabled}>
        生成分享链接
      </button>
      {shareUrl ? <a href={shareUrl}>{shareUrl}</a> : null}
    </section>
  )
}
