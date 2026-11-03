import { stashPendingJoinToken } from '../utils/auth'

/** 静的HTMLには個人データを出力せず、ブラウザでの遷移前にPHPセッションを検証する。 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  stashPendingJoinToken()
  const auth = useAuthSession()
  try {
    const session = await auth.checkSession()
    if (!session) {
      if (auth.notice.value) return abortNavigation()
      sessionStorage.setItem('LastPath', to.path)
      return navigateTo('/', { replace: true })
    }
    if (to.meta.requiresAdmin && session.IsAdmin !== true) {
      auth.forbidden()
      return navigateTo('/main', { replace: true })
    }
  } catch (error) {
    // 接続できない場合も保護画面へは進めない。エラーはアプリ共通ダイアログで表示する。
    auth.navigationFailed(error)
    return navigateTo('/', { replace: true })
  }
})
