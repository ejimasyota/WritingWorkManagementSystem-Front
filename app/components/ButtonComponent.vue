<template>
  <button
    :type="type"
    :class="unstyled ? undefined : ['ButtonClass', variant]"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot>
      {{ value }}
    </slot>
  </button>
</template>
<script setup lang="ts">
import { useFieldValue } from '../composables/useFieldValue';

const props = withDefaults(defineProps<{
  modelValue?: string;
  disabled?: boolean;
  /** メニュー・表操作等は既存の専用CSSを適用する。 */
  unstyled?: boolean;
  variant?: string;
  type?: 'button' | 'submit' | 'reset';
}>(), {
  variant: 'PrimaryButton',
  type: 'button'
});
const emit = defineEmits<{
  'update:modelValue': [value: string];
  click: [event: MouseEvent];
}>();
const {
  value,
  setValue,
  getValue
} = useFieldValue<string>(props, emit, '');
defineExpose({
  setValue,
  getValue
});
</script>

