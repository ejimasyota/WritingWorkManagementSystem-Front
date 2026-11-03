import { stashPendingJoinToken } from '../utils/auth'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return
  stashPendingJoinToken()
  const auth = useAuthSession()
  if (auth.loggingOut.value || auth.notice.value) return
  try {
    const session = await auth.checkSession()
    if (session && !auth.notice.value) return navigateTo('/main', { replace: true })
  } catch {
    // 未ログイン向けのページは、API障害時も入力・再試行できるよう表示する。
  }
})
