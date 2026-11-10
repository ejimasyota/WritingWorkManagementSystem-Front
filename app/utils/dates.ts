/** 旧 Common.js の ParseDateStr / CalculateAge を移植。年のみは1月1日、年月は1日として扱う。 */
export function parseFlexibleDate(DateStr: string): Date | null {
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


/** 粒度が異なる日付は粗い側に揃えて比較する。年と年月の組み合わせでは年だけを見る。 */
export function compareFlexibleDates(left: string, right: string): number | null {
  const first = parseFlexibleDate(left);
  const second = parseFlexibleDate(right);
  if (!first || !second) return null;
  const precision = (text: string) => {
    const length = text.replace(/[^0-9]/g, '').length;
    if (length >= 8) return 3;
    if (length >= 6) return 2;
    return 1;
  };
  const level = Math.min(precision(left), precision(right));
  const comparable = (date: Date) => {
    let value = date.getFullYear();
    if (level >= 2) value = value * 100 + date.getMonth() + 1;
    if (level >= 3) value = value * 100 + date.getDate();
    return value;
  };
  return Math.sign(comparable(first) - comparable(second));
}

/** 保存されている日付の表記を、既存画面と同じ年月日表記で表示する。 */
export function formatSettingDate(text: string): string {
  if (!text) return '';
  const digits = text.replace(/[^0-9]/g, '');
  const year = String(Number.parseInt(digits.slice(0, 4), 10));
  if (digits.length === 8) return year + '年' + digits.slice(4, 6) + '月' + digits.slice(6, 8) + '日';
  if (digits.length === 6) return year + '年' + digits.slice(4, 6) + '月';
  if (digits.length === 4) return year + '年';
  return text;
}
