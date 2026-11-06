/** 既存 Response.php のJSON形式。プロパティ名の大文字・小文字も維持する。 */
export interface ApiResponse<T = unknown> {
  Success: boolean
  Message: string
  Data: T
}

export interface SessionInfo {
  UserId: string
  IsAdmin: boolean
}

export interface Project extends Record<string, unknown> {
  WorkId: string
  WorkTitle: string
  Genre: number
  RegistUser: string
  RegistDate: string
  UpdateUser: string
  UpdateDate: string
  IsCreator: boolean
  CreaterUpdateDate: string
}

export interface DownloadData {
  FileData: string
  FileName: string
  MimeType: string
}

export type BackendRequest = <T = unknown>(
  endpoint: string,
  method?: 'GET' | 'POST',
  data?: unknown,
) => Promise<ApiResponse<T>>
