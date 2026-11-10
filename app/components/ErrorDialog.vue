<template>
  <BaseDialog
    :model-value="modelValue"
    :title="title"
    title-icon="fas fa-exclamation-circle"
    icon-color="#e74c3c"
    centered-actions
    @update:model-value="finish(false)"
  >
    <div class="DialogMessage" :style="{ textAlign }">{{ message }}</div>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      :alt="title"
      class="DialogContentImage"
    />
    <template #actions>
      <ButtonComponent
        type="button"
        variant="CloseButton"
        @click="finish(true)"
      >
        <i class="fas fa-times" aria-hidden="true" /> 閉じる
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
<script setup lang="ts">
import { messageFormat } from '../utils/messages';
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. ダイアログ共通宣言
import { messageDialogProps } from "../composables/componentProps";

/* ==========================================================
 * props定義
 * ========================================================== */
defineProps({
  // 1. ダイアログ共通定義
  ...messageDialogProps,
  // 2. ダイアログタイトル
  title: {
    type: String,
    default: () => messageFormat('ERROR', 'E_0034'),
  },
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

/**
 * 確定・キャンセル処理
 */
function finish(confirmed: boolean) {
  // 1. イベントを通知
  emit("update:modelValue", false);

  emit(confirmed ? "confirm" : "cancel");
}
</script>
