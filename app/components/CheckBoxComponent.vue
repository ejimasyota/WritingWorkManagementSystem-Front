<template>
  <FieldFrame
    :inline="inline"
    :label="label"
    :input-id="id"
    :required="required"
    :info-icon-flg="infoIconFlg"
    :info-title="infoTitle"
    :info-message="infoMessage"
    :error="error"
    :hint="hint"
  >
    <label class="CheckboxWrapper" :class="wrapperClass">
      <input
        ref="input"
        :id="id"
        type="checkbox"
        :class="{ CheckboxInput: !inline, HasError: error }"
        :checked="checked"
        :value="optionValue"
        :indeterminate="indeterminate"
        :disabled="disabled || readonly"
        :required="required"
        v-bind="$attrs"
        @change="updateChecked"
      >
      <slot />
    </label>
  </FieldFrame>
</template>

<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. vue関連
import { computed, ref, useId, type PropType } from 'vue';
// 2. フォーム共通定義
import { fieldProps } from '../composables/componentProps';

/* ==========================================================
 * 属性定義
 * ========================================================== */
defineOptions({
  // 1. 親からの属性を引き継がない
  inheritAttrs: false
});

/* ==========================================================
 * 型定義
 * ========================================================== */
/** 単独の選択状態と、複数選択時の選択値の配列。 */
type CheckedValue = boolean | (string | number)[];

/* ==========================================================
 * props定義
 * ========================================================== */
const props = defineProps({
  // 1. フォーム共通定義
  ...fieldProps,
  // 2. 値
  modelValue: { type: [Boolean, Array] as PropType<CheckedValue>, default: false },
  // 3. 複数選択時にこの項目が表す値
  optionValue: [String, Number],
  // 4. 入力要素ID（省略時は自動生成）
  inputId: String,
  // 5. 既存レイアウトへ配置するラベルのクラス
  wrapperClass: String,
  // 6. 一部の項目だけが選択されている状態
  indeterminate: Boolean
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits<{
  // 1. 入力値
  'update:modelValue': [value: CheckedValue];
  // 2. 既存の選択処理へネイティブイベントを渡す
  change: [event: Event];
}>();

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 一意のIDを生成
const generatedId = useId();
const id = computed(() => props.inputId || generatedId);
// 2. 共通処理群を取得
const { value, setValue, getValue } = useFieldValue<CheckedValue>(props, emit, false);

// 3. 入力要素
const input = ref<HTMLInputElement>();

/** 単独の真偽値・配列の選択値からチェック状態を取得する。 */
const checked = computed(() => Array.isArray(value.value)
  ? props.optionValue !== undefined && value.value.includes(props.optionValue)
  : value.value);

/* ==========================================================
 * 公開メソッド
 * ========================================================== */
defineExpose({
  // 1. セット処理
  setValue,
  // 2. 取得処理
  getValue,
  // 3. フォーカス設定
  focus
});

/**
 * 入力時処理
 * @param event イベント
 */
function updateChecked(event: Event) {
  // 非活性・読み取り専用では更新しない。
  if (props.disabled || props.readonly) return;

  // 1. 入力内容のセット
  const nextChecked = (event.target as HTMLInputElement).checked;
  if (Array.isArray(value.value)) {
    // 複数選択は重複を除いて更新し、選択値の型を維持する。
    if (props.optionValue === undefined) return;
    const current = value.value.filter(item => item !== props.optionValue);
    setValue(nextChecked ? [...current, props.optionValue] : current);
  } else {
    setValue(nextChecked);
  }

  // 2. 親画面へ変更イベントを通知
  emit('change', event);
}
/** 入力欄へフォーカスを設定する。 */
function focus() {
  input.value?.focus();
}
</script>
