/* ==========================================================
 * 汎用チェック処理
 * ----------------------------------------------------------
 * ・共通利用可能なチェック処理を提供する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連
import type { ValidationRule } from './validation'

/**
 * 必須入力チェック
 */
export const required = (message: string): ValidationRule => {
  return (value) => {
    // 1. 入力値が空白でない場合はNULLを返却、空白の場合はエラーメッセージを返却
    return value.trim() ? null : message
  }
}

/**
 * 最大文字数チェック
 */
export const maxLength = (limit: number, message: string): ValidationRule => {
  return (value) => {
    // 1. 入力値の文字数が制限以内の場合はNULLを返却、超過の場合はエラーメッセージを返却
    return value.length <= limit ? null : message
  }
}

/**
 * 最小文字数チェック
 */
export const minLength = (limit: number, message: string): ValidationRule => {
  return (value) => {
    /* ------------------------------
     * 1. 入力値が存在しない場合
     * ------------------------------*/
    if (!value) {
      // 1. NULLを返却
      return null
    }

    /* ------------------------------
     * 2. 戻り値返却
     * ------------------------------*/
    // 1. 入力値の文字数が制限以上の場合はNULLを返却、未満の場合はエラーメッセージを返却
    return value.length >= limit ? null : message
  }
}

/**
 * 入力項目間の一致チェック
 */
export const matches = (otherKey: string, message: string): ValidationRule => {
  return (value, values) => {
    // 1. 入力値が一致する場合はNULLを返却、一致しない場合はエラーメッセージを返却
    return value === values[otherKey] ? null : message
  }
}

/**
 * 指定項目と異なる値であることを確認する
 * @param otherKey 比較対象項目
 * @param message エラーメッセージ
 */
export const notMatches = (
  otherKey: string,
  message: string
): ValidationRule => {
  return (value, values) => {
    // 1. 入力値が一致しない場合はNULLを返却、一致する場合はエラーメッセージを返却
    return value !== values[otherKey] ? null : message
  }
}

/**
 * 数値が含まれているか確認する
 * @param message エラーメッセージ
 */
export const containsNumber = (
  message: string
): ValidationRule => {
  return (value) => {
    // 1. 数値が含まれていない場合はエラー
    return /[0-9]/.test(value) ? null : message
  }
}
