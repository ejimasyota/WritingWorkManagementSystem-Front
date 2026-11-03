<script setup lang="ts">
import type { PropType } from 'vue';
import type { SelectOption } from '../types/components';
import { fieldProps } from '../composables/componentProps';
import { useId } from 'vue';
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  modelValue: [String, Number],
  options: {
    type: Array as PropType<SelectOption[]>,
    default: () => []
  }
});
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();
const id = useId();
const {
  value,
  setValue,
  getValue
} = useFieldValue<string | number>(props, emit, '');
// 親コンポーネントは ref 経由でも値を取得・設定できる。
defineExpose({
  setValue,
  getValue
});
</script>
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
    <div class="ChoiceGroup">
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
