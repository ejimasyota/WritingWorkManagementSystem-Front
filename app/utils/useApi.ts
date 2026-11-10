import { messageFormat } from './messages';
/* ==========================================================
 * API通信ユーティリティ
 * ----------------------------------------------------------
 * ・共通利用可能なAPI通信処理を提供する
 * ・通信のみを担当し、スピナーは呼出元の操作単位で管理する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連
import { computed } from 'vue';
// 2. 共通型定義
import type { HttpMethod, ResponseType, ResponseData } from '../types/utilType';
// 3. APIエラー・権限判定
import { backendError } from './backend';
import { isPublicEndpoint } from './permissions';

/* ==========================================================
 * 型定義
 * ========================================================== */
// HTTPメソッド・レスポンス形式・レスポンス型は共通のutilTypeに定義する。
interface ApiOptions {
  /** 認証管理内部の送信でのみfalseにし、認証処理の再帰を防ぐ。 */
  authorize?: boolean;
}

/**
 * バックエンドAPIへリクエストを送信する
 * @param endpoint     APIエンドポイント
 * @param method       HTTPメソッド
 * @param data         送信データ
 * @param responseType レスポンス形式
 * @param options      認証管理内部の送信設定
 * @returns APIレスポンス
 */
export const useApi = async <T = unknown, R extends ResponseType = 'json'>(endpoint: string, method: HttpMethod = 'GET', data?: unknown, responseType: R = 'json' as R, options: ApiOptions = {}): Promise<ResponseData<T, R>> => {
  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 非同期処理に入る前にNuxtのコンテキストを取得する。
  const nuxtApp = useNuxtApp();
  // 1. API接続設定
  const config = useRuntimeConfig();

  // 2. リクエストURL
  const url = `${String(config.public.apiBase).replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  /* ==========================================================
   * 事前処理
   * ========================================================== */
  // 1. リクエストボディの有無を判定
  const hasBody = method !== 'GET' && data !== undefined;

  /* ==========================================================
   * API通信処理
   * ========================================================== */

  // 保護APIは権限・セッション失効を共通処理する。
  // 認証管理内の実送信もuseApiを使用し、authorize:falseで再帰を防ぐ。
  if (options.authorize !== false && !isPublicEndpoint(endpoint)) {
    return await nuxtApp.$authSession.request<T, R>(endpoint, method, data, responseType);
  }

  // 通信のタイムアウトを3分に統一する。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    /* ------------------------------
     * 1. APIリクエストを実行
     * ------------------------------*/
    const response = await fetch(url, {
      method,
      credentials: 'include',
      signal: controller.signal,
      ...(hasBody ? {
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      } : {})
    });

    /* ------------------------------
     * 2. HTTPエラーの場合
     * ------------------------------*/
    if (!response.ok) {
      // HTTPエラーでも、APIのロック情報・排他エラー等の詳細を保持する。
      let failure: {
        Message?: string;
        Data?: unknown;
      } | null;
      try {
        failure = await response.json();
      } catch {
        throw new backendError(messageFormat('ERROR', 'E_0047'), response.status);
      }
      // 1. 例外をスロー
      throw new backendError(failure?.Message || messageFormat('ERROR', 'E_0048', response.status), response.status, failure?.Data);
    }

    /* ------------------------------
     * 3. 事前定義
     * ------------------------------*/
    // 1. 指定された形式でレスポンスを取得
    let result: unknown;

    /* ------------------------------
     * 4. レスポンス取得処理
     * ------------------------------*/
    switch (responseType) {
      /* 1. レスポンス形式がtextの場合 */
      case 'text':
        // 1. レスポンスを文字列として取得
        result = await response.text();
        // 2. 処理終了
        break;

      /* 2. レスポンス形式がblobの場合 */
      case 'blob':
        // 1. レスポンスをBlobとして取得
        result = await response.blob();
        // 2. 処理終了
        break;

      /* 3. レスポンス形式がarrayBufferの場合 */
      case 'arrayBuffer':
        // 1. レスポンスをArrayBufferとして取得
        result = await response.arrayBuffer();
        // 2. 処理終了
        break;

      /* 4. その他 */
      default:
        // 1. レスポンスをJSONとして取得
        try {
          result = await response.json();
        } catch {
          throw new backendError(messageFormat('ERROR', 'E_0047'), response.status);
        }
        // 2. 処理終了
        break;
    }

    /* ------------------------------
     * 5. 戻り値返却
     * ------------------------------*/
    // 1. レスポンスを返却
    return result as ResponseData<T, R>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new backendError(messageFormat('ERROR', 'E_0049'));
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * 操作スピナーの表示状態を取得する
 */
export const useBackendBusy = () => {
  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 1. 実行中の画面操作数
  const operations = useState<number>('BackendOperations', () => 0);

  // 2. 通信中フラグ
  const busy = computed(() => operations.value > 0);

  /* ==========================================================
   * 戻り値返却
   * ========================================================== */
  return {
    // 2. 通信中フラグ
    busy
  };
};
