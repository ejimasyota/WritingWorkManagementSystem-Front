/** 旧Common.jsの祝日計算を移植。日付表示・ガントチャートで共有する。 */
const JapaneseHolidayCache: Record<number, Record<string, string>> = {};
function BuildJapaneseHolidayKey(Year: number, Month: number, Day: number) {
  return `${Year}-${String(Month).padStart(2, '0')}-${String(Day).padStart(2, '0')}`;
}

/**
 * Dateオブジェクトから祝日判定用のキーを生成する
 * @param {Date} TargetDate 対象日
 * @returns {string} キー文字列
 */
function GetJapaneseHolidayKey(TargetDate: Date) {
  return BuildJapaneseHolidayKey(TargetDate.getFullYear(), TargetDate.getMonth() + 1, TargetDate.getDate());
}

/**
 * 指定した年月の第N週の指定曜日の日付を取得する（ハッピーマンデーの算出に使用）
 * @param {number} Year 年
 * @param {number} Month 月（1〜12）
 * @param {number} Weekday 曜日（0=日〜6=土）
 * @param {number} Nth 第何週か（1〜）
 * @returns {number} 日
 */
function GetNthWeekdayOfMonth(Year: number, Month: number, Weekday: number, Nth: number) {
  const FirstDay = new Date(Year, Month - 1, 1).getDay();
  return 1 + (Weekday - FirstDay + 7) % 7 + (Nth - 1) * 7;
}

/**
 * 春分の日／秋分の日を近似式で求める
 * @param {number} Year 年
 * @param {boolean} IsSpring 春分ならtrue、秋分ならfalse
 * @returns {number} 日（有効範囲外の場合は0）
 */
function GetJapaneseEquinoxDay(Year: number, IsSpring: boolean) {
  if (Year < 1980 || Year > 2099) return 0;
  const BaseValue = IsSpring ? 20.8431 : 23.2488;
  return Math.floor(BaseValue + 0.242194 * (Year - 1980) - Math.floor((Year - 1980) / 4));
}

/**
 * 指定年の祝日一覧を組み立てる
 * @param {number} Year 年
 * @returns {Object} { 'yyyy-MM-dd': 祝日名 } 形式のオブジェクト
 */
function BuildJapaneseHolidayMap(Year: number) {
  const HolidayMap: Record<string, string> = {};
  const Add = (Month: number, Day: number, Name: string) => {
    // 近似式の有効範囲外は0が返るため、その場合は登録しない
    if (!Day) return;
    HolidayMap[BuildJapaneseHolidayKey(Year, Month, Day)] = Name;
  };
  Add(1, 1, '元日');
  Add(1, GetNthWeekdayOfMonth(Year, 1, 1, 2), '成人の日');
  Add(2, 11, '建国記念の日');
  Add(2, 23, '天皇誕生日');
  Add(3, GetJapaneseEquinoxDay(Year, true), '春分の日');
  Add(4, 29, '昭和の日');
  Add(5, 3, '憲法記念日');
  Add(5, 4, 'みどりの日');
  Add(5, 5, 'こどもの日');
  Add(7, GetNthWeekdayOfMonth(Year, 7, 1, 3), '海の日');
  Add(8, 11, '山の日');
  Add(9, GetNthWeekdayOfMonth(Year, 9, 1, 3), '敬老の日');
  Add(9, GetJapaneseEquinoxDay(Year, false), '秋分の日');
  Add(10, GetNthWeekdayOfMonth(Year, 10, 1, 2), 'スポーツの日');
  Add(11, 3, '文化の日');
  Add(11, 23, '勤労感謝の日');
  AddJapaneseSubstituteHolidays(HolidayMap);
  AddJapaneseNationalHolidays(HolidayMap);
  return HolidayMap;
}

/**
 * 振替休日を追加する
 * 祝日が日曜と重なった場合、その後の祝日でない最初の日を休日とする
 * @param {Object} HolidayMap 祝日一覧（直接更新する）
 */
function AddJapaneseSubstituteHolidays(HolidayMap: Record<string, string>) {
  // 走査中に要素を追加するため、キーの一覧を先に確定させる
  Object.keys(HolidayMap).sort().forEach(Key => {
    const [Year, Month, Day] = Key.split('-').map(Number);
    const HolidayDate = new Date(Year!, Month! - 1, Day!);
    if (HolidayDate.getDay() !== 0) return;
    do {
      HolidayDate.setDate(HolidayDate.getDate() + 1);
    } while (HolidayMap[GetJapaneseHolidayKey(HolidayDate)]);
    HolidayMap[GetJapaneseHolidayKey(HolidayDate)] = '振替休日';
  });
}

/**
 * 国民の休日を追加する
 * 前後を祝日に挟まれた平日を休日とする（9月のシルバーウィークなど）
 * @param {Object} HolidayMap 祝日一覧（直接更新する）
 */
function AddJapaneseNationalHolidays(HolidayMap: Record<string, string>) {
  Object.keys(HolidayMap).sort().forEach(Key => {
    const [Year, Month, Day] = Key.split('-').map(Number);
    const BetweenDate = new Date(Year!, Month! - 1, Day! + 1);
    const NextDate = new Date(Year!, Month! - 1, Day! + 2);
    // 日曜は振替休日の対象であり、国民の休日にはならない
    if (BetweenDate.getDay() === 0) return;
    if (HolidayMap[GetJapaneseHolidayKey(BetweenDate)]) return;
    if (!HolidayMap[GetJapaneseHolidayKey(NextDate)]) return;
    HolidayMap[GetJapaneseHolidayKey(BetweenDate)] = '国民の休日';
  });
}

/**
 * 指定日の祝日名を取得する
 * @param {Date} TargetDate 対象日
 * @returns {string} 祝日名（祝日でない場合は空文字）
 */
export function japaneseHolidayName(TargetDate: Date) {
  if (!(TargetDate instanceof Date) || isNaN(TargetDate.getTime())) return '';
  const Year = TargetDate.getFullYear();
  if (!JapaneseHolidayCache[Year]) {
    JapaneseHolidayCache[Year] = BuildJapaneseHolidayMap(Year);
  }
  return JapaneseHolidayCache[Year][GetJapaneseHolidayKey(TargetDate)] || '';
}
