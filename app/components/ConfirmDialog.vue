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
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. メッセージ表示系ダイアログの共通宣言
import { messageDialogProps } from '../composables/componentProps';

/* ==========================================================
 * props定義
 * ========================================================== */
defineProps({
  // 1. 共通宣言
  ...messageDialogProps,
  // 2. ダイアログタイトル
  title: {
    type: String,
    default: '確認'
  }
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

/** 
 * 確定・キャンセルを親へ通知
 */
const finish = (confirmed: boolean) => {
  // 1. 親のプロパティを更新
  emit('update:modelValue', false);
  // 2. 確定・キャンセルを実行
  emit(confirmed ? 'confirm' : 'cancel');
}
</script>


