import type { SelectOption } from '../types/utilType'

/** 旧 Common.js のジャンル区分。バックエンドの区分値を変更しない。 */
export const genreOptions: SelectOption[] = [
  { value: 0, label: '' },
  ...['ホラー', 'ファンタジー', 'SF', '恋愛', '日常', 'アクション', '冒険', 'ミステリー', 'コメディ', 'スポーツ', '歴史', '学園', 'エッセイ', 'その他']
    .map((label, index) => ({ value: index + 1, label })),
]

export function genreLabel(value: unknown) {
  return genreOptions.find(option => Number(option.value) === Number(value))?.label || '未設定'
}

/** 旧 FormatDateTimeWithWeekday の表示書式。 */
export function formatDateTime(value: unknown) {
  if (!value) return ''
  const text = String(value)
  const date = new Date(text.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return text
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${weekdays[date.getDay()]})${date.getHours()}時${date.getMinutes()}分${date.getSeconds()}.${date.getMilliseconds()}秒`
}

export function formatShortDate(value: unknown) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}/${match[2]}/${match[3]}` : text
}

export function unformatDate(value: string) {
  const digits = value.replace(/[^0-9]/g, '')
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : value
}

export function formatDateWithWeekday(value: unknown) {
  if (!value) return ''
  const text = String(value)
  const date = new Date(text.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return text
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${weekdays[date.getDay()]})`
}


