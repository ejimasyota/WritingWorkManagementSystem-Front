<template>
  <Teleport to="body">
    <div
      v-if="visible"
      id="SpinnerOverlay"
      class="SpinnerOverlay"
      role="status"
      aria-label="処理中"
    >
      <div class="SpinnerContainer">
        <div class="Spinner" />
        <div class="SpinnerTitle">
          {{ messageFormat("INFO","I_0003") }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. メッセージ関連
import { messageFormat } from '../utils/messages';

/* ==========================================================
 * props定義
 * ========================================================== */
defineProps<{
  // 1. 表示制御FLG
  visible: boolean;
}>();
</script>


