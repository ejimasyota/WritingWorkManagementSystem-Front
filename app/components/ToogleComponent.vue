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
    <label :class="wrapperClass">
      <slot />
      <span class="ToggleSwitchControl">
        <input
          :id="id"
          type="checkbox"
          role="switch"
          :checked="value"
          :disabled="disabled || readonly"
          v-bind="$attrs"
          @change="updateChecked"
        />
        <span class="ToggleSwitchSlider" />
      </span>
    </label>
  </FieldFrame>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */

import { fieldProps } from "../composables/componentProps";
import { useId } from "vue";
defineOptions({
  inheritAttrs: false,
});
const props = defineProps({
  ...fieldProps,
  modelValue: Boolean,
  wrapperClass: String,
});
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [event: Event];
}>();
const id = useId();
const { value, setValue, getValue } = useFieldValue<boolean>(
  props,
  emit,
  false,
);
// 親コンポーネントは ref 経由でも値を取得・設定できる。
defineExpose({
  setValue,
  getValue,
});
function updateChecked(event: Event) {
  if (props.disabled || props.readonly) return;
  setValue((event.target as HTMLInputElement).checked);
  emit("change", event);
}
</script>
