/** 旧 Common.js の ParseDateStr / CalculateAge を移植。年のみは1月1日、年月は1日として扱う。 */
export function parseCharacterDate(DateStr: string): Date | null {
  if (!DateStr) return null
  const Str = String(DateStr).trim()

  let Year: number | null = null,
    Month: number | null = null,
    Day: number | null = null

  // 1. 区切り文字（年月日 または ハイフン）でのパース
  const M1 = Str.match(/^(\d+)年(\d+)月(\d+)日?$/)
  const M2 = Str.match(/^(\d+)年(\d+)月?$/)
  const M3 = Str.match(/^(\d+)年$/)
  const M4 = Str.match(/^(\d+)-(\d+)-(\d+)$/)
  const M5 = Str.match(/^(\d+)-(\d+)$/)

  if (M1) {
    Year = parseInt(M1[1]!, 10)
    Month = parseInt(M1[2]!, 10) - 1
    Day = parseInt(M1[3]!, 10)
  } else if (M4) {
    Year = parseInt(M4[1]!, 10)
    Month = parseInt(M4[2]!, 10) - 1
    Day = parseInt(M4[3]!, 10)
  } else if (M2) {
    Year = parseInt(M2[1]!, 10)
    Month = parseInt(M2[2]!, 10) - 1
    Day = 1
  } else if (M5) {
    Year = parseInt(M5[1]!, 10)
    Month = parseInt(M5[2]!, 10) - 1
    Day = 1
  } else if (M3) {
    Year = parseInt(M3[1]!, 10)
    Month = 0
    Day = 1
  } else {
    // 2. 区切り無しの数値のみ（後方互換）
    const Num = Str.replace(/[^0-9]/g, '')
    if (Num.length >= 8) {
      Year = parseInt(Num.substring(0, 4), 10)
      Month = parseInt(Num.substring(4, 6), 10) - 1
      Day = parseInt(Num.substring(6, 8), 10)
    } else if (Num.length >= 6) {
      Year = parseInt(Num.substring(0, 4), 10)
      Month = parseInt(Num.substring(4, 6), 10) - 1
      Day = 1
    } else if (Num.length >= 4) {
      Year = parseInt(Num.substring(0, 4), 10)
      Month = 0
      Day = 1
    } else {
      return null
    }
  }

  if (
    Year === null ||
    Month === null ||
    Day === null ||
    isNaN(Year) ||
    isNaN(Month) ||
    isNaN(Day)
  ) {
    return null
  }

  const D = new Date(Year, Month, Day)
  D.setFullYear(Year)
  return D
}

export function calculateAge(ReferenceDate: Date, BirthDate: Date): number {
  let Age = ReferenceDate.getFullYear() - BirthDate.getFullYear()
  const MonthDiff = ReferenceDate.getMonth() - BirthDate.getMonth()
  if (
    MonthDiff < 0 ||
    (MonthDiff === 0 && ReferenceDate.getDate() < BirthDate.getDate())
  ) {
    Age--
  }
  return Age
}

/** 旧 CalculateAgeFromBirthDate：死亡日と舞台設定日のうち過去の日時を基準にする。 */
export function characterAge(birthText: string, deathText: string, settingText: string): string {
  const birth = parseCharacterDate(birthText)
  if (!birth) return ''
  const setting = parseCharacterDate(settingText)
  const death = parseCharacterDate(deathText)
  const reference = death ? (setting && death > setting ? setting : death) : setting
  if (!reference) return ''
  const age = calculateAge(reference, birth)
  return age >= 0 ? String(age) : ''
}

/** 保存前の旧判定も維持する。粒度を補完した日付比較へ勝手に変更しない。 */
export function characterDateError(birth: string, death: string): string {
  const birthNumber = birth.replace(/[^0-9]/g, '')
  const deathNumber = death.replace(/[^0-9]/g, '')
  return birthNumber && deathNumber && deathNumber < birthNumber
    ? '没年月日は生年月日より後の日付を設定してください' : ''
}
