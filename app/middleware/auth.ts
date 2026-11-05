/* ==========================================================
 * 認証ミドルウェア
 * ----------------------------------------------------------
 * ・未ログイン状態や権限のない画面へのアクセスなどを制御するミドル
 *   ウェア
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. 認証管理
import { stashPendingJoinToken } from '../utils/auth'
// 2. 定数管理
import { CONST_VARIABLE } from '~/config/Const'

/**
 * アクセスを制御ミドルウェア
 */
export default defineNuxtRouteMiddleware(async (to) => {
  /* ------------------------------
   * 1. サーバ側処理の場合
   * ------------------------------*/
  if (import.meta.server) {
    // 1. 処理終了
    return
  }

  /* ------------------------------
   * 2. 認証管理
   * ------------------------------*/
  // 1. 参加トークンの退避
  stashPendingJoinToken()
  // 2. 認証セッションの取得
  const auth = useAuthSession()

  /* ------------------------------
   * 3. リダイレクト処理
   * ------------------------------*/
  try {
    /* 1. 事前処理 */
    // 1. セッション情報を取得
    const session = await auth.checkSession()

    /* 2. セッション情報が存在しない場合 */
    if (!session) {
      /* 2.1. 通知が存在する場合 */
      if (auth.notice.value) {
        // 1. ナビゲーションを停止
        return abortNavigation()
      }

      /* 2.2. 終了時処理 */
      // 1. ログアウト時のパスをセッションに保持
      sessionStorage.setItem(CONST_VARIABLE.SESSION_KEY.LAST_PATH, to.path)
      // 2. エラー画面へリダイレクト
      return navigateTo(CONST_VARIABLE.DISPLAY_PATH.ERROR, { replace: true })
    }

    /* 3. 管理者権限の必要な画面かつ、ログイン者が管理者権限を有していない場合 */
    if (to.meta.requiresAdmin && session.IsAdmin !== true) {
      // 1. 権限エラーを表示
      auth.forbidden()
      // 2. メイン画面へリダイレクト
      return navigateTo(CONST_VARIABLE.DISPLAY_PATH.MAIN, { replace: true })
    }

    /* ------------------------------
     * 4. 例外処理
     * ------------------------------*/
  } catch (error) {
    // 1. 認証エラーを表示
    auth.navigationFailed(error)
    // 2. エラー画面へリダイレクト
    return navigateTo(CONST_VARIABLE.DISPLAY_PATH.ERROR, { replace: true })
  }
})
