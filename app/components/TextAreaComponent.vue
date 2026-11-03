<script setup lang="ts">
import { fieldProps } from '../composables/componentProps';
import { useId } from 'vue';
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  modelValue: String,
  rows: Number
});
const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
const id = useId();
const {
  value,
  setValue,
  getValue
} = useFieldValue<string>(props, emit, '');
// 親コンポーネントは ref 経由でも値を取得・設定できる。
defineExpose({
  setValue,
  getValue
});
function updateInput(event: Event) {
  setValue((event.target as HTMLTextAreaElement).value);
}
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
    <textarea
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
