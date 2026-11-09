/** GetWorkInfo.php が返す作品共通情報。設定情報が未登録の場合はnullになる。 */
export interface WorkInfo {
  WorkId: string
  WorkTitle: string
  Genre: number | string
  SettingDate: string | null
  Motif: number | string | null
  Theme: string | null
  Description: string | null
  UpdateDate: string
}

export interface WorkPermission {
  IsCreator: boolean
}
