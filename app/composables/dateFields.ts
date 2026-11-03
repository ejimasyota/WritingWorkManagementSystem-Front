export type DateMode = 'year' | 'year-month' | 'date'

interface DateFields {
  year: string
  month: string
  day: string
  mode: DateMode
}

/** 旧 DatePicker.FormatFromFields の範囲補正と和文表記を踏襲する。 */
export function formatDateFields(
  year: string,
  month: string,
  day: string,
  mode: DateMode,
): string {
  const digits = (value: string) => value.replace(/[^0-9]/g, '')
  const yearValue = digits(year)
  const monthValue = digits(month)
  const dayValue = digits(day)

  if (!yearValue || yearValue.length > 4) return ''
  if (mode !== 'year' && !monthValue) return ''
  if (mode === 'date' && !dayValue) return ''

  const yearLabel = `${Number(yearValue)}年`
  if (mode === 'year') return yearLabel

  const monthNumber = Math.max(1, Math.min(12, Number(monthValue)))
  const monthLabel = `${String(monthNumber).padStart(2, '0')}月`
  if (mode === 'year-month') return yearLabel + monthLabel

  // 旧実装と同じく、2月は28日を上限とする。
  const maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const dayNumber = Math.max(1, Math.min(maxDays[monthNumber - 1]!, Number(dayValue)))
  return yearLabel + monthLabel + `${String(dayNumber).padStart(2, '0')}日`
}

/** 旧 ParseExistingValue / DetectModeFromValue の形式判定を移植する。 */
export function parseDateFields(value: string): DateFields {
  let parts: string[] = []

  for (const pattern of [
    /^(\d+)年(\d+)月(\d+)日?$/,
    /^(\d+)年(\d+)月?$/,
    /^(\d+)年$/,
    /^(\d+)-(\d+)-(\d+)$/,
    /^(\d+)-(\d+)$/,
  ]) {
    const match = value.trim().match(pattern)
    if (match) {
      parts = match.slice(1)
      break
    }
  }

  if (!parts.length) {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length >= 7 && digits.length <= 10) {
      parts = [digits.slice(0, -4), digits.slice(-4, -2), digits.slice(-2)]
    } else if (digits.length >= 5 && digits.length <= 8) {
      parts = [digits.slice(0, -2), digits.slice(-2)]
    } else if (digits.length >= 1 && digits.length <= 4) {
      parts = [digits]
    }
  }

  const year = parts[0] || ''
  const month = parts[1] || ''
  const day = parts[2] || ''
  return { year, month, day, mode: day ? 'date' : month ? 'year-month' : 'year' }
}
