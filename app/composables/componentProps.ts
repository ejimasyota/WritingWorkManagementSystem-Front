import { messageFormat } from '../utils/messages';
import type { PropType } from "vue";

/**
 *フォームに共通する項目名・入力状態・説明アイコンの表示設定
 */
export const fieldProps = {
  // 1. ラベル
  label: { type: String, default: "" },
  // 表セルや既存ラベル内では、外側の余白・見出しを追加しない。
  inline: Boolean,
  hint: String,
  disabled: Boolean,
  readonly: Boolean,
  required: Boolean,
  // 説明アイコンの表示フラグ。Vueでは info-icon-flg で指定する（省略時はfalse）。
  infoIconFlg: Boolean,
  infoTitle: { type: String, default: () => messageFormat('INFO', 'I_0056') },
  infoMessage: { type: String, default: "" },
  error: String,
};

/**
 * メッセージ表示系ダイアログの共通宣言
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
