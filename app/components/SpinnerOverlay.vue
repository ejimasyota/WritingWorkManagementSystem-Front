<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();
</script>

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
          処理中...
        </div>
      </div>
    </div>
  </Teleport>
</template>
