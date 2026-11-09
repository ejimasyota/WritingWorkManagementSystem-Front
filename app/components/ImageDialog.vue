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
        v-if="failedFlg"
        class="fa-solid fa-file-circle-xmark ImageMissingIcon ImageMissingIconLarge"
        aria-label="画像がありません"
      />
      <img v-else :src="src" :alt="alt" class="ImageDialogImage" @error="failedFlg = true">
    </div>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" aria-hidden="true" /> 閉じる
      </ButtonComponent>
      <ButtonComponent v-if="imgDeleteFlg" type="button" variant="DeleteButton" @click="deleteImage">
        <i class="fas fa-trash" aria-hidden="true" /> 削除
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. vue関連
import { ref, watch } from 'vue';

/* ==========================================================
 * props定義
 * ========================================================== */
const props = withDefaults(defineProps<
  /* ------------------------------
   * 1. 属性
   * ------------------------------*/
  {
    // 1. 表示制御FLG
    modelValue?: boolean,
    // 2. 画像パス
    src?: string,
    // 3. 説明
    alt?: string,
    // 4. 削除ボタン表示制御FLG
    imgDeleteFlg?: boolean
  }>(), 
  /* ------------------------------
   * 2. 初期値
   * ------------------------------*/
  {
    // 1. 表示制御FLG
    modelValue: false,
    // 2. 画像パス
    src: '',
    // 3. 説明
    alt: '画像'
  }
);

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits(['update:modelValue', 'delete']);

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 画像読み込み失敗FLG
const failedFlg = ref(false);

/* ==========================================================
 * 監視処理
 * ========================================================== */
/**
 * 画像パスの変更を監視
 */
watch(() => props.src, () => {
  // 1. 画像読み込み失敗FLGを初期化
  failedFlg.value = false;
});

/**
 * 閉じるボタン押下時
 */
const close = () => {
  // 1. 親のプロパティを更新
  emit('update:modelValue', false);
}

/**
 * 削除ボタン押下時
 */
const deleteImage = () => {
  // 1. 削除イベントを通知
  emit('delete');
  // 2. ダイアログを閉じる処理を呼び出し
  close();
}
</script>

