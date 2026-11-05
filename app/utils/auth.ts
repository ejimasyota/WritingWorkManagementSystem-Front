/* ==========================================================
 * 認証管理共通処理
 * ----------------------------------------------------------
 * ・認証管理に関する共通機能を提供する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. 定数
import { CONST_VARIABLE } from '../config/Const';

/** 
 * URLクエリの参加トークンをsessionStorageへ退避する
 */
export const stashPendingJoinToken = () => {
  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 1. URLクエリパラメータを解析
  const params = new URLSearchParams(window.location.search)
  // 2. 参加トークンを取得
  const token = params.get('token')

  /* ==========================================================
   * トークンが存在しない場合
   * ========================================================== */
  if (!token) {
    // 1. 処理終了
    return
  }

  /* ==========================================================
   * 参加トークンの退避処理
   * ========================================================== */
  // 1. sessionStorageへ参加トークンを退避
  sessionStorage.setItem('PendingJoinToken', token)

  /* ==========================================================
   * URLから参加トークンを削除
   * ========================================================== */
  // 1. クエリパラメータから参加トークンを削除
  params.delete('token')
  // 2. 残りのクエリパラメータを文字列に変換
  const query = params.toString()
  // 3. 参加トークンを除いたURLに置き換え
  window.history.replaceState(window.history.state, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash)
}

/**
 * 認証後の遷移先を取得
 */
export const loginDestination = (
  lastPath: string | null,
  pendingJoin: boolean
): string => {
  /* ==========================================================
   * 参加トークンが存在する、または復帰先が存在しない場合
   * ========================================================== */
  if (pendingJoin || !lastPath) return CONST_VARIABLE.DISPLAY_PATH.MAIN

  /* ==========================================================
   * 復帰先の確認
   * ========================================================== */
  try {
    // 1. URLを解析
    const origin = 'https://auth.local.invalid'
    const requested = new URL(lastPath, origin)

    // 2. 外部URLの場合はメイン画面へ遷移
    if (requested.origin !== origin) return CONST_VARIABLE.DISPLAY_PATH.MAIN

    // 3. パスを取得
    const path = requested.pathname.replace(/\/$/, '')

    // 4. 復帰を許可する画面を判定
    if (path === CONST_VARIABLE.DISPLAY_PATH.MAIN) return CONST_VARIABLE.DISPLAY_PATH.MAIN
    if (path === '/test') return '/test'

  } catch {
    // 不正なURLの場合はメイン画面へ遷移
  }

  /* ==========================================================
   * 復帰先が存在しない場合
   * ========================================================== */
  // 1. メイン画面へ遷移
  return CONST_VARIABLE.DISPLAY_PATH.MAIN
}
