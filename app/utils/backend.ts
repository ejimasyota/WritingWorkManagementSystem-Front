import type { ApiResponse } from '../types/backend'

/** HTTPエラーでも、既存APIが返すロック情報・排他制御情報を保持する。 */
export class backendError extends Error {
  handled = false
  status: number
  data: unknown

  constructor(
    message: string,
    status = 0,
    data: unknown = null,
  ) {
    super(message)
    this.name = 'backendError'
    this.status = status
    this.data = data
  }
}

export async function requestBackend<T>(
  baseUrl: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  data?: unknown,
): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' && data !== undefined ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    })
    let result: ApiResponse<T>
    try {
      result = await response.json()
    } catch {
      throw new backendError('APIから正しい応答を取得できませんでした', response.status)
    }

    if (!response.ok) {
      throw new backendError(result.Message || 'APIエラーが発生しました', response.status, result.Data)
    }
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new backendError('リクエストがタイムアウトしました（3分）。時間をおいて再度お試しください')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/** Success:false をHTTP 200で返す既存APIも、呼出元で同じように扱えるようにする。 */
export function requireSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.Success) throw new backendError(response.Message || fallback, 200, response.Data)
  return response.Data
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** 認証切れ等を画面全体ですでに通知した場合、個別画面から重複表示しない。 */
export async function reportBackendError(
  dialogs: { error: (message: string) => Promise<boolean> },
  error: unknown,
  fallback: string,
) {
  if (error instanceof backendError && error.handled) return
  await dialogs.error(errorMessage(error, fallback))
}
