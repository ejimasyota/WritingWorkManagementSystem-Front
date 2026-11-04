/* ==========================================================
 * API通信ユーティリティ
 * ----------------------------------------------------------
 * ・共通利用可能なAPI通信処理を提供する
 * ・API通信中の状態を自動管理する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連
import { computed } from 'vue'

/* ==========================================================
 * 型定義
 * ========================================================== */
/**
 * HTTPメソッド
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * レスポンス形式
 */
export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer'

/**
 * レスポンス型
 */
export type ResponseData<T, R extends ResponseType> =
  R extends 'text' ? string :
  R extends 'blob' ? Blob :
  R extends 'arrayBuffer' ? ArrayBuffer :
  T

/**
 * バックエンドAPIへリクエストを送信する
 * @param endpoint     APIエンドポイント
 * @param method       HTTPメソッド
 * @param data         送信データ
 * @param responseType レスポンス形式
 * @returns APIレスポンス
 */
export const useApi = async <
  T = unknown,
  R extends ResponseType = 'json'
>(
  endpoint: string,
  method: HttpMethod = 'GET',
  data?: unknown,
  responseType: R = 'json' as R
): Promise<ResponseData<T, R>> => {
  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 1. API接続設定
  const config = useRuntimeConfig()

  // 2. リクエストURL
  const url = `${String(config.public.apiBase).replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`

  // 3. API通信状態
  const { requests } = useBackendBusy()

  /* ==========================================================
   * 事前処理
   * ========================================================== */
  // 1. リクエストボディの有無を判定
  const hasBody = method !== 'GET' && data !== undefined
  // 2. 通信中リクエスト数を加算
  requests.value++

  /* ==========================================================
   * API通信処理
   * ========================================================== */
  try {
    /* ------------------------------
     * 1. APIリクエストを実行
     * ------------------------------*/
    const response = await fetch(url, {
      method,
      credentials: 'include',
      ...(hasBody ? {
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      } : {})
    })

    /* ------------------------------
     * 2. HTTPエラーの場合
     * ------------------------------*/
    if (!response.ok) {
      // 1. 例外をスロー
      throw new Error(`API通信に失敗しました。HTTPステータス：${response.status}`)
    }

    /* ------------------------------
     * 3. 事前定義
     * ------------------------------*/
    // 1. 指定された形式でレスポンスを取得
    let result: unknown

    /* ------------------------------
     * 4. レスポンス取得処理
     * ------------------------------*/
    switch (responseType) {
      /* 1. レスポンス形式がtextの場合 */
      case 'text':
        // 1. レスポンスを文字列として取得
        result = await response.text()
        // 2. 処理終了
        break

      /* 2. レスポンス形式がblobの場合 */
      case 'blob':
        // 1. レスポンスをBlobとして取得
        result = await response.blob()
        // 2. 処理終了
        break

      /* 3. レスポンス形式がarrayBufferの場合 */
      case 'arrayBuffer':
        // 1. レスポンスをArrayBufferとして取得
        result = await response.arrayBuffer()
        // 2. 処理終了
        break

      /* 4. その他 */
      default:
        // 1. レスポンスをJSONとして取得
        result = await response.json()
        // 2. 処理終了
        break
    }

    /* ------------------------------
     * 5. 戻り値返却
     * ------------------------------*/
    // 1. レスポンスを返却
    return result as ResponseData<T, R>

  } finally {
    /* ==========================================================
     * 終了処理
     * ========================================================== */
    // 1. 通信中リクエスト数を減算
    requests.value--
  }
}

/**
 * API通信状態を管理する
 */
export const useBackendBusy = () => {
  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 1. 実行中のリクエスト数
  const requests = useState<number>('BackendRequests', () => 0)

  // 2. 通信中フラグ
  const busy = computed(() => requests.value > 0)

  /* ==========================================================
   * 戻り値返却
   * ========================================================== */
  return {
    // 1. 実行中のリクエスト数
    requests,
    // 2. 通信中フラグ
    busy
  }
}