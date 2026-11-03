import type { PropType } from "vue";

/**
 *フォームに共通する項目名・入力状態・説明アイコンの表示設定
 */
export const fieldProps = {
  // 1. ラベル
  label: { type: String, default: "" },
  hint: String,
  disabled: Boolean,
  readonly: Boolean,
  required: Boolean,
  // 説明アイコンの表示フラグ。Vueでは info-icon-flg で指定する（省略時はfalse）。
  infoIconFlg: Boolean,
  infoTitle: { type: String, default: "項目説明" },
  infoMessage: { type: String, default: "" },
  error: String,
};

/**
 * メッセージ本文・画像・文字寄せなどのダイアログ共通宣言
 */
export const messageDialogProps = {
  modelValue: Boolean,
  message: { type: String, default: "" },
  imageSrc: String,
  textAlign: {
    type: String as PropType<"left" | "center" | "right">,
    default: "center",
  },
};
