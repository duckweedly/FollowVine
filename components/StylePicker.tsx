import type { StyleKey } from '@/lib/types'
import { getLaunchStyles } from '@/lib/styles'

type StylePickerProps = {
  value: StyleKey
  onChange: (style: StyleKey) => void
}

export function StylePicker({ value, onChange }: StylePickerProps) {
  return (
    <label className="field-label style-field">
      <span>视觉风格</span>
      <select value={value} onChange={(event) => onChange(event.target.value as StyleKey)}>
        {getLaunchStyles().map((style) => (
          <option key={style.key} value={style.key}>
            {style.displayName}
          </option>
        ))}
      </select>
    </label>
  )
}
