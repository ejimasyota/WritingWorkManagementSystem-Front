import { CONST_VARIABLE } from '../config/Const'
import type { CharacterMaster } from '../types/character'

export function safeTagColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE
}
export function tagStyle(tag: CharacterMaster) {
  const background = safeTagColor(tag.TagColor)
  const rgb = [1, 3, 5].map(start => parseInt(background.slice(start, start + 2), 16))
  return { background, color: 0.299 * rgb[0]! + 0.587 * rgb[1]! + 0.114 * rgb[2]! > 160 ? '#222' : '#fff' }
}
