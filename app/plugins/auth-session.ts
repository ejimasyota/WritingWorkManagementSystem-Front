import { watch } from 'vue'
import type { ApiResponse } from '../types/backend'
import { createSessionManager, type SessionEvent } from '../utils/sessionManager'
import { requestBackend } from '../utils/backend'

const EVENT_KEY = 'AuthSessionEvent'

/** 静的生成時にもインスタンスは作るが、通信・ブラウザ監視はクライアントでのみ行う。 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const router = useRouter()

  function clearClientState(reason: 'logout' | 'expired' | 'identity') {
    if (import.meta.server) return
    if (reason === 'logout') {
      sessionStorage.clear()
      return
    }
    const pendingJoin = sessionStorage.getItem('PendingJoinToken')
    const lastPath = reason === 'expired'
      ? (router.currentRoute.value.meta.requiresAuth ? router.currentRoute.value.path : sessionStorage.getItem('LastPath') || '/main')
      : sessionStorage.getItem('LastPath')
    sessionStorage.clear()
    if (pendingJoin) sessionStorage.setItem('PendingJoinToken', pendingJoin)
    if (lastPath) sessionStorage.setItem('LastPath', lastPath)
  }

  const authSession = createSessionManager({
    send: <T>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: unknown): Promise<ApiResponse<T>> => {
      return requestBackend<T>(config.public.apiBase, endpoint, method, data)
    },
    navigate: path => nuxtApp.runWithContext(() => navigateTo(path, { replace: true })),
    clearClientState,
    publish: (type) => {
      if (import.meta.server) return
      try {
        // 通知には認証情報を含めない。受信したタブはサーバーへ再確認する。
        localStorage.setItem(EVENT_KEY, JSON.stringify({ type, nonce: `${Date.now()}-${Math.random()}` }))
      } catch {
        // ストレージが利用できない場合も、現在のタブの認証処理は継続できる。
      }
    },
  })

  if (import.meta.client) {
    nuxtApp.hook('app:mounted', () => {
      const route = () => router.currentRoute.value
      const visible = () => document.visibilityState === 'visible'
      const stopWatch = watch(
        () => [route().meta.requiresAuth, authSession.authenticated.value],
        () => {
          if (route().meta.requiresAuth && authSession.authenticated.value) authSession.startMonitoring(visible)
          else authSession.stopMonitoring()
        },
        { immediate: true },
      )

      async function checkOnReturn() {
        if (!visible() || (!route().meta.requiresAuth && !route().meta.guestOnly)) return
        try {
          const session = await authSession.checkSession()
          if (session && route().meta.guestOnly && !authSession.notice.value) {
            await nuxtApp.runWithContext(() => navigateTo('/main', { replace: true }))
          }
        } catch {
          // 復帰時の一時的な通信障害では認証済み扱いへ変更せず、次の操作で再判定する。
        }
      }

      function handlePageShow(event: PageTransitionEvent) {
        if (event.persisted) void checkOnReturn()
      }

      async function handleStorage(event: StorageEvent) {
        if (event.key !== EVENT_KEY || !event.newValue) return
        let type: SessionEvent
        try {
          type = JSON.parse(event.newValue).type
        } catch {
          return
        }
        if (type !== 'signed-in' && type !== 'signed-out') return
        try {
          const session = await authSession.receiveEvent(type)
          if (session && route().meta.guestOnly) {
            await nuxtApp.runWithContext(() => navigateTo('/main', { replace: true }))
          }
        } catch {
          // 別タブの通知だけでは認証を許可しない。次の画面操作でも再確認する。
        }
      }

      window.addEventListener('storage', handleStorage)
      window.addEventListener('pageshow', handlePageShow)
      document.addEventListener('visibilitychange', checkOnReturn)
      window.addEventListener('pointerdown', authSession.markActivity, { passive: true })
      window.addEventListener('keydown', authSession.markActivity)
      window.addEventListener('scroll', authSession.markActivity, { capture: true, passive: true })

      function cleanup() {
        stopWatch()
        authSession.stopMonitoring()
        window.removeEventListener('storage', handleStorage)
        window.removeEventListener('pageshow', handlePageShow)
        document.removeEventListener('visibilitychange', checkOnReturn)
        window.removeEventListener('pointerdown', authSession.markActivity)
        window.removeEventListener('keydown', authSession.markActivity)
        window.removeEventListener('scroll', authSession.markActivity, true)
      }
      nuxtApp.vueApp.onUnmount(cleanup)
      if (import.meta.hot) import.meta.hot.dispose(cleanup)
    })
  }

  return { provide: { authSession } }
})
