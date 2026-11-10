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
    <textarea
      ref="inputElement"
      :id="id"
      class="TextAreaForm"
      :class="{ HasError: error }"
      :value="value"
      :rows="rows"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :aria-invalid="!!error"
      v-bind="$attrs"
      @input="updateInput"
    />
  </FieldFrame>
</template>

<script setup lang="ts">
import { useFieldValue } from '../composables/useFieldValue';
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. vue関連
import { ref, useId } from 'vue';
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
  // 3. 行数
  rows: Number
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits<{
  // 1. 入力値
  'value-change': [];
}>();

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 一意のIDを生成
const id = useId();
const inputElement = ref<HTMLTextAreaElement>();
function focus() { inputElement.value?.focus(); }
// 2. 共通処理群を取得
const { value, setValue, getValue, updateValue } = useFieldValue<string>('', () => emit('value-change'));

/* ==========================================================
 * 公開メソッド
 * ========================================================== */
defineExpose({
  focus,
  // 1. セット処理
  setValue,
  // 2. 取得処理
  getValue
});

/**
 * 入力時処理
 * @param event イベント
 */
function updateInput(event: Event) {
  // 1. 入力内容のセット
  updateValue((event.target as HTMLTextAreaElement).value);
}
</script>
