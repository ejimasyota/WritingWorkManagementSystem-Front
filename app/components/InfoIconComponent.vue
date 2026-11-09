<script setup lang="ts">
import { ref } from 'vue';
withDefaults(defineProps<{ title?: string; message?: string; label?: string }>(), {
  title: '項目説明',
  message: '',
  label: '説明を表示',
});
const opened = ref(false);
</script>

<template>
  <ButtonComponent unstyled class="InfoIconButton" :aria-label="label" @click.stop.prevent="opened = true">
    <i class="fas fa-info-circle ContentHeaderHelpIcon" aria-hidden="true" />
  </ButtonComponent>
  <InfoDialog v-model="opened" :title="title" :message="message" />
</template>
