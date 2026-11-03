<script setup lang="ts">
import { ref, watch } from 'vue';
interface Props {
  modelValue?: boolean;
  src?: string;
  alt?: string;
  canDelete?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  src: '',
  alt: '画像'
});
const emit = defineEmits(['update:modelValue', 'delete']);
const failed = ref(false);
watch(() => props.src, () => {
  failed.value = false;
});
function close() {
  emit('update:modelValue', false);
}
function deleteImage() {
  emit('delete');
  close();
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="alt"
    :show-title="false"
    size="DialogLarge"
    centered-actions
    @update:model-value="close"
  >
    <div class="ImageDialogContent">
      <i
        v-if="failed"
        class="fa-solid fa-file-circle-xmark ImageMissingIcon ImageMissingIconLarge"
        aria-label="画像がありません"
      />
      <img v-else :src="src" :alt="alt" class="ImageDialogImage" @error="failed = true">
    </div>
    <template #actions>
      <button type="button" class="ButtonClass CloseButton" @click="close">
        <i class="fas fa-times" aria-hidden="true" /> 閉じる
      </button>
      <button v-if="canDelete" type="button" class="ButtonClass DeleteButton" @click="deleteImage">
        <i class="fas fa-trash" aria-hidden="true" /> 削除
      </button>
    </template>
  </BaseDialog>
</template>
