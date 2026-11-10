/** 作品内の一覧行。選択時の更新日時は楽観ロック用に保持する。 */
export interface WorkSettingRow extends Record<string, unknown> {
  UpdateDate: string;
  WorkId?: string;
}
export interface WorkImageRow {
  Screen: string;
  Name: string;
  ImgPath: string;
}
