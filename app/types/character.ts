export type CharacterRow = Record<string, unknown> & {
  CharaId: string | number
  WorkId: string
  CharaName: string
  UpdateDate: string
}

export type CharacterMaster = Record<string, unknown>
export type CharacterMasters = Record<string, CharacterMaster[]>
export type CharacterEntry = Record<string, string>
export interface CharacterImage {
  Path: string
  Data: string | null
  Size: number
  Caption: string
}
export interface EntryColumn {
  key: string
  label: string
  required?: boolean
  maxLength?: number
  multiline?: boolean
}
export interface EntryDefinition {
  key: string
  label: string
  section: string
  columns: EntryColumn[]
  maxRows?: number
  helpMessage?: string
}
export interface CharacterDraft {
  fields: Record<string, string>
  entries: Record<string, CharacterEntry[]>
  skills: Record<string, string[]>
  tags: CharacterMaster[]
  images: CharacterImage[]
}
