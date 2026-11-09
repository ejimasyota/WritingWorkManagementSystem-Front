import type { EntryDefinition } from '../types/character'

export const characterSections = [
  ['basic', '基本'], ['body', '身体'], ['inner1', '内面①'], ['inner2', '内面②'],
  ['affiliation', '所属'], ['origin', '出身'], ['skill', '技能'], ['detail', '詳細①'],
  ['detail2', '詳細②'], ['detail3', '執筆用備考'], ['tag', 'タグ'], ['image', '画像'],
]
export interface CharacterField {
  key: string
  label: string
  section: string
  type?: 'date' | 'number' | 'color' | 'select' | 'long'
  maxLength?: number
  options?: string
  help?: string
}

/** 旧 ShowCharacterSetting の項目順。表示は縦スクロールのセクションに変更。保存用のキーは既存PHPの名称を使用する。 */
export const characterFields: CharacterField[] = [
  { key: 'CharaName', label: 'キャラ名', section: 'basic', maxLength: 100 },
  { key: 'Furigana', label: 'フリガナ', section: 'basic', maxLength: 255 },
  { key: 'Nickname', label: 'ニックネーム', section: 'basic', maxLength: 255 },
  { key: 'BirthDate', label: '生年月日', section: 'basic', type: 'date' },
  { key: 'DeathDate', label: '没年月日', section: 'basic', type: 'date' },
  { key: 'Age', label: '年齢', section: 'basic', type: 'number', help: '舞台設定日と生年月日が入力済みの場合は自動で算出されます\nそのため、舞台設定日が未入力の場合のみ入力可能となります' },
  { key: 'Purpose', label: '目的', section: 'basic', type: 'long' },
  { key: 'Gender', label: '性別', section: 'body', type: 'select', options: 'Gender' },
  { key: 'BloodType', label: '血液型', section: 'body', type: 'select', options: 'BloodType' },
  { key: 'HairColor', label: '髪色', section: 'body', type: 'color', maxLength: 7 },
  { key: 'EyeColor', label: '目の色', section: 'body', type: 'color', maxLength: 7 },
  { key: 'SkinColor', label: '肌の色', section: 'body', type: 'color', maxLength: 7 },
  { key: 'Model', label: 'モデル', section: 'body', maxLength: 100 },
  { key: 'Height', label: '身長', section: 'body', maxLength: 50 },
  { key: 'Weight', label: '体重', section: 'body', maxLength: 50 },
  { key: 'AppearanceRemarks', label: '身体備考', section: 'body', type: 'long' },
  { key: 'Personality', label: '性格', section: 'inner1', type: 'long' },
  { key: 'Belief', label: '信念・思想', section: 'inner1', type: 'long' },
  { key: 'RaceId', label: '種族', section: 'affiliation', type: 'select', options: 'Race' },
  { key: 'OrgId', label: '組織', section: 'affiliation', type: 'select', options: 'Organization' },
  { key: 'TeamId', label: 'チーム', section: 'affiliation', type: 'select', options: 'Team' },
  { key: 'ClassId', label: '階級', section: 'affiliation', type: 'select', options: 'Class' },
  { key: 'BirthplaceId', label: '出身地', section: 'origin', type: 'select', options: 'Stage' },
  { key: 'Biography', label: '生い立ち', section: 'origin', type: 'long' },
  { key: 'Alias', label: '二つ名', section: 'detail', maxLength: 255 },
  { key: 'VerbalTic', label: '口癖', section: 'detail', type: 'long' },
  { key: 'RoleInfo', label: '役割', section: 'detail2', type: 'long' },
  { key: 'CauseOfDeath', label: '死因', section: 'detail2', type: 'long', help: '没年月日が未入力の場合は入力不可となります' },
  { key: 'PendingSetting', label: '検討中・未確定の設定', section: 'detail3', type: 'long' },
  { key: 'Note', label: '備考', section: 'detail3', type: 'long' },
]

const reason = (label: string) => [
  { key: 'Content', label: '内容', required: true, maxLength: 255 },
  { key: 'Reason', label, multiline: true },
]
export const characterEntries: EntryDefinition[] = [
  { key: 'Likes', label: '好きな物', section: 'inner1', columns: reason('理由') },
  { key: 'Dislikes', label: '嫌いな物', section: 'inner1', columns: reason('理由') },
  { key: 'Landmine', label: '地雷', section: 'inner2', columns: reason('理由') },
  { key: 'StrongPoint', label: '長所', section: 'inner2', columns: reason('具体例') },
  { key: 'WeakPoint', label: '短所', section: 'inner2', columns: reason('具体例') },
  { key: 'FirstPerson', label: '一人称', section: 'detail', columns: [
    { key: 'Situation', label: '状況', maxLength: 255 },
    { key: 'Content', label: '一人称', required: true, maxLength: 50 },
  ] },
  { key: 'SecondPerson', label: '二人称', section: 'detail', columns: [
    { key: 'Situation', label: '状況', maxLength: 255 },
    { key: 'Content', label: '二人称', required: true, maxLength: 50 },
  ] },
  { key: 'Habit', label: '癖', section: 'detail2', columns: reason('具体例') },
  { key: 'Hobby', label: '趣味', section: 'detail2', columns: reason('きっかけ') },
  { key: 'Transition', label: '変遷', section: 'detail3', maxRows: 1, helpMessage: '序盤・中盤・最終的をまとめて1件で登録します。既に登録済みの場合は追加できません。', columns: [
    { key: 'Early', label: '序盤', required: true, multiline: true },
    { key: 'Late', label: '中盤', multiline: true },
    { key: 'Final', label: '最終的', multiline: true },
  ] },
]

export const characterSkills = [
  { key: 'Weapons', label: '武器', master: 'Weapon', id: 'WeaponId', name: 'WeaponName', help: '武器設定画面で武器が登録されていない場合や、登録済みの武器を全て追加している場合は追加できません' },
  { key: 'Powers', label: '能力', master: 'Power', id: 'PowerId', name: 'PowerName', help: '能力設定画面で能力が登録されていない場合や、登録済みの能力を全て追加している場合は追加できません\n能力を削除した場合、その能力に紐づく技も技一覧から削除されます' },
  { key: 'Moves', label: '技', master: 'Move', id: 'MoveId', name: 'MoveName', help: '登録した能力に紐づく技、または関連能力が未設定の技のみ追加できます\nいずれも存在しない場合や、それらを全て追加している場合は追加できません' },
]
export const masterDefinitions = [
  ['Organization', 'OrgId', 'OrgName'], ['Team', 'TeamId', 'TeamName'], ['Race', 'RaceId', 'RaceName'],
  ['Class', 'ClassId', 'ClassName'], ['Power', 'PowerId', 'PowerName'], ['Weapon', 'WeaponId', 'WeaponName'],
  ['Move', 'MoveId', 'MoveName'], ['Tag', 'TagId', 'TagName'], ['Stage', 'StageId', 'StageName'],
] as const
