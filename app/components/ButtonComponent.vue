<template>
  <button
    :type="type"
    class="ButtonClass"
    :class="variant"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot>
      {{ value }}
    </slot>
  </button>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string;
  disabled?: boolean;
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
} = useFieldValue(props, emit, '');
defineExpose({
  setValue,
  getValue
});
</script>

