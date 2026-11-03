<script setup lang="ts">
const auth = useAuthSession()
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <SpinnerOverlay :visible="(auth.checking.value && !auth.user.value) || auth.loggingOut.value" />
  <SessionNoticeHost />
</template>
