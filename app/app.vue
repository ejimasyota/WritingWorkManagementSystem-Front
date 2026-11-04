<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <SpinnerOverlay
    :visible="
      busy ||
      (auth.checking.value && !auth.user.value) ||
      auth.loggingOut.value
    "
  />
  <SessionNoticeHost />
</template>

<script setup lang="ts">
/* ==========================================================
 * 事前定義
 * ========================================================== */
// 1. 認証情報
const auth = useAuthSession()
// 2. API通信状態
const { busy } = useBackendBusy()
</script>

