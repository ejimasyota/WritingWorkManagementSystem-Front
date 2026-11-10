import type { CharacterEntry, EntryDefinition } from '../types/character';

/** 表形式の項目を復元し、移行前の文字列も必須列の一行として読み込む。 */
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

