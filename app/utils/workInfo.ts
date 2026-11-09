import type { SelectOption } from '../types/utilType'
import type { WorkInfo } from '../types/work'

/** 旧 Common.js / PullDownList('Motif') の区分値と表示順を維持する。 */
export const motifOptions: SelectOption[] = [
  { value: 0, label: '' },
  ...['海賊', '忍者', '神話', 'エクソシスト', '侍・武士', '魔法・魔術', 'ロボット・メカ',
    '吸血鬼', '妖怪・怪異', '宇宙', '近未来・サイバーパンク', 'スチームパンク', 'ゾンビ',
    '軍事・ミリタリー', '探偵・ミステリー', '錬金術', '死神', '怪盗']
    .map((label, index) => ({ value: index + 1, label })),
]

export function workInfoForm(work: WorkInfo) {
  return {
    WorkTitle: work.WorkTitle,
    Genre: Number(work.Genre),
    SettingDate: work.SettingDate || '',
    Motif: Number(work.Motif || 0),
    Theme: work.Theme || '',
    Description: work.Description || '',
  }
}

export type WorkInfoForm = ReturnType<typeof workInfoForm>

/** 入力欄と概要ダイアログは同じ値を共有し、保存時にだけ前後の空白を除く。 */
export function workInfoPayload(form: WorkInfoForm, original: WorkInfo) {
  return {
    WorkTitle: form.WorkTitle.trim(),
    Genre: Number(form.Genre),
    SettingDate: form.SettingDate.trim(),
    Motif: Number(form.Motif),
    Theme: form.Theme.trim(),
    Description: form.Description.trim(),
    UpdateDate: original.UpdateDate,
  }
}

export function settingDateConfirmation(before: string, after: string) {
  return '舞台設定日を変更します。\n'
    + `（変更前: ${before || '未設定'} → 変更後: ${after || '未設定'}）\n\n`
    + '舞台設定日はキャラクター・経歴の年齢の基準日となるため、\n'
    + '登録済みの年齢と不整合が発生する恐れがあります。\n'
    + '変更してよろしいですか？'
}
