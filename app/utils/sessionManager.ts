import { messageFormat } from './messages';
import { computed, readonly, ref, shallowRef } from 'vue'
import type { SessionInfo } from '../types/backend'
import type { ApiResponse, ApiTransport, HttpMethod, ResponseType } from '../types/utilType'
import { backendError, errorMessage, requireSuccess } from './backend'
import { isPublicEndpoint, requiresAdmin } from './permissions'
// 2. 定数関連
import { CONST_VARIABLE } from '../config/Const';

export type SessionEvent = 'signed-in' | 'signed-out'
export interface SessionNotice {
  kind: 'expired' | 'signed-out' | 'work-access-lost' | 'unavailable' | 'forbidden'
  title: string
  message: string
  target: string
}

interface Dependencies {
  send: ApiTransport
  navigate: (path: string) => unknown | Promise<unknown>
  clearClientState: (reason: 'logout' | 'expired' | 'identity') => void
  publish: (event: SessionEvent) => void
}

/**
 * PHPセッションを正とする、Nuxtアプリごとの認証状態。
 * パスワード・セッションID・権限をlocalStorageへ保存しない。
 * APIと時計を画面から切り離し、認証の競合・失効処理を同じ経路で扱う。
 */
export function createSessionManager(dependencies: Dependencies) {
  const user = shallowRef<SessionInfo | null>(null)
  const checking = ref(false)
  const loggingOut = ref(false)
  const notice = shallowRef<SessionNotice | null>(null)
  const identityVersion = ref(0)
  const workAccessVersion = ref(0)
  const authenticated = computed(() => user.value !== null && !loggingOut.value)
  const isAdmin = computed(() => authenticated.value && user.value?.IsAdmin === true)

  // ログアウト後に古い取得結果が戻っても、認証状態を復元させない。
  let generation = 0
  let checkInFlight: Promise<SessionInfo | null> | null = null
  let logoutInFlight: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let activity = 0
  let checkedActivity = 0

  function stopMonitoring() {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  function invalidate() {
    generation += 1
    checkInFlight = null
    checking.value = false
    user.value = null
    identityVersion.value += 1
    stopMonitoring()
  }

  function showNotice(value: SessionNotice) {
    // 同時に複数APIが401を返しても、失効通知を一つだけ表示する。
    if (notice.value?.kind === 'expired' || notice.value?.kind === 'signed-out') return
    notice.value = value
  }

  function expire() {
    const hadSession = user.value !== null
    invalidate()
    if (hadSession) {
      dependencies.clearClientState('expired')
      showNotice({
        kind: 'expired', title: messageFormat('INFO', 'I_0043'),
        message: messageFormat('INFO', 'I_0046'), target: CONST_VARIABLE.DISPLAY_PATH.LOGIN,
      })
    }
  }

  function handleWorkAccessLost(error: backendError) {
    error.handled = true
    workAccessVersion.value += 1
    showNotice({ kind: 'work-access-lost', title: messageFormat('ERROR', 'E_0034'), message: error.message, target: '/main' })
  }

  function isWorkAccessLost(error: unknown): error is backendError {
    return error instanceof backendError && error.status === 403
      && (error.data as { Code?: string } | null)?.Code === 'WORK_ACCESS_LOST'
  }

  /** 同時のルートガード・復帰確認は、一つのGetSessionInfoリクエストにまとめる。 */
  function checkSession(): Promise<SessionInfo | null> {
    if (loggingOut.value) return Promise.resolve(null)
    if (checkInFlight) return checkInFlight

    const started = generation
    const activityAtStart = activity
    checking.value = true
    const job = (async () => {
      try {
        let response
        try {
          response = await dependencies.send<ApiResponse<SessionInfo>>('/GetSessionInfo.php')
        } catch (error) {
          if (started !== generation) return null
          if (!isWorkAccessLost(error)) throw error
          handleWorkAccessLost(error)
          // Auth.phpが作品選択を解除した後、認証確認(GET)だけを一度再実行する。
          response = await dependencies.send<ApiResponse<SessionInfo>>('/GetSessionInfo.php')
        }
        if (started !== generation) return null
        const data = requireSuccess(response, messageFormat('ERROR', 'E_0003', 'セッション情報の取得'))
        if (!data || typeof data.UserId !== 'string' || !data.UserId || typeof data.IsAdmin !== 'boolean') {
          throw new backendError(messageFormat('ERROR', 'E_0041'), 502)
        }
        const previous = user.value
        const changed = previous && (previous.UserId !== data.UserId || previous.IsAdmin !== data.IsAdmin)
        if (changed) {
          generation += 1
          identityVersion.value += 1
          if (previous.UserId !== data.UserId) dependencies.clearClientState('identity')
        }
        user.value = { UserId: data.UserId, IsAdmin: data.IsAdmin }
        checkedActivity = activityAtStart
        return user.value
      } catch (error) {
        if (started !== generation) return null
        if (error instanceof backendError && error.status === 401) {
          error.handled = true
          expire()
          return null
        }
        // 通信障害や500を「ログアウト成功」「権限あり」として扱わない。
        throw error
      }
    })()
    checkInFlight = job
    void job.finally(() => {
      if (checkInFlight === job) {
        checkInFlight = null
        checking.value = false
      }
    }).catch(() => { })
    return job
  }

  /** 保護APIの401を統一処理し、通常の403・排他エラー等は画面へ返す。 */
  const request: ApiTransport = async <T, R extends ResponseType = 'json'>(endpoint: string, method: HttpMethod = 'GET', data?: unknown, responseType: R = 'json' as R) => {
    const started = generation
    const publicEndpoint = isPublicEndpoint(endpoint)
    if (!publicEndpoint && !authenticated.value) {
      const error = new backendError(messageFormat('ERROR', 'E_0042'), 401)
      error.handled = true
      throw error
    }
    if (requiresAdmin(endpoint) && !isAdmin.value) {
      throw new backendError(messageFormat('ERROR', 'E_0043'), 403)
    }
    try {
      const response = await dependencies.send<T, R>(endpoint, method, data, responseType)
      if (!publicEndpoint && started !== generation) {
        const stale = new backendError(messageFormat('ERROR', 'E_0035'), 401)
        stale.handled = true
        throw stale
      }
      return response
    } catch (error) {
      if (!publicEndpoint && error instanceof backendError && !error.handled) {
        if (started !== generation) {
          error.handled = true
        } else if (error.status === 401) {
          error.handled = true
          expire()
        } else if (isWorkAccessLost(error)) {
          handleWorkAccessLost(error)
        }
      }
      throw error
    }
  }

  /** Login.phpの成功フラグだけでは権限を決めず、認証済みAPIで確認し直す。 */
  async function establishSession() {
    dependencies.clearClientState('identity')
    invalidate()
    notice.value = null
    const session = await checkSession()
    if (!session) throw new backendError(messageFormat('ERROR', 'E_0044'), 401)
    dependencies.publish('signed-in')
    return session
  }

  /** サーバーのセッション破棄が成功した場合だけ、ログアウト完了とする。 */
  function logout(): Promise<void> {
    if (logoutInFlight) return logoutInFlight
    stopMonitoring()
    generation += 1
    checkInFlight = null
    checking.value = false
    loggingOut.value = true
    const job = (async () => {
      try {
        try {
          requireSuccess(await dependencies.send<ApiResponse<null>>('/Logout.php', 'POST'), messageFormat('ERROR', 'E_0003', 'ログアウト'))
        } catch (error) {
          // 既にサーバー側が失効している場合も、ローカル状態を破棄できる。
          if (!(error instanceof backendError && error.status === 401)) throw error
        }
        invalidate()
        notice.value = null
        dependencies.clearClientState('logout')
        dependencies.publish('signed-out')
        await dependencies.navigate(CONST_VARIABLE.DISPLAY_PATH.LOGIN)
      } finally {
        loggingOut.value = false
        logoutInFlight = null
      }
    })()
    logoutInFlight = job
    return job
  }

  async function completeNotice() {
    const completed = notice.value
    notice.value = null
    if (completed) await dependencies.navigate(completed.target)
  }

  function navigationFailed(error: unknown) {
    showNotice({ kind: 'unavailable', title: messageFormat('ERROR', 'E_0034'), message: errorMessage(error, messageFormat('ERROR', 'E_0045')), target: CONST_VARIABLE.DISPLAY_PATH.LOGIN })
  }

  function forbidden() {
    showNotice({ kind: 'forbidden', title: messageFormat('ERROR', 'E_0034'), message: messageFormat('ERROR', 'E_0036'), target: '/main' })
  }

  /** 別タブの状態は信頼せず、ログイン通知ではサーバーへ再確認する。 */
  async function receiveEvent(event: SessionEvent) {
    if (event === 'signed-out') {
      const hadSession = user.value !== null
      invalidate()
      dependencies.clearClientState('logout')
      if (hadSession) showNotice({ kind: 'signed-out', title: messageFormat('INFO', 'I_0045'), message: messageFormat('INFO', 'I_0047'), target: CONST_VARIABLE.DISPLAY_PATH.LOGIN })
      return null
    }
    invalidate()
    notice.value = null
    return await checkSession()
  }

  function markActivity() {
    activity += 1
  }

  /** 無操作中は通信しない。GetSessionInfo自身による無操作期限の延長を避ける。 */
  async function checkAfterActivity() {
    if (!authenticated.value || activity === checkedActivity) return
    await checkSession()
  }

  function startMonitoring(isVisible: () => boolean = () => true) {
    if (timer || !authenticated.value) return
    timer = setInterval(() => {
      if (isVisible()) void checkAfterActivity().catch(() => { })
    }, 60_000)
  }

  return {
    user: readonly(user), checking: readonly(checking), loggingOut: readonly(loggingOut),
    notice: readonly(notice), identityVersion: readonly(identityVersion), workAccessVersion: readonly(workAccessVersion),
    authenticated, isAdmin, checkSession, request, establishSession, logout,
    completeNotice, navigationFailed, forbidden, receiveEvent,
    markActivity, checkAfterActivity, startMonitoring, stopMonitoring,
  }
}

export type SessionManager = ReturnType<typeof createSessionManager>
