<template>
  <FieldFrame
    :label="label"
    :input-id="id"
    :required="required"
    :info-icon-flg="infoIconFlg"
    :info-title="infoTitle"
    :info-message="infoMessage"
    :error="error"
  >
    <label class="CheckboxWrapper">
      <input
        :id="id"
        type="checkbox"
        class="CheckboxInput"
        :class="{ HasError: error }"
        :checked="value"
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
import { useId } from 'vue';
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
 * props定義
 * ========================================================== */
const props = defineProps({
  // 1. フォーム共通定義
  ...fieldProps,
  // 2. 値
  modelValue: Boolean
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits<{
  // 1. 入力値
  'update:modelValue': [value: boolean];
}>();

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 一意のIDを生成
const id = useId();
// 2. 共通処理群を取得
const { value, setValue, getValue } = useFieldValue<boolean>(props, emit, false);

/* ==========================================================
 * 公開メソッド
 * ========================================================== */
defineExpose({
  // 1. セット処理
  setValue,
  // 2. 取得処理
  getValue
});

/**
 * 入力時処理
 * @param event イベント
 */
function updateChecked(event: Event) {
  // 1. 入力内容のセット
  setValue((event.target as HTMLInputElement).checked);
}
</script>

