import { CONST_VARIABLE } from '../config/Const'
import type { CharacterDraft, CharacterEntry, CharacterImage, CharacterMaster, CharacterMasters, CharacterRow, EntryDefinition } from '../types/character'
import { characterEntries, characterFields, characterSkills, masterDefinitions } from './characterFields'

/** 表形式移行前のフリーテキストも、旧コントローラと同様に必須列へ復元する。 */
export function parseEntry(value: unknown, definition: EntryDefinition): CharacterEntry[] {
  if (value == null || String(value).trim() === '') return []
  const required = definition.columns.find(column => column.required)!.key
  const row = (input: Record<string, unknown>) => Object.fromEntries(definition.columns.map(column => [column.key, String(input[column.key] ?? '')]))
  try {
    const parsed = JSON.parse(String(value))
    if (parsed && Array.isArray(parsed[definition.key])) {
      return parsed[definition.key]
        .filter((item: Record<string, unknown>) => item && item[required] != null && String(item[required]).trim() !== '')
        .map(row)
    }
  } catch { /* 移行前データはJSONではない。 */ }
  return [row({ [required]: String(value) })]
}

export function parseIds(value: unknown, key: string, id: string): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const rows = parsed?.[key]
    if (!Array.isArray(rows)) return []
    return [...new Set(rows.filter(item => item && item[id] != null && String(item[id]) !== '').map(item => String(item[id])))]
  } catch { return [] }
}

export function parseCharacterImages(row?: Record<string, unknown>): CharacterImage[] {
  try {
    const parsed = row?.ImgList ? JSON.parse(String(row.ImgList)) : null
    if (Array.isArray(parsed?.Images)) {
      return parsed.Images.filter((image: CharacterImage) => image?.Path).map((image: CharacterImage) => ({
        Path: String(image.Path), Data: null, Size: 0, Caption: String(image.Caption || ''),
      }))
    }
  } catch { /* 一覧移行前の代表画像へフォールバックする。 */ }
  return row?.ImgPath ? [{ Path: String(row.ImgPath), Data: null, Size: 0, Caption: '' }] : []
}

/** 初回選択時は保存済み年齢を維持し、日付変更時だけ算出する旧動作を踏襲する。 */
export function createCharacterDraft(row?: CharacterRow, masters: CharacterMasters = {}): CharacterDraft {
  const fields = Object.fromEntries(characterFields.map(field => [field.key, String(row?.[field.key] ?? (['Gender', 'BloodType'].includes(field.key) ? '0' : ''))]))
  const entries = Object.fromEntries(characterEntries.map(definition => [definition.key, parseEntry(row?.[definition.key], definition)]))
  const skills = Object.fromEntries(characterSkills.map(definition => [definition.key, parseIds(row?.[definition.key], definition.key, definition.id)]))
  // 削除済みマスタは旧技能一覧でも除外されるため、保存用の状態からも除く。
  for (const definition of characterSkills) {
    skills[definition.key] = skills[definition.key]!.filter(id => masters[definition.master]?.some(item => String(item[definition.id]) === id))
  }
  skills.Moves = validMoveIds(skills.Powers || [], skills.Moves || [], masters.Move || [])
  const tags = parseIds(row?.TagInfo, 'TagInfo', 'TagId').flatMap(id => {
    const master = masters.Tag?.find(item => String(item.TagId) === id)
    return master ? [{ ...master }] : []
  })
  return { fields, entries, skills, tags, images: parseCharacterImages(row) }
}

export function validMoveIds(powers: string[], moves: string[], masters: CharacterMaster[]) {
  return moves.filter(id => masters.some(move => String(move.MoveId) === id && (!move.PowerId || powers.includes(String(move.PowerId)))))
}

export function stageOptions(stages: CharacterMaster[]) {
  const byId = new Map(stages.map(stage => [String(stage.StageId), stage]))
  return stages.map(stage => {
    const names: string[] = []
    const visited = new Set<string>()
    let current: CharacterMaster | undefined = stage
    while (current && !visited.has(String(current.StageId))) {
      visited.add(String(current.StageId))
      names.unshift(String(current.StageName))
      current = current.ParentStageId != null ? byId.get(String(current.ParentStageId)) : undefined
    }
    return { value: String(stage.StageId), label: names.join(' > ') }
  }).sort((left, right) => left.label.localeCompare(right.label, 'ja'))
}

export function characterOptions(key: string, fields: Record<string, string>, masters: CharacterMasters) {
  if (key === 'Gender') return ['', '男性', '女性', 'その他'].map((label, index) => ({ value: String(index), label }))
  if (key === 'BloodType') return ['', 'A', 'B', 'O', 'AB'].map((label, index) => ({ value: String(index), label }))
  if (key === 'Stage') return [{ value: '', label: '' }, ...stageOptions(masters.Stage || [])]
  const definition = masterDefinitions.find(item => item[0] === key)
  if (!definition) return []
  let source = masters[key] || []
  if (key === 'Class' || key === 'Team') {
    source = source.filter(item => fields.OrgId ? String(item.OrgId) === fields.OrgId : !item.OrgId)
  }
  return [{ value: '', label: '' }, ...source.map(item => ({ value: String(item[definition[1]]), label: String(item[definition[2]] || '') }))]
}

export function characterPayload(draft: CharacterDraft, row?: CharacterRow) {
  const payload: Record<string, unknown> = { ...draft.fields, CharaId: row?.CharaId ?? null, UpdateDate: row?.UpdateDate ?? null }
  for (const definition of characterEntries) {
    const rows = draft.entries[definition.key] || []
    payload[definition.key] = rows.length ? JSON.stringify({ [definition.key]: rows }) : ''
  }
  for (const definition of characterSkills) {
    const ids = draft.skills[definition.key] || []
    payload[definition.key] = ids.length ? JSON.stringify({ [definition.key]: ids.map(id => ({ [definition.id]: id })) }) : ''
  }
  payload.TagInfo = draft.tags.map(tag => ({ TagId: tag.TagId }))
  payload.Images = draft.images.map(image => ({ Path: image.Data ? '' : image.Path, Data: image.Data || null, Caption: image.Caption }))
  return payload
}

export function safeTagColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE
}
export function tagStyle(tag: CharacterMaster) {
  const background = safeTagColor(tag.TagColor)
  const rgb = [1, 3, 5].map(start => parseInt(background.slice(start, start + 2), 16))
  return { background, color: 0.299 * rgb[0]! + 0.587 * rgb[1]! + 0.114 * rgb[2]! > 160 ? '#222' : '#fff' }
}
