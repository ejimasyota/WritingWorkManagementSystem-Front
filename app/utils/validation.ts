/* ==========================================================
 * バリデーションチェックユーティリティ
 * ----------------------------------------------------------
 * ・バリエーションチェック処理の共通利用可能な処理を提供する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連
import { nextTick, type Ref } from 'vue'

/* ==========================================================
 * 型定義
 * ========================================================== */
/**
 * 入力コンポーネントの公開メソッド
 */
export interface ValidationFieldHandle {
  // 1. 入力値を取得するメソッド
  getValue: () => string
  // 2. フォーカスを設定するメソッド
  focus: () => void
}

/**
 * Vueのコールバックrefを、公開されたfocusメソッドの有無を確認して登録する。
 * DOM要素・コンポーネントを強制的に同じ型へ変換せず、解除時は参照も破棄する。
 */
export function setFieldHandle(
  handles: Record<string, Pick<ValidationFieldHandle, 'focus'>>,
  key: string,
  instance: unknown,
): void {
  if (instance && typeof instance === 'object' && 'focus' in instance && typeof instance.focus === 'function') {
    const focus = instance.focus;
    handles[key] = { focus: () => { focus.call(instance); } };
  } else {
    delete handles[key];
  }
}

/**
 * 入力チェックルール
 */
export type ValidationRule = (
  // 1. 入力値
  value: string,
  // 2. 入力値の連想配列
  values: Record<string, string>
) => string | null

/**
 * 入力チェック対象
 */
export interface ValidationTarget {
  // 1. 入力項目のキー
  key: string
  // 2. 入力項目の公開メソッド
  field: Readonly<Ref<ValidationFieldHandle | null>>
  // 3. 入力チェックルール
  rules: ValidationRule[]
}

/**
 * エラー情報
 */
export type ValidationErrors = Record<string, string>

/**
 * 入力項目の共通チェック処理
 * @param targets チェック対象項目
 * @param errors  エラー情報
 * @returns 検証成功時は入力値、失敗時はnull
 */
export const validateFields = async (targets: ValidationTarget[], errors: Ref<ValidationErrors>): Promise<Record<string, string> | null> => {
  /* ==========================================================
   * 事前処理
   * ========================================================== */
  // 1. 前回のエラー情報を初期化
  errors.value = {}
  // 2. 入力値を格納する連想配列を初期化
  const values: Record<string, string> = {}

  /* ==========================================================
   * 入力値の取得
   * ========================================================== */
  for (const target of targets) {
    // 1. 入力値を取得して連想配列に格納
    values[target.key] = target.field.value?.getValue() ?? ''
  }

  /* ==========================================================
   * 入力チェック処理
   * ========================================================== */
  /* ------------------------------
   * 1. 事前定義
   * ------------------------------*/
  // 1. 最初にエラーが発生した項目を保持する
  let firstErrorField: ValidationFieldHandle | null = null

  /* ------------------------------
   * 2. チェック対象項目を順番に検証
   * ------------------------------*/
  for (const target of targets) {
    /* 1. 事前処理 */
    // 1. 入力値を取得
    const value = values[target.key] ?? ''

    /* 2. チェック条件を順番に実行 */
    for (const rule of target.rules) {
      /* 2.1. チェックルールを適用 */
      // 1. チェックルールを適用してエラーメッセージを取得
      const message = rule(value, values)

      /* 2.2 エラーが存在する場合 */
      if (message) {
        /* 2.2.1 事前処理 */
        // エラーメッセージを設定
        errors.value[target.key] = message

        /* 2.2.2 最初のエラー項目が存在しない場合 */
        if (!firstErrorField) {
          // 1. 最初のエラー項目を保持
          firstErrorField = target.field.value
        }

        /* 2.2.3 終了時処理 */
        // 1. 処理終了
        break
      }
    }
  }

  /* ==========================================================
   * エラー発生時の処理
   * ========================================================== */
  if (Object.keys(errors.value).length > 0) {
    // 1. エラー表示のDOM更新を待機
    await nextTick()
    // 2. 最初のエラー項目にフォーカス
    firstErrorField?.focus()
    // 3. 処理終了
    return null
  }

  /* ==========================================================
   * 正常終了処理
   * ========================================================== */
  // 1. 入力値を返却
  return values
}
