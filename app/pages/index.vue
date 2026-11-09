<script setup lang="ts">
// 新システムの入口。参加URLのトークンなどのクエリもログイン画面へ引き継ぐ。
const route = useRoute();
await navigateTo({ path: '/login', query: route.query }, { replace: true });
</script>

<template>
  <div />
</template>
