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
    <div class="ChoiceGroup" v-bind="$attrs">
      <label v-for="(option, i) in options" :key="option.value" class="CheckboxWrapper">
        <input
          :id="i === 0 ? id : id + i"
          type="radio"
          :name="id"
          :value="option.value"
          :checked="value === option.value"
          :disabled="disabled || readonly || option.disabled"
          :required="required"
          @change="setValue(option.value)"
        >
        {{ option.label }}
      </label>
    </div>
  </FieldFrame>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連（型）
import type { PropType } from 'vue';
// 2. 共通型定義
import type { SelectOption } from '../types/utilType';
// 3. フォーム共通定義
import { fieldProps } from '../composables/componentProps';
// 4. Vue関連
import { useId } from 'vue';

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
  modelValue: [String, Number],
  // 3. 項目
  options: {
    type: Array as PropType<SelectOption[]>,
    default: () => []
  }
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits<{
  // 1. 選択値
  'update:modelValue': [value: string | number];
}>();

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 一意のIDを生成
const id = useId();
// 2. 共通処理群を取得
const { value, setValue, getValue } = useFieldValue<string | number>(props, emit, '');

/* ==========================================================
 * 公開メソッド
 * ========================================================== */
defineExpose({
  // 1. セット処理
  setValue,
  // 2. 取得処理
  getValue
});
</script>
