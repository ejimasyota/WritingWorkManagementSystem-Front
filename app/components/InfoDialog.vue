<script setup lang="ts">
import { messageFormat } from '../utils/messages';
import { messageDialogProps } from '../composables/componentProps';
defineProps({
  ...messageDialogProps,
  title: {
    type: String,
    default: () => messageFormat('INFO', 'I_0035')
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
    title-icon="fas fa-info-circle"
    icon-color="#3498db"
    centered-actions
    @update:model-value="finish(false)"
  >
    <div class="DialogMessage" :style="{ textAlign }">{{ message }}</div>
    <img v-if="imageSrc" :src="imageSrc" :alt="title" class="DialogContentImage">
    <template #actions>
      <ButtonComponent type="button" variant="PrimaryButton" @click="finish(true)">
        <i class="fas fa-check" aria-hidden="true" /> OK
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
