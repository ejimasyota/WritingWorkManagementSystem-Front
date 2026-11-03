<script setup lang="ts">
import { messageDialogProps } from '../composables/componentProps';
defineProps({
  ...messageDialogProps,
  title: {
    type: String,
    default: '確認'
  }
});
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

/** 旧ダイアログの確定・キャンセルを親へ通知して閉じる。 */
function finish(confirmed: boolean) {
  emit('update:modelValue', false);
  emit(confirmed ? 'confirm' : 'cancel');
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="title"
    title-icon="fas fa-question-circle"
    icon-color="#f39c12"
    centered-actions
    @update:model-value="finish(false)"
  >
    <div class="DialogMessage" :style="{ textAlign }">{{ message }}</div>
    <img v-if="imageSrc" :src="imageSrc" :alt="title" class="DialogContentImage">
    <template #actions>
      <button type="button" class="ButtonClass SecondaryButton" @click="finish(false)">
        <i class="fas fa-times" aria-hidden="true" /> いいえ
      </button>
      <button type="button" class="ButtonClass PrimaryButton" @click="finish(true)">
        <i class="fas fa-check" aria-hidden="true" /> はい
      </button>
    </template>
  </BaseDialog>
</template>
