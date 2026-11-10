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
import { useFieldValue } from '../composables/useFieldValue';
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
  wrapperClass: String,
});
const emit = defineEmits<{
  'value-change': [];
  change: [event: Event];
}>();
const id = useId();
const { value, setValue, getValue, updateValue } = useFieldValue<boolean>(false, () => emit('value-change'));
// 親コンポーネントはref経由で値を取得・設定する。
defineExpose({
  setValue,
  getValue,
});
function updateChecked(event: Event) {
  if (props.disabled || props.readonly) return;
  updateValue((event.target as HTMLInputElement).checked);
  emit("change", event);
}
</script>
