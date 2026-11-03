export interface Credentials {
  userId: string
  password: string
  confirmPassword?: string
}

/** 旧 Index.js / Registration.js の入力チェック・メッセージを共用する。 */
export function validateCredentials(values: Credentials, registration = false) {
  const errors: Record<string, string> = {}
  const valid = (value: string) => value.trim().length >= 8 && /[0-9]/.test(value)

  if (!valid(values.userId)) {
    errors.userId = 'ユーザーIDは数値を含む8桁以上で入力してください'
  }
  if (!valid(values.password) || values.password === values.userId) {
    errors.password = 'パスワードはユーザーIDと異なる数値を含む8桁以上で入力してください'
  }
  if (registration && (!values.confirmPassword?.trim() || values.confirmPassword !== values.password)) {
    errors.confirmPassword = '入力されたパスワードが一致しません'
  }
  return errors
}

/** 認証前に参加トークンを退避し、URLから除去する（旧 StashPendingJoinToken）。 */
export function stashPendingJoinToken() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) return
  sessionStorage.setItem('PendingJoinToken', token)
  params.delete('token')
  const query = params.toString()
  window.history.replaceState(window.history.state, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
}

/** 認証後の復帰先は、実装済みの画面と設定済みの作品画面に限定する。 */
export function loginDestination(
  lastPath: string | null,
  pendingJoin: boolean,
  legacyWorkPath = '/Front/Html/WorkManagement.html',
) {
  if (pendingJoin || !lastPath) return '/main'
  try {
    const origin = 'https://auth.local.invalid'
    const requested = new URL(lastPath, origin)
    if (requested.origin !== origin) return '/main'
    const path = requested.pathname.replace(/\/$/, '')
    if (path === '/main' || path === '/Front/Html/Main.html') return '/main'
    if (path === '/test') return '/test'
    const legacy = new URL(legacyWorkPath, origin)
    if (legacy.origin === origin && path === legacy.pathname) return legacy.pathname
  } catch {
    // 不正なURLや未知の画面では、必ず作品一覧へ戻す。
  }
  return '/main'
}
