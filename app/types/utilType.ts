/* ==========================================================
 * 共通型定義
 * ----------------------------------------------------------
 * ・共通利用可能な型定義を提供する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/**
 * 共通のAPIレスポンス型定義
 */
export interface ApiResponse<T = unknown> {
    // 1. 結果FLG
    Success: boolean
    // 2. メッセージ
    Message: string
    // 3. データ
    Data: T
}

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
    R extends 'arrayBuffer' ? ArrayBuffer : T

/** useApiと認証制御で共用する通信の型。Tはレスポンス全体の型を指定する。 */
export type ApiTransport = <T = unknown, R extends ResponseType = 'json'>(
    endpoint: string,
    method?: HttpMethod,
    data?: unknown,
    responseType?: R,
) => Promise<ResponseData<T, R>>

/**
 * セレクトボックス・ラジオボタンに渡す選択肢
 */
export interface SelectOption {
    // 1. ラベル
    label: string
    // 2. 値
    value: string | number
    // 3. 画面の表示値
    disabled?: boolean
}
