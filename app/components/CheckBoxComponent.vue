<script setup lang="ts">
import { fieldProps } from '../composables/componentProps';
import { useId } from 'vue';
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  modelValue: Boolean
});
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
const id = useId();
const {
  value,
  setValue,
  getValue
} = useFieldValue<boolean>(props, emit, false);
// 親コンポーネントは ref 経由でも値を取得・設定できる。
defineExpose({
  setValue,
  getValue
});
function updateChecked(event: Event) {
  setValue((event.target as HTMLInputElement).checked);
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
